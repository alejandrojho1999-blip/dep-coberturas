# ============================================================
# ppo_utils.py — Utilidades para Módulo 1.3: Agente PPO
# ============================================================
import time
import numpy as np
import pandas as pd
import yfinance as yf
import streamlit as st
from scipy import stats
from typing import Optional

from causal.ppo_env import EntornoPortafolioOptimizador

# ── Mapa tratamiento → proxy diario (yfinance) ───────────────
# Para cada tratamiento del M1.1, usa un ticker de yfinance como proxy diario.
TREATMENT_YF_MAP: dict = {
    "DXY_Change"              : ("DX-Y.NYB", "pct_change"),
    "DGS10_CHANGE"            : ("^TNX",     "diff"),
    "DGS2_CHANGE"             : ("^IRX",     "diff"),
    "YIELD_SPREAD_CHANGE"     : ("^TNX",     "diff"),
    "FEDFUNDS_CHANGE"         : ("^IRX",     "diff"),
    "CREDIT_SPREAD_CHANGE"    : ("HYG",      "pct_change"),
    "CREDIT_SPREAD"           : ("HYG",      "pct_change"),
    "GPR_CHANGE"              : ("ITA",      "pct_change"),   # defense ETF proxy
    "SEMI_PROD_YoY"           : ("^SOX",     "pct_change"),   # semiconductor index
    "TOTCON_YoY"              : ("XLB",      "pct_change"),   # materials ETF proxy
    "BRL_Change"              : ("BRL=X",    "pct_change"),
    "INDPRO_YoY"              : ("XLI",      "pct_change"),   # industrial ETF
    "AI_CapEx_Proxy"          : ("BOTZ",     "pct_change"),   # AI/robotics ETF
    "AI_CapEx_Proxy_no_msft"  : ("BOTZ",     "pct_change"),
    "AI_CapEx_Proxy_no_amzn"  : ("BOTZ",     "pct_change"),
    "CPI_YoY"                 : ("TIP",      "pct_change"),   # TIPS ETF
    "Core_CPI_YoY"            : ("TIP",      "pct_change"),
    "PCE_YoY"                 : ("TIP",      "pct_change"),
    "CRUDE_OIL_Change"        : ("CL=F",     "pct_change"),
    "CRUDE_YF_Change"         : ("CL=F",     "pct_change"),
    "GoldPrice_Change"        : ("GC=F",     "pct_change"),
    "VIX"                     : ("^VIX",     "close"),
    "CONSUMER_SENT"           : ("XLY",      "pct_change"),   # consumer discretionary
    "DEFICIT_MONTHLY"         : ("TLT",      "pct_change"),   # 20Y treasury bond
    "ELEC_YoY"                : ("XLU",      "pct_change"),   # utilities ETF
    "UNRATE"                  : ("XLY",      "pct_change"),   # proxy por sector consumo
    "SP500_Return"            : ("^GSPC",    "pct_change"),
    "NASDAQ_Return"           : ("^IXIC",    "pct_change"),
    "SOXX_Return"             : ("^SOX",     "pct_change"),
    "QQQ_Return"              : ("QQQ",      "pct_change"),
}


