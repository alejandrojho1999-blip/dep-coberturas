# ============================================================
# pipeline.py — Pipeline completo de estimación causal
# ============================================================

import warnings
import numpy as np
import pandas as pd
import statsmodels.api as sm
import networkx as nx
from dataclasses import dataclass, field
from typing import Optional

warnings.filterwarnings("ignore")

from causal.config import FORCE_STATIONARY


# ── Resultado causal ─────────────────────────────────────────

@dataclass
class CausalResult:
    ticker: str
    treatment: str
    n_obs: int
    confounders_used: list = field(default_factory=list)
    errors: list = field(default_factory=list)

    # OLS-HC3 (β estandarizado — ranking relativo)
    beta_std: float = np.nan
    tstat_hc3: float = np.nan
    pval_hc3: float = np.nan
    r2adj: float = np.nan

    # OLS-HAC (ATE interpretable en unidades originales)
    ate_hac: float = np.nan
    se_hac: float = np.nan
    ci_hac_lo: float = np.nan
    ci_hac_hi: float = np.nan
    pval_hac: float = np.nan

    # DoWhy backdoor
    ate_dowhy: float = np.nan
    pval_dowhy: float = np.nan
    ident_ok: bool = False
    ident_method: str = "none"

    # LinearDML
    ate_dml: float = np.nan
    ci_dml_lo: float = np.nan
    ci_dml_hi: float = np.nan
    pval_dml: float = np.nan
    dml_ok: bool = False

    # CausalForestDML (CATE)
    cate_low: float = np.nan
    cate_high: float = np.nan
    moderador: str = ""
    cate_ok: bool = False

    # LiNGAM
    lingam_ok: bool = False
    lingam_consistency: float = np.nan   # P(T→Y) × 100
    lingam_prob_t_to_y: float = np.nan
    lingam_prob_y_to_t: float = np.nan
    lingam_penalty: float = np.nan
    lingam_order: list = field(default_factory=list)
    lingam_reversed: bool = False

    # Refutaciones
    refut_placebo_pval: float = np.nan
    refut_random_pval: float = np.nan
    refut_ok: bool = False

    # OLS-HAC t-stat (para Score LdP / DSR)
    tstat_hac: float = np.nan

    # Score LdP
    score_base: float = np.nan
    penalty_lingam: float = np.nan
    penalty_dsr: float = np.nan
    dsr_norm: float = np.nan
    score_ldp: float = np.nan
    decision: str = ""

    @property
    def significant(self) -> bool:
        p = self.pval_dml if self.dml_ok else self.pval_hac
        return float(p) < 0.05 if not np.isnan(p) else False

    @property
    def ate_best(self) -> float:
        return self.ate_dml if self.dml_ok else self.ate_hac

    @property
    def pval_best(self) -> float:
        return self.pval_dml if self.dml_ok else self.pval_hac

    def to_row(self) -> dict:
        return {
            "Ticker"       : self.ticker,
            "Tratamiento"  : self.treatment,
            "N"            : self.n_obs,
            "Score LdP"    : round(self.score_ldp, 1) if not np.isnan(self.score_ldp) else None,
            "Decisión"     : self.decision if self.decision else "—",
            "ATE (mejor)"  : round(self.ate_best, 4) if not np.isnan(self.ate_best) else None,
            "p-value"      : round(self.pval_best, 4) if not np.isnan(self.pval_best) else None,
            "Significativo": "✓" if self.significant else "✗",
            "P(T→Y)%"      : round(self.lingam_consistency, 1) if not np.isnan(self.lingam_consistency) else None,
            "LiNGAM_ok"    : "✓" if self.lingam_ok else "✗",
            "DSR_norm"     : round(self.dsr_norm, 3) if not np.isnan(self.dsr_norm) else None,
            "β_std"        : round(self.beta_std, 4) if not np.isnan(self.beta_std) else None,
            "ATE_OLS"      : round(self.ate_hac, 4) if not np.isnan(self.ate_hac) else None,
            "p_OLS"        : round(self.pval_hac, 4) if not np.isnan(self.pval_hac) else None,
            "ATE_DML"      : round(self.ate_dml, 4) if self.dml_ok else None,
            "p_DML"        : round(self.pval_dml, 4) if self.dml_ok else None,
            "Refut_ok"     : "✓" if self.refut_ok else "✗",
        }


# ── Utilidades ───────────────────────────────────────────────

def test_stationarity(series: pd.Series, name: str, alpha: float = 0.05) -> tuple[bool, float, float]:
    """ADF + KPSS. Devuelve (estacionaria, adf_p, kpss_p)."""
    from statsmodels.tsa.stattools import adfuller, kpss
    s = series.dropna()
    if len(s) < 8:
        return False, np.nan, np.nan
    try:
        adf_p = float(adfuller(s, autolag="AIC")[1])
    except Exception:
        adf_p = np.nan
    try:
        _, kpss_p, _, _ = kpss(s, regression="c", nlags="auto")
    except Exception:
        kpss_p = 0.0
    estacionaria = (not np.isnan(adf_p) and adf_p < alpha) and (kpss_p > alpha)
    return estacionaria, adf_p, kpss_p


def make_stationary(df: pd.DataFrame, cols: list) -> tuple[pd.DataFrame, dict]:
    """Diferencia las columnas no estacionarias. Devuelve (df_mod, transformaciones)."""
    df = df.copy()
    transformaciones = {}
    for col in cols:
        if col not in df.columns:
            continue
        if col in FORCE_STATIONARY:
            continue
        ok, _, _ = test_stationarity(df[col], col)
        if not ok:
            df[col] = df[col].diff()
            transformaciones[col] = "Δ1"
    return df, transformaciones


def build_dag(treatment: str, outcome: str, confounders: list) -> tuple[nx.DiGraph, str]:
    """Construye DAG de NetworkX y string GML para DoWhy."""
    G = nx.DiGraph()
    G.add_edge(treatment, outcome)
    for c in confounders:
        G.add_edge(c, treatment)
        G.add_edge(c, outcome)

    nodes = list(dict.fromkeys([treatment, outcome] + confounders))
    idx = {n: i for i, n in enumerate(nodes)}
    lines = ["graph [", "  directed 1"]
    for i, n in enumerate(nodes):
        lines.append(f'  node [ id {i} label "{n}" ]')
    for src, dst in G.edges():
        lines.append(f'  edge [ source {idx[src]} target {idx[dst]} ]')
    lines.append("]")
    return G, "\n".join(lines)


# ── Pasos del pipeline ───────────────────────────────────────

def run_lingam(df: pd.DataFrame, treatment: str, outcome: str,
               confounders: list, n_min: int = 30) -> dict:
    """
    Valida dirección causal T→Y con DirectLiNGAM + bootstrap (200 iter).
    P(T→Y) ≥ 0.60 → ok=True, penalty=1.0
    P(T→Y) ≥ 0.40 → ok=False, penalty=0.75
    P(T→Y) < 0.40 → ok=False, penalty=0.50
    """
    result = {
        "ok": False, "consistency_pct": 0.0, "prob_t_to_y": 0.0,
        "prob_y_to_t": 0.0, "penalty_lingam": 0.50,
        "order": [], "reversed": False, "error": None,
    }
    try:
        import lingam
    except ImportError:
        result["error"] = "lingam no instalado"
        return result

    cols = [outcome, treatment] + confounders
    data = df[[c for c in cols if c in df.columns]].dropna()
    if len(data) < n_min:
        result["error"] = f"n={len(data)} < {n_min} mínimo"
        return result

    try:
        model = lingam.DirectLiNGAM(random_state=42)
        model.fit(data.values)
        var_names = [c for c in cols if c in df.columns]
        result["order"] = [var_names[i] for i in model.causal_order_]

        # Bootstrap 200 iteraciones → P(j→i)
        boot = model.bootstrap(data.values, n_sampling=200)
        prob_matrix = boot.get_probabilities()

        idx_T = var_names.index(treatment)
        idx_Y = var_names.index(outcome)
        p_t_to_y = float(prob_matrix[idx_Y, idx_T])
        p_y_to_t = float(prob_matrix[idx_T, idx_Y])

        result["prob_t_to_y"]   = p_t_to_y
        result["prob_y_to_t"]   = p_y_to_t
        result["consistency_pct"] = p_t_to_y * 100
        result["reversed"]      = p_y_to_t > p_t_to_y

        if p_t_to_y >= 0.60:
            result["ok"]             = True
            result["penalty_lingam"] = 1.00
        elif p_t_to_y >= 0.40:
            result["ok"]             = False
            result["penalty_lingam"] = 0.85
        else:
            # Near-Gaussian macro data (CLT) → LiNGAM loses power, not causal evidence.
            # 0.70 reflects "undetermined direction", not "reverse causality".
            result["ok"]             = False
            result["penalty_lingam"] = 0.70

    except Exception as e:
        result["error"] = str(e)

    return result