# ── Constructor de matrices de tratamiento ───────────────────
@st.cache_data(ttl=3600, show_spinner=False)
def build_treatment_matrices(
    df_returns_index: tuple,      # fechas como tupla para cache-key
    tickers: tuple,
    treatments_por_activo: tuple, # ((ticker, treatment), ...) para cache-key
    start_date: str,
    end_date: str,
) -> tuple:
    """
    Descarga proxies diarios para cada tratamiento y construye:
    - TREATMENT_MATRIX      (N_días × N_activos): señal diaria
    - TREATMENT_MATRIX_TRIM (N_días × N_activos): MA 63 días
    - IV_rel                (N_períodos × N_activos): varianza inversa relativa rolling 24m

    Devuelve: (TREATMENT_MATRIX, TREATMENT_MATRIX_TRIM, IV_rel) como DataFrames
    con índice = fechas y columnas = tickers.
    """
    import warnings
    warnings.filterwarnings("ignore")

    idx = pd.DatetimeIndex(df_returns_index)
    treats = dict(treatments_por_activo)
    tickers_list = list(tickers)

    # Descargar proxies únicos
    tratamientos_unicos = set(v for v in treats.values() if v in TREATMENT_YF_MAP)
    treatment_series: dict = {}

    for tname in tratamientos_unicos:
        ytick, transf = TREATMENT_YF_MAP[tname]
        try:
            time.sleep(0.2)
            raw = yf.download(ytick, start=start_date, end=end_date,
                              progress=False, auto_adjust=True)
            if raw.empty:
                continue
            close = raw["Close"].squeeze()
            if transf == "pct_change":
                s = close.pct_change()
            elif transf == "diff":
                s = close.diff()
            else:
                s = close
            # Alinear al índice de retornos (forward-fill gaps de mercado)
            s = s.reindex(idx, method="ffill").fillna(0.0)
            if s.index.tz is not None:
                s.index = s.index.tz_localize(None)
            s.index = s.index.normalize()
            s = s.reindex(idx).fillna(0.0)
            treatment_series[tname] = s.astype(np.float32)
        except Exception:
            pass

    # Construir TREATMENT_MATRIX
    tm = pd.DataFrame(0.0, index=idx, columns=tickers_list, dtype=np.float32)
    for t in tickers_list:
        tname = treats.get(t)
        if tname and tname in treatment_series:
            tm[t] = treatment_series[tname].values

    # MA 3 períodos (≈1 trimestre en datos mensuales)
    tm_trim = (
        tm.rolling(window=3, min_periods=1)
        .mean()
        .fillna(0.0)
        .astype(np.float32)
    )

    return tm, tm_trim


@st.cache_data(ttl=3600, show_spinner=False)
def build_iv_rel(df_returns_values: tuple, df_returns_index: tuple,
                 tickers: tuple, ventana: int = 24) -> pd.DataFrame:
    """Varianza inversa relativa rolling (driver HRP)."""
    idx  = pd.DatetimeIndex(df_returns_index)
    data = np.array(df_returns_values)
    df   = pd.DataFrame(data, index=idx, columns=list(tickers))
    rolling_var = df.rolling(window=ventana, min_periods=12).var()
    rolling_iv  = (1.0 / rolling_var).replace([np.inf, -np.inf], 0.0).fillna(0.0)
    iv_rel = (
        rolling_iv
        .div(rolling_iv.sum(axis=1).replace(0, np.nan), axis=0)
        .fillna(1.0 / len(tickers))
        .astype(np.float32)
    )
    return iv_rel


# ── Simulación del agente en test ───────────────────────────
def inject_quarterly_scores(
    tm: pd.DataFrame,
    quarterly_scores: dict,   # {ticker: float ∈ [-1,1]}
    frec_dias: int = 63,      # días del trimestre (default 3 meses × 21)
) -> pd.DataFrame:
    """
    Sobreescribe las últimas `frec_dias` filas de tm con los scores trimestrales.
    Los scores del 10-Q reemplazan el tratamiento macro del trimestre actual,
    representando la señal causal observada en los reportes de resultados.
    """
    tm_q = tm.copy()
    for ticker, score in quarterly_scores.items():
        if ticker in tm_q.columns:
            tm_q.loc[tm_q.index[-frec_dias:], ticker] = float(score)
    return tm_q


def simulate_agent(
    agente,
    retornos_test: pd.DataFrame,
    pesos_obj: pd.Series,
    tm: pd.DataFrame,
    tm_trim: pd.DataFrame,
    iv_rel: pd.DataFrame,
    beta_std_vec: np.ndarray,
    score_vec: np.ndarray,
    vec_norm=None,
    ventana_L: int = 6,
    frec_decision: int = 63,
) -> pd.DataFrame:
    """Ejecuta simulación determinista del agente PPO sobre el período test."""
    env_raw = EntornoPortafolioOptimizador(
        retornos           = retornos_test,
        pesos_obj          = pesos_obj,
        treatment_mat      = tm,
        treatment_mat_trim = tm_trim,
        iv_mat             = iv_rel,
        beta_std           = beta_std_vec,
        score              = score_vec,
        ventana_L          = ventana_L,
        costo_trans        = 0.001,
        lambda_dd          = 0.1,
        dd_max             = 0.15,
        frec_decision      = frec_decision,
    )
    obs, _ = env_raw.reset()
    done   = False
    historial = []

    while not done:
        t_ini    = env_raw.t
        obs_pred = vec_norm.normalize_obs(obs.reshape(1, -1))[0] if vec_norm else obs
        accion, _ = agente.predict(obs_pred, deterministic=True)
        obs, _, terminated, truncated, info = env_raw.step(accion)
        done  = terminated or truncated
        t_fin = env_raw.t
        n     = len(retornos_test)
        historial.append({
            "fecha_ini"         : retornos_test.index[min(t_ini, n - 1)],
            "fecha_fin"         : retornos_test.index[min(t_fin, n - 1)],
            "alpha"             : info["alpha"],
            "alpha_vec"         : info["alpha_vec"],
            "pesos"             : info["pesos"].copy(),
            "retorno"           : info["retorno"],
            "costo_tx"          : info["costo_tx"],
            "drawdown"          : info["drawdown"],
            "desviacion"        : info["desviacion"],
            "valor_port"        : info["valor_port"],
            "exposicion_causal" : info["exposicion_causal"],
            "alineacion_causal" : info["alineacion_causal"],
        })

    return pd.DataFrame(historial).set_index("fecha_fin")