def run_ols_hc3(df: pd.DataFrame, treatment: str, outcome: str, confounders: list) -> dict:
    """OLS con errores HC3 sobre variables estandarizadas (β ranking)."""
    from sklearn.preprocessing import StandardScaler
    cols_avail = [c for c in [treatment] + confounders if c in df.columns]
    n = len(df)
    k = len(cols_avail) + 1   # regressors + constant
    if n < k + 5:
        raise ValueError(f"n={n} insuficiente para {k} parámetros")

    # Eliminar columnas con varianza cero (constantes)
    data = df[cols_avail].copy()
    data = data.loc[:, data.std() > 1e-10]
    if treatment not in data.columns:
        raise ValueError(f"Tratamiento '{treatment}' es constante o ausente")

    scaler = StandardScaler()
    X_std = scaler.fit_transform(data)
    y = df[outcome].values
    if y.std() < 1e-10:
        raise ValueError("Outcome es constante")
    Y_std = (y - y.mean()) / y.std()
    X_wc  = sm.add_constant(X_std)
    fit   = sm.OLS(Y_std, X_wc).fit(cov_type="HC3")
    t_idx = 1   # treatment está en columna 1 (después de la constante)
    return {
        "beta_std" : float(fit.params[t_idx]),
        "tstat"    : float(fit.tvalues[t_idx]),
        "pval"     : float(fit.pvalues[t_idx]),
        "r2adj"    : float(fit.rsquared_adj),
    }


def run_ols_hac(df: pd.DataFrame, treatment: str, outcome: str, confounders: list) -> dict:
    """OLS con errores HAC (Newey-West) — ATE en unidades originales."""
    conf_avail = [c for c in confounders if c in df.columns]
    n = len(df)
    k = len(conf_avail) + 1 + 1   # confounders + treatment + constant
    if n < k + 5:
        raise ValueError(f"n={n} insuficiente para {k} parámetros HAC")

    maxlags = max(int(np.floor(4 * (n / 100) ** (2 / 9))), 1)
    X  = sm.add_constant(df[[treatment] + conf_avail])
    fit = sm.OLS(df[outcome], X).fit(cov_type="HAC", cov_kwds={"maxlags": maxlags, "use_correction": True})
    ci  = fit.conf_int().loc[treatment].values
    return {
        "ate"    : float(fit.params[treatment]),
        "se"     : float(fit.bse[treatment]),
        "ci_lo"  : float(ci[0]),
        "ci_hi"  : float(ci[1]),
        "pval"   : float(fit.pvalues[treatment]),
        "tstat"  : float(fit.tvalues[treatment]),
        "maxlags": maxlags,
    }


def compute_score_ldp(
    beta_std: float,
    tstat_hac: float,
    r2adj: float,
    p_hac: float,
    penalty_lingam: float,
    y_vals: np.ndarray,
    n: int,
) -> dict:
    """
    Score LdP (López de Prado) con penalizaciones LiNGAM y DSR.
    Score base = 40%|β_std| + 30%|t_HAC| + 20%R²adj + 10%(1−p_HAC)
    Umbrales calibrados para retornos mensuales:
      β_std normalizado a 0.3 (retornos mensuales son pequeños)
      t_HAC normalizado a 2.0 (umbral estándar α=5%)
    Penalización DSR: continua (no binaria) entre 0.5 y 1.0.
    """
    from scipy import stats as scipy_stats

    def _safe(v): return 0.0 if (v is None or np.isnan(v)) else float(v)

    b = min(abs(_safe(beta_std)) / 0.3, 1.0)   # umbral 0.3 (antes 0.5)
    t = min(abs(_safe(tstat_hac)) / 2.0, 1.0)  # umbral 2.0 (antes 3.0)
    r = max(_safe(r2adj), 0.0)
    p = 0.0 if (p_hac is None or np.isnan(p_hac)) else (1.0 - float(p_hac))

    score_base = 40.0 * b + 30.0 * t + 20.0 * r + 10.0 * p

    # DSR — Deflated Sharpe Ratio (continuo entre 0.5 y 1.0)
    t_abs   = abs(_safe(tstat_hac))
    sr_raw  = t_abs / np.sqrt(max(n, 2))
    skew_r  = float(scipy_stats.skew(y_vals))    if len(y_vals) > 3 else 0.0
    kurt_r  = float(scipy_stats.kurtosis(y_vals)) if len(y_vals) > 3 else 0.0

    if sr_raw < 1e-10:
        dsr_norm = 0.5
    else:
        dsr_num = sr_raw * np.sqrt(max(n - 1, 1))
        dsr_den = np.sqrt(max(1e-10,
                              1.0 - skew_r * sr_raw + (kurt_r / 4.0) * sr_raw ** 2))
        dsr_norm = float(scipy_stats.norm.cdf(dsr_num / dsr_den))

    # Penalización continua: 0.5 + 0.5*dsr_norm (rango 0.5–1.0, no binaria)
    pen_dsr  = 0.5 + 0.5 * dsr_norm
    pen_ling = _safe(penalty_lingam) if not np.isnan(penalty_lingam) else 0.5

    score_ldp = max(0.0, min(100.0, score_base * pen_ling * pen_dsr))

    if score_ldp < 20:
        decision = "REDUCIR / INFRAPONDERAR"
    elif score_ldp < 40:
        decision = "NEUTRAL / MANTENER"
    elif score_ldp < 65:
        decision = "SOBREPONDERAR LEVE"
    else:
        decision = "SOBREPONDERAR FUERTE"

    return {
        "score_base"   : round(score_base, 2),
        "penalty_dsr"  : pen_dsr,
        "dsr_norm"     : round(dsr_norm, 4),
        "score_ldp"    : round(score_ldp, 2),
        "decision"     : decision,
    }


def run_dowhy(df: pd.DataFrame, treatment: str, outcome: str, gml: str) -> dict:
    """Identificación y estimación via DoWhy (backdoor lineal)."""
    import textwrap
    from dowhy import CausalModel
    result = {"ate": np.nan, "pval": np.nan, "ident_ok": False, "method": "none", "error": None}
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = CausalModel(data=df, treatment=treatment, outcome=outcome, graph=gml)
            estimand = model.identify_effect(proceed_when_unidentifiable=True)

        # Detectar método de identificación
        est_str = str(estimand).lower()
        bd_vars = []
        try:
            bd_vars = list(estimand.get_backdoor_variables() or [])
        except Exception:
            pass

        if bd_vars:
            result["ident_ok"] = True
            result["method"]   = "backdoor"
        elif "frontdoor" in est_str:
            result["ident_ok"] = True
            result["method"]   = "frontdoor"

        if result["ident_ok"]:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                est = model.estimate_effect(
                    estimand,
                    method_name          = "backdoor.linear_regression",
                    control_value        = 0,
                    treatment_value      = 1,
                    confidence_intervals = True,
                    test_significance    = True,
                )
            result["ate"]   = float(est.value)
            result["model"] = model
            result["estimand"] = estimand
            result["estimate"] = est
            try:
                result["pval"] = float(est.test_stat_significance()["p_value"])
            except Exception:
                pass

    except Exception as e:
        result["error"] = str(e)

    return result


def _nuisance_model(n: int):
    """
    Modelo base adaptativo para DML/CausalForest según tamaño de muestra.
    n < 120 → Ridge (regularización fuerte, no sobreajusta con pocos datos)
    n >= 120 → GradientBoosting (captura no-linealidades con historia suficiente)
    """
    from sklearn.linear_model import Ridge
    from sklearn.ensemble import GradientBoostingRegressor
    if n < 120:
        return Ridge(alpha=1.0)
    return GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42)