# ── Curvas de riqueza ────────────────────────────────────────
def wealth_daily(df_retornos_periodo: pd.DataFrame, df_hist: pd.DataFrame) -> pd.Series:
    """Construye serie de riqueza diaria desde historial PPO."""
    valor = pd.Series(index=df_retornos_periodo.index, dtype=float)
    valor_actual = 1.0
    for fecha_fin, row in df_hist.iterrows():
        mask  = ((df_retornos_periodo.index > row["fecha_ini"]) &
                 (df_retornos_periodo.index <= fecha_fin))
        ret_d = df_retornos_periodo.loc[mask] @ row["pesos"]
        acum  = (1 + ret_d).cumprod() * valor_actual
        if len(acum) > 0:
            valor.loc[mask] = acum.values
            valor_actual    = float(acum.iloc[-1])
    return valor.ffill().fillna(1.0)


def wealth_bench(pesos: pd.Series, retornos: pd.DataFrame) -> pd.Series:
    """Riqueza acumulada de portafolio estático."""
    aligned = pesos.reindex(retornos.columns).fillna(0.0)
    if aligned.sum() > 0:
        aligned /= aligned.sum()
    return (1 + retornos @ aligned).cumprod()


# ── Métricas de performance ──────────────────────────────────
def compute_metrics(riqueza: pd.Series, rf: float = 0.043, anual: int = 12) -> dict:
    ret_d    = riqueza.pct_change().dropna()
    ret_a    = float(ret_d.mean() * anual)
    vol_a    = float(ret_d.std() * np.sqrt(anual))
    sharpe   = (ret_a - rf) / vol_a if vol_a > 0 else np.nan
    ret_neg  = ret_d[ret_d < 0]
    downside = float(ret_neg.std() * np.sqrt(anual)) if len(ret_neg) > 1 else np.nan
    sortino  = (ret_a - rf) / downside if downside and downside > 0 else np.nan
    max_dd   = float(((riqueza - riqueza.cummax()) / riqueza.cummax()).min())
    return {
        "Retorno Total" : float(riqueza.iloc[-1] - 1),
        "Retorno Anual" : ret_a,
        "Volatilidad"   : vol_a,
        "Sharpe"        : sharpe,
        "Sortino"       : sortino,
        "Max DD"        : max_dd,
    }


# ── Tests estadísticos ───────────────────────────────────────
def diebold_mariano(ret_alt: pd.Series, ret_ref: pd.Series) -> tuple:
    """Test Diebold-Mariano (1995). H1: alternativa > benchmark."""
    loss_alt = -ret_alt.values
    loss_ref = -ret_ref.values
    d        = loss_alt - loss_ref
    d_bar    = d.mean()
    n        = len(d)
    gamma_0  = np.var(d, ddof=1)
    lags     = max(1, int(4 * (n / 100) ** (2 / 9)))
    gamma_sum = sum(
        (1 - l / (lags + 1)) * np.cov(d[l:], d[:-l])[0, 1]
        for l in range(1, lags + 1) if len(d[l:]) > 1
    )
    var_hac  = max((gamma_0 + 2 * gamma_sum) / n, 1e-12)
    dm_stat  = d_bar / np.sqrt(var_hac)
    p_value  = float(stats.norm.cdf(dm_stat))
    return float(dm_stat), p_value, float(d_bar)