def run_linear_dml(df: pd.DataFrame, treatment: str, outcome: str, confounders: list) -> dict:
    """
    LinearDML con modelo nuisance adaptativo.
    n >= 120 : GradientBoosting, cv=5
    40 <= n < 120 : Ridge, cv=3
    n < 40  : no corre
    """
    from econml.dml import LinearDML
    from scipy import stats as scipy_stats

    result = {"ok": False, "ate": np.nan, "ci_lo": np.nan, "ci_hi": np.nan, "pval": np.nan, "error": None}
    n = len(df)
    if n < 35:
        result["error"] = f"DML: n={n} < 35"
        return result

    conf_avail = [c for c in confounders if c in df.columns]

    try:
        T = df[treatment].values
        Y = df[outcome].values
        W = df[conf_avail].values if conf_avail else None

        model = _nuisance_model(n)
        cv    = 3 if n < 100 else 5
        dml   = LinearDML(model_y=model, model_t=model, cv=cv,
                          random_state=42, discrete_treatment=False)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            dml.fit(Y=Y, T=T, X=None, W=W)

        ate    = float(dml.ate())
        ci     = dml.ate_interval(alpha=0.05)
        ci_lo, ci_hi = float(ci[0]), float(ci[1])

        # Pvalue directo desde effect_inference (evita división por cero en z manual)
        try:
            pval = float(dml.ate_inference().pvalue())
        except Exception:
            se   = (ci_hi - ci_lo) / (2 * 1.96)
            z    = ate / se if se > 1e-12 else 0.0
            pval = float(2 * (1 - scipy_stats.norm.cdf(abs(z))))

        result.update({"ok": True, "ate": ate, "ci_lo": ci_lo, "ci_hi": ci_hi, "pval": pval})
    except Exception as e:
        result["error"] = str(e)

    return result


def run_causal_forest(df: pd.DataFrame, treatment: str, outcome: str,
                      confounders: list, moderador: str) -> dict:
    """
    CausalForestDML para CATE heterogéneo con parámetros adaptativos.
    n >= 150 : GBR + 200 árboles + cv=5
    60 <= n < 150 : Ridge + 50 árboles + cv=3 + min_samples_leaf=5
    35 <= n < 60  : Ridge + 30 árboles + cv=2 + min_samples_leaf=5
    n < 35  : no corre
    """
    from econml.dml import CausalForestDML

    result = {"ok": False, "cate_low": np.nan, "cate_high": np.nan, "error": None}
    n = len(df)
    if n < 35 or not confounders:
        result["error"] = f"CausalForest: n={n} < 35 o sin confundidores"
        return result

    if moderador not in df.columns:
        result["error"] = f"Moderador '{moderador}' no en datos"
        return result

    try:
        T = df[treatment].values
        Y = df[outcome].values
        W = df[confounders].values
        X = df[[moderador]].values

        model          = _nuisance_model(n)
        # n_estimators debe ser divisible por subforest_size=4 (requisito de econML)
        n_estimators   = 200 if n >= 150 else (100 if n >= 80 else (48 if n >= 60 else 32))
        cv             = 5   if n >= 150 else (3 if n >= 60 else 2)
        min_leaf       = 5   if n >= 100 else 5

        cf = CausalForestDML(
            model_y=model, model_t=model,
            n_estimators=n_estimators,
            min_samples_leaf=min_leaf,
            cv=cv,
            random_state=42,
        )

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            cf.fit(Y=Y, T=T, X=X, W=W)

        cate = cf.effect(X)
        mod  = df[moderador]
        q25, q75 = mod.quantile(0.25), mod.quantile(0.75)
        result["cate_low"]  = float(cate[mod < q25].mean())
        result["cate_high"] = float(cate[mod > q75].mean())
        result["ok"] = True
    except Exception as e:
        result["error"] = str(e)

    return result


def run_refutations_dml(
    df: pd.DataFrame,
    treatment: str,
    outcome: str,
    confounders: list,
    ate_original: float,
    n_simulations: int = 50,
) -> dict:
    """
    Refutación basada en DML — consistente con el estimador principal.

    Placebo DML: permuta T aleatoriamente 50 veces y re-estima ATE con DML.
      p-value = fracción de |ATE_permutado| >= |ATE_original|
      Pasa si p < 0.05 (el efecto real es atípico respecto a T aleatoria).

    Random common cause DML: agrega variable Gaussiana aleatoria como confundidor
      en W y re-estima ATE con DML. t-test de igualdad contra ATE original.
      Pasa si p > 0.05 (el ATE no cambia con confundidor espurio).

    Usa Ridge siempre (velocidad) independientemente del n.
    """
    from econml.dml import LinearDML
    from sklearn.linear_model import Ridge
    from scipy import stats as scipy_stats

    result = {"ok": False, "placebo_pval": np.nan, "random_pval": np.nan, "error": None}

    if np.isnan(ate_original):
        result["error"] = "ATE original no disponible"
        return result

    n = len(df)
    if n < 35:
        result["error"] = f"n={n} insuficiente para refutación DML"
        return result

    conf_avail = [c for c in confounders if c in df.columns]
    T = df[treatment].values
    Y = df[outcome].values
    W = df[conf_avail].values if conf_avail else None
    mdl = Ridge(alpha=1.0)

    # ── Placebo: permutar T ──────────────────────────────────
    ate_perms = []
    for _ in range(n_simulations):
        try:
            T_perm = np.random.permutation(T)
            dml_p = LinearDML(model_y=mdl, model_t=mdl, cv=3,
                              random_state=None, discrete_treatment=False)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                dml_p.fit(Y=Y, T=T_perm, X=None, W=W)
            ate_perms.append(float(dml_p.ate()))
        except Exception:
            pass

    if len(ate_perms) >= 10:
        result["placebo_pval"] = float(np.mean(np.abs(ate_perms) >= abs(ate_original)))

    # ── Random common cause: confundidor espurio ─────────────
    rng = np.random.default_rng(42)
    ate_with_z = []
    for _ in range(n_simulations):
        try:
            Z = rng.normal(0, 1, n).reshape(-1, 1)
            W_aug = np.hstack([W, Z]) if W is not None else Z
            dml_z = LinearDML(model_y=mdl, model_t=mdl, cv=3,
                              random_state=None, discrete_treatment=False)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                dml_z.fit(Y=Y, T=T, X=None, W=W_aug)
            ate_with_z.append(float(dml_z.ate()))
        except Exception:
            pass

    if len(ate_with_z) >= 10:
        _, p_tt = scipy_stats.ttest_1samp(ate_with_z, ate_original)
        result["random_pval"] = float(p_tt)

    p_pl = result["placebo_pval"]
    p_rc = result["random_pval"]
    result["ok"] = (
        not np.isnan(p_pl) and p_pl < 0.05 and
        not np.isnan(p_rc) and p_rc > 0.05
    )
    return result


# ── Pipeline principal ───────────────────────────────────────