def _stationary_bootstrap_indices(n: int, block_length: int, n_boot: int) -> np.ndarray:
    indices = np.zeros((n_boot, n), dtype=int)
    p = 1.0 / block_length
    rng = np.random.default_rng(42)
    for b in range(n_boot):
        pos = int(rng.integers(0, n))
        for t in range(n):
            indices[b, t] = pos % n
            if rng.random() < p:
                pos = int(rng.integers(0, n))
            else:
                pos += 1
    return indices


def whites_reality_check(
    retornos_alt_dict: dict,
    ret_ref: pd.Series,
    n_boot: int = 5000,
    block_length: int = 10,
) -> tuple:
    """White's Reality Check (2000). Bootstrap estacionario."""
    nombres = list(retornos_alt_dict.keys())
    n       = len(ret_ref)
    F       = np.array([retornos_alt_dict[k].values - ret_ref.values for k in nombres])
    f_bar   = F.mean(axis=1)
    V_obs   = float(f_bar.max())
    mejor   = nombres[int(f_bar.argmax())]

    boot_idx = _stationary_bootstrap_indices(n, block_length, n_boot)
    V_boot   = np.array([
        (F[:, boot_idx[b]].mean(axis=1) - f_bar).max()
        for b in range(n_boot)
    ])
    p_value = float((V_boot >= V_obs).mean())
    return p_value, V_obs, mejor, f_bar, nombres, V_boot


def hansens_spa(
    retornos_alt_dict: dict,
    ret_ref: pd.Series,
    n_boot: int = 5000,
    block_length: int = 10,
) -> tuple:
    """Hansen's SPA (2005). Versión consistente con truncamiento."""
    nombres = list(retornos_alt_dict.keys())
    n, K    = len(ret_ref), len(nombres)
    F       = np.array([retornos_alt_dict[k].values - ret_ref.values for k in nombres])
    f_bar   = F.mean(axis=1)
    lags    = max(1, int(4 * (n / 100) ** (2 / 9)))
    sigma2  = np.zeros(K)
    for k in range(K):
        d   = F[k]
        g0  = np.var(d, ddof=1)
        gs  = sum(
            (1 - l / (lags + 1)) * np.cov(d[l:], d[:-l])[0, 1]
            for l in range(1, lags + 1) if len(d[l:]) > 1
        )
        sigma2[k] = max(g0 + 2 * gs, 1e-12)
    sigma        = np.sqrt(sigma2 / n)
    umbral       = -np.sqrt(sigma2 * np.log(np.log(n)) / n)
    f_bar_trunc  = np.maximum(f_bar, umbral)
    T_obs        = float((f_bar_trunc / sigma).max())
    mejor        = nombres[int((f_bar_trunc / sigma).argmax())]

    boot_idx = _stationary_bootstrap_indices(n, block_length, n_boot)
    T_boot   = np.zeros(n_boot)
    for b in range(n_boot):
        fb      = F[:, boot_idx[b]].mean(axis=1)
        fc      = fb - np.maximum(f_bar, 0)
        T_boot[b] = float(np.maximum(fc, umbral - f_bar).max() / sigma.max())

    p_value     = float((T_boot >= T_obs).mean())
    sharpe_diff = f_bar / (np.std(F, axis=1, ddof=1) / np.sqrt(n) + 1e-12)
    return p_value, T_obs, mejor, f_bar, sigma, sharpe_diff, nombres, T_boot


# ── Callback streamlit para training ────────────────────────
def make_sb3_callback(progress_placeholder, metrics_placeholder,
                      total_timesteps: int):
    """
    Crea un BaseCallback de stable-baselines3 que actualiza
    un st.progress y métricas en tiempo real.
    """
    try:
        from stable_baselines3.common.callbacks import BaseCallback
    except ImportError:
        return None

    class StreamlitCallback(BaseCallback):
        def __init__(self):
            super().__init__(verbose=0)
            self.rewards_ep   = []
            self.alphas_ep    = []
            self._ep_reward   = 0.0
            self._ep_alphas   = []

        def _on_step(self):
            self._ep_reward += self.locals["rewards"][0]
            info = self.locals["infos"][0]
            if "alpha" in info:
                self._ep_alphas.append(info["alpha"])
            if self.locals["dones"][0]:
                self.rewards_ep.append(self._ep_reward)
                self.alphas_ep.append(
                    float(np.mean(self._ep_alphas)) if self._ep_alphas else np.nan
                )
                self._ep_reward = 0.0
                self._ep_alphas = []
            return True

    return StreamlitCallback()