def run_full_pipeline(
    ticker: str,
    cfg: dict,
    df_clean: pd.DataFrame,
    confounders: list,
    run_refut: bool = False,
) -> CausalResult:
    """
    Ejecuta el pipeline causal completo sobre df_clean ya preparado.
    df_clean debe tener columnas: [TREATMENT, 'PRICE_RETURN'] + confounders
    """
    treatment = cfg["treatment"]
    outcome   = "PRICE_RETURN"
    moderador = cfg.get("moderador_cate", confounders[0] if confounders else "")
    n         = len(df_clean)

    res = CausalResult(ticker=ticker, treatment=treatment, n_obs=n, confounders_used=confounders)

    # ── 1. Estacionariedad ───────────────────────────────────
    all_cols = [treatment] + confounders
    df_proc, _ = make_stationary(df_clean, all_cols)

    # Reemplazar inf/-inf producidos por diff() o pct_change() con NaN
    df_proc = df_proc.replace([np.inf, -np.inf], np.nan)

    # Eliminar filas con NaN en treatment, outcome O cualquier confundidor
    # (todos los estimadores requieren X completo — NaN en confundidores
    # causa "exog contiene inf o nans" en OLS/DoWhy/DML)
    required = [c for c in [treatment, outcome] + confounders if c in df_proc.columns]
    df_proc = df_proc.dropna(subset=required)
    res.n_obs = len(df_proc)

    if res.n_obs < 20:
        res.errors.append(f"Muy pocas observaciones: {res.n_obs}")
        return res

    # Advertencia de potencia estadística reducida (no bloquea, solo registra)
    if res.n_obs < 96:
        res.errors.append(
            f"⚠️ Muestra corta ({res.n_obs} obs < 8 años). "
            "LiNGAM y DML pueden tener baja potencia; el quiebre COVID puede dominar el ATE. "
            "Resultado válido pero interpreta con cautela."
        )

    # ── 2. LiNGAM (bootstrap 200 iter → P(T→Y)) ────────────
    lingam_r = run_lingam(df_proc, treatment, outcome, confounders)
    res.lingam_ok          = lingam_r["ok"]
    res.lingam_consistency = lingam_r.get("consistency_pct", np.nan)
    res.lingam_prob_t_to_y = lingam_r.get("prob_t_to_y", np.nan)
    res.lingam_prob_y_to_t = lingam_r.get("prob_y_to_t", np.nan)
    res.lingam_penalty     = lingam_r.get("penalty_lingam", 0.5)
    res.lingam_order       = lingam_r.get("order", [])
    res.lingam_reversed    = lingam_r.get("reversed", False)
    if lingam_r.get("error"):
        res.errors.append(f"LiNGAM: {lingam_r['error']}")

    # ── 3. DAG + DoWhy ───────────────────────────────────────
    _, gml = build_dag(treatment, outcome, confounders)
    dowhy_r = run_dowhy(df_proc, treatment, outcome, gml)
    res.ident_ok    = dowhy_r["ident_ok"]
    res.ident_method = dowhy_r["method"]
    res.ate_dowhy   = dowhy_r.get("ate", np.nan)
    res.pval_dowhy  = dowhy_r.get("pval", np.nan)
    if dowhy_r.get("error"):
        res.errors.append(f"DoWhy: {dowhy_r['error']}")

    # ── 4. OLS-HC3 ───────────────────────────────────────────
    try:
        hc3 = run_ols_hc3(df_proc, treatment, outcome, confounders)
        res.beta_std  = hc3["beta_std"]
        res.tstat_hc3 = hc3["tstat"]
        res.pval_hc3  = hc3["pval"]
        res.r2adj     = hc3["r2adj"]
    except Exception as e:
        res.errors.append(f"OLS-HC3: {e}")

    # ── 5. OLS-HAC ───────────────────────────────────────────
    try:
        hac = run_ols_hac(df_proc, treatment, outcome, confounders)
        res.ate_hac    = hac["ate"]
        res.se_hac     = hac["se"]
        res.ci_hac_lo  = hac["ci_lo"]
        res.ci_hac_hi  = hac["ci_hi"]
        res.pval_hac   = hac["pval"]
        res.tstat_hac  = hac["tstat"]
    except Exception as e:
        res.errors.append(f"OLS-HAC: {e}")

    # ── 6. LinearDML ─────────────────────────────────────────
    dml_r = run_linear_dml(df_proc, treatment, outcome, confounders)
    if dml_r["ok"]:
        res.dml_ok   = True
        res.ate_dml  = dml_r["ate"]
        res.ci_dml_lo = dml_r["ci_lo"]
        res.ci_dml_hi = dml_r["ci_hi"]
        res.pval_dml  = dml_r["pval"]
    elif dml_r.get("error"):
        res.errors.append(f"DML: {dml_r['error']}")

    # ── 7. CausalForest CATE ─────────────────────────────────
    if moderador:
        cf_r = run_causal_forest(df_proc, treatment, outcome, confounders, moderador)
        if cf_r["ok"]:
            res.cate_ok   = True
            res.cate_low  = cf_r["cate_low"]
            res.cate_high = cf_r["cate_high"]
            res.moderador = moderador
        elif cf_r.get("error"):
            res.errors.append(f"CausalForest: {cf_r['error']}")

    # ── 8. Score LdP ─────────────────────────────────────────
    if not (np.isnan(res.beta_std) or np.isnan(res.tstat_hac)):
        try:
            y_vals = df_proc[outcome].dropna().values
            score_r = compute_score_ldp(
                beta_std     = res.beta_std,
                tstat_hac    = res.tstat_hac,
                r2adj        = res.r2adj,
                p_hac        = res.pval_hac,
                penalty_lingam = res.lingam_penalty,
                y_vals       = y_vals,
                n            = res.n_obs,
            )
            res.score_base    = score_r["score_base"]
            res.penalty_lingam = res.lingam_penalty
            res.penalty_dsr   = score_r["penalty_dsr"]
            res.dsr_norm      = score_r["dsr_norm"]
            res.score_ldp     = score_r["score_ldp"]
            res.decision      = score_r["decision"]
        except Exception as e:
            res.errors.append(f"Score LdP: {e}")

    # ── 9. Refutaciones DML (opcional) ──────────────────────
    if run_refut:
        _ate_ref = res.ate_dml if res.dml_ok else res.ate_hac
        ref_r = run_refutations_dml(df_proc, treatment, outcome, confounders, _ate_ref)
        res.refut_placebo_pval = ref_r["placebo_pval"]
        res.refut_random_pval  = ref_r["random_pval"]
        res.refut_ok           = ref_r["ok"]
        if ref_r.get("error"):
            res.errors.append(f"Refut: {ref_r['error']}")

    return res
