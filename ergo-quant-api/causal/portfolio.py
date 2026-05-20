"""
causal/portfolio.py — Motor de optimización de portafolios
Módulo 2 del Sistema de Inversión.

Estrategias implementadas:
  · Markowitz (Max Sharpe + Min Varianza + Frontera Eficiente)
  · HRP  — Hierarchical Risk Parity (López de Prado, 2016)
  · RA-HRP — Risk-Adjusted HRP por Sharpe (Noguer i Alonso, 2025)
  · HERC — Hierarchical ERC: Var · CVaR · CDaR (Raffinot, 2018)

Estimadores de covarianza:
  Muestral · EWMA · Ledoit-Wolf · Gerber+MAD · MP Denoised
"""

import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage, leaves_list, fcluster, dendrogram as _sp_dendrogram
from scipy.spatial.distance import squareform
from scipy.optimize import minimize
from sklearn.covariance import LedoitWolf
from sklearn.metrics import silhouette_score


# ════════════════════════════════════════════════════════════
# DESCARGA DE RETORNOS
# ════════════════════════════════════════════════════════════

def download_returns(tickers: tuple, start_date: str, end_date: str) -> pd.DataFrame:
    """Descarga precios de yfinance y devuelve retornos diarios limpios."""
    import yfinance as yf

    data = yf.download(list(tickers), start=start_date, end=end_date,
                       auto_adjust=True, progress=False)
    if data.empty:
        return pd.DataFrame()

    if isinstance(data.columns, pd.MultiIndex):
        prices = data["Close"] if "Close" in data.columns.get_level_values(0) else data.iloc[:, 0]
    else:
        prices = data[["Close"]] if "Close" in data.columns else data

    if isinstance(prices, pd.Series):
        prices = prices.to_frame()

    prices = prices.dropna(how="all").ffill().bfill()

    # Eliminar activos con historia insuficiente (< 1 año)
    ok = prices.notna().sum() >= 252
    prices = prices.loc[:, ok]
    if prices.empty:
        return pd.DataFrame()

    ret = prices.pct_change().dropna()
    # Quitar columnas con nombre igual al ticker si es multiindex residual
    if isinstance(ret.columns, pd.MultiIndex):
        ret.columns = ret.columns.get_level_values(-1)
    return ret


# ════════════════════════════════════════════════════════════
# ESTIMADORES DE COVARIANZA  (todos en escala diaria)
# ════════════════════════════════════════════════════════════

def cov_sample(df: pd.DataFrame) -> pd.DataFrame:
    return df.cov()


def cov_ewma(df: pd.DataFrame, lam: float = 0.94) -> pd.DataFrame:
    span = 2 / (1 - lam) - 1
    ewma_all = df.ewm(span=span, adjust=False).cov()
    last = ewma_all.index.get_level_values(0)[-1]
    return ewma_all.loc[last]


def cov_lw(df: pd.DataFrame) -> pd.DataFrame:
    clean = df.dropna(axis=1, how="all")
    lw = LedoitWolf()
    lw.fit(clean)
    return pd.DataFrame(lw.covariance_, index=clean.columns, columns=clean.columns)


def cov_gerber(df: pd.DataFrame, h: float = 0.5) -> pd.DataFrame:
    assets = df.columns
    N = len(assets)
    mad = df.apply(lambda x: (x - x.median()).abs().median())
    thr = h * mad
    G = np.zeros((N, N))
    for i in range(N):
        for j in range(i, N):
            xi = df.iloc[:, i].values
            xj = df.iloc[:, j].values
            si = np.where(xi > thr.iloc[i], 1, np.where(xi < -thr.iloc[i], -1, 0))
            sj = np.where(xj > thr.iloc[j], 1, np.where(xj < -thr.iloc[j], -1, 0))
            mask = (si != 0) & (sj != 0)
            nm = mask.sum()
            if nm == 0:
                G[i, j] = G[j, i] = 0.0
                continue
            nc = int(((si == 1) & (sj == 1))[mask].sum() + ((si == -1) & (sj == -1))[mask].sum())
            nd = int(((si == 1) & (sj == -1))[mask].sum() + ((si == -1) & (sj == 1))[mask].sum())
            denom = nc + nd
            val = (nc - nd) / denom if denom > 0 else 0.0
            G[i, j] = G[j, i] = val
    np.fill_diagonal(G, 1.0)
    std = df.std().values
    cov = G * np.outer(std, std)
    return pd.DataFrame(cov, index=assets, columns=assets)


def marchenko_pastur_denoise(df: pd.DataFrame) -> pd.DataFrame:
    T, N = df.shape
    q = T / N
    std = df.std().values
    corr = df.corr().values
    evals, evecs = np.linalg.eigh(corr)
    idx = evals.argsort()[::-1]
    evals, evecs = evals[idx], evecs[:, idx]
    lmax = (1 + np.sqrt(1 / q)) ** 2
    n_sig = max(1, int((evals > lmax).sum()))
    den = evals.copy()
    if n_sig < N:
        den[n_sig:] = den[n_sig:].mean()
    corr_d = evecs @ np.diag(den) @ evecs.T
    d = np.sqrt(np.diag(corr_d))
    corr_d /= np.outer(d, d)
    np.fill_diagonal(corr_d, 1.0)
    corr_d = (corr_d + corr_d.T) / 2
    cov_d = corr_d * np.outer(std, std)
    return pd.DataFrame(cov_d, index=df.columns, columns=df.columns)


COV_METHODS = {
    "MP Denoised"  : marchenko_pastur_denoise,
    "Ledoit-Wolf"  : cov_lw,
    "EWMA (λ=0.94)": cov_ewma,
    "Gerber+MAD"   : cov_gerber,
    "Muestral"     : cov_sample,
}


def compute_cov(df: pd.DataFrame, method: str = "MP Denoised") -> pd.DataFrame:
    """Devuelve matriz de covarianza ANUALIZADA (×252, datos diarios)."""
    fn = COV_METHODS.get(method, marchenko_pastur_denoise)
    return fn(df) * 252


# ════════════════════════════════════════════════════════════
# MÉTRICAS DE PORTAFOLIO  (HPR como bloque atómico)
# ════════════════════════════════════════════════════════════

FREQ = 252  # días de trading por año

def portfolio_metrics(weights: pd.Series, df_ret: pd.DataFrame, rf: float = 0.043) -> dict:
    """
    Métricas de portafolio.

    HPR diario:  r_t = Σ w_i · r_{i,t}
    A_inicial = 1  →  A_final = Π(1 + r_t)
    CAGR = (A_final / A_inicial)^(1 / años) − 1
    donde años = días calendario / 365.25
    """
    w = weights.reindex(df_ret.columns, fill_value=0.0).values
    serie = df_ret.values @ w

    # Curva de riqueza: A_t = A_0 · Π(1 + r_s) para s ≤ t
    cum      = pd.Series((1 + serie), index=df_ret.index).cumprod()
    A_inicial = 1.0
    A_final   = float(cum.iloc[-1])
    hpr_total = A_final - A_inicial          # rendimiento compuesto total

    # Años en días calendario reales (más preciso que T/252)
    n_anios = (df_ret.index[-1] - df_ret.index[0]).days / 365.25
    n_anios = max(n_anios, 1 / 365.25)      # evitar división por cero

    # CAGR: fórmula exacta (A_final/A_inicial)^(1/años) − 1
    cagr = (A_final / A_inicial) ** (1 / n_anios) - 1

    vol_ann  = serie.std() * np.sqrt(FREQ)
    sharpe   = (cagr - rf) / vol_ann if vol_ann > 0 else np.nan

    neg      = serie[serie < 0]
    downside = neg.std() * np.sqrt(FREQ) if len(neg) > 1 else np.nan
    sortino  = (cagr - rf) / downside if (downside and downside > 0) else np.nan

    dd     = (cum - cum.cummax()) / cum.cummax()
    max_dd = float(dd.min())

    sspw = float((weights.reindex(df_ret.columns, fill_value=0) ** 2).sum())

    return {
        "Retorno"    : cagr,
        "HPR_total"  : hpr_total,
        "A_final"    : A_final,
        "n_years"    : n_anios,
        "Volatilidad": vol_ann,
        "Sharpe"     : sharpe,
        "Sortino"    : sortino,
        "Max DD"     : max_dd,
        "SSPW"       : sspw,
        "cum_series" : cum,
    }


# ════════════════════════════════════════════════════════════
# MARKOWITZ (Media-Varianza)
# ════════════════════════════════════════════════════════════

def run_markowitz(df_ret: pd.DataFrame, cov_ann: pd.DataFrame,
                  rf: float = 0.043, weight_bounds: tuple = (0.02, 0.30)) -> dict:
    """
    Portafolio Max Sharpe, Mínima Varianza y Frontera Eficiente.
    Requiere PyPortfolioOpt (pypfopt).
    """
    try:
        from pypfopt import EfficientFrontier
    except ImportError:
        return {"error": "PyPortfolioOpt no instalado. Ejecuta: pip install pypfopt cvxpy"}

    mu = df_ret.mean() * 12

    # Si ningún activo supera rf, bajar rf al 90% del retorno máximo
    if mu.max() <= rf:
        rf = float(mu.max()) * 0.9

    try:
        # Max Sharpe
        ef_ms = EfficientFrontier(mu, cov_ann, weight_bounds=weight_bounds)
        ef_ms.max_sharpe(risk_free_rate=rf)
        w_ms = pd.Series(ef_ms.clean_weights())
        ret_ms, vol_ms, sr_ms = ef_ms.portfolio_performance(risk_free_rate=rf)
    except Exception as e:
        return {"error": f"Max Sharpe falló: {e}", "max_sharpe": None, "min_var": None,
                "frontier": {"vols": [], "rets": [], "sharpes": []}}

    try:
        # Min Varianza
        ef_mv = EfficientFrontier(mu, cov_ann, weight_bounds=weight_bounds)
        ef_mv.min_volatility()
        w_mv = pd.Series(ef_mv.clean_weights())
        ret_mv, vol_mv, _ = ef_mv.portfolio_performance(risk_free_rate=rf)
    except Exception as e:
        return {"error": f"Min Varianza falló: {e}", "max_sharpe": None, "min_var": None,
                "frontier": {"vols": [], "rets": [], "sharpes": []}}

    # Frontera eficiente (60 puntos)
    targets = np.linspace(float(mu.min()), ret_ms * 1.1, 60)
    frontier = {"vols": [], "rets": [], "sharpes": []}
    for r in targets:
        try:
            ef = EfficientFrontier(mu, cov_ann, weight_bounds=weight_bounds)
            ef.efficient_return(r)
            ret_f, vol_f, sr_f = ef.portfolio_performance(risk_free_rate=rf)
            frontier["vols"].append(vol_f)
            frontier["rets"].append(ret_f)
            frontier["sharpes"].append(sr_f)
        except Exception:
            continue

    return {
        "max_sharpe": {
            "weights": w_ms, "ret": ret_ms, "vol": vol_ms, "sr": sr_ms,
            "metrics": portfolio_metrics(w_ms, df_ret, rf),
        },
        "min_var": {
            "weights": w_mv, "ret": ret_mv, "vol": vol_mv,
            "metrics": portfolio_metrics(w_mv, df_ret, rf),
        },
        "frontier": frontier,
        "error": None,
    }


# ════════════════════════════════════════════════════════════
# HRP — Hierarchical Risk Parity
# ════════════════════════════════════════════════════════════

def _hrp_cluster_var(cov_sub: np.ndarray) -> float:
    inv_diag = 1.0 / np.diag(cov_sub)
    w = inv_diag / inv_diag.sum()
    return float(w @ cov_sub @ w)


def _hrp_bisect(cov_df: pd.DataFrame, assets: list) -> pd.Series:
    pesos = pd.Series(1.0, index=assets)
    clusters = [assets]
    while clusters:
        clusters = [
            cluster[j:k]
            for cluster in clusters
            for j, k in ((0, len(cluster)//2), (len(cluster)//2, len(cluster)))
            if len(cluster) > 1
        ]
        for i in range(0, len(clusters), 2):
            if i + 1 >= len(clusters):
                break
            izq, der = clusters[i], clusters[i+1]
            v_i = _hrp_cluster_var(cov_df.loc[izq, izq].values)
            v_d = _hrp_cluster_var(cov_df.loc[der, der].values)
            alpha = v_d / (v_i + v_d)
            pesos[izq] *= alpha
            pesos[der] *= (1 - alpha)
    return pesos / pesos.sum()


def run_hrp(df_ret: pd.DataFrame, cov_ann: pd.DataFrame,
            window_corr: int = 504) -> dict:
    """
    HRP bisección top-down (López de Prado, 2016).
    Distancia de Mantegna, Single Linkage.
    """
    window     = df_ret.iloc[-window_corr:] if len(df_ret) > window_corr else df_ret
    _corr_base = window.corr()
    _corr_arr  = _corr_base.clip(-1, 1).to_numpy().copy()
    np.fill_diagonal(_corr_arr, 1.0)
    _corr_arr  = (_corr_arr + _corr_arr.T) / 2
    corr       = pd.DataFrame(_corr_arr, index=_corr_base.index, columns=_corr_base.columns)

    dist = np.sqrt(2 * (1 - _corr_arr).clip(0))
    np.fill_diagonal(dist, 0.0)

    Z = linkage(squareform(dist), method="single")
    order = list(leaves_list(Z))
    assets_ord = [corr.columns[i] for i in order]

    weights = _hrp_bisect(cov_ann, assets_ord)

    n = len(cov_ann)
    w_ew = pd.Series(1/n, index=cov_ann.index)
    inv_v = 1.0 / np.diag(cov_ann.values)
    w_iv = pd.Series(inv_v / inv_v.sum(), index=cov_ann.index)

    return {
        "weights"   : weights,
        "w_ew"      : w_ew,
        "w_iv"      : w_iv,
        "order"     : order,
        "assets_ord": assets_ord,
        "corr"      : corr,
        "dist"      : pd.DataFrame(dist, index=corr.index, columns=corr.columns),
        "linkage"   : Z,
        "metrics"   : portfolio_metrics(weights, df_ret),
        "metrics_ew": portfolio_metrics(w_ew, df_ret),
        "metrics_iv": portfolio_metrics(w_iv, df_ret),
        "error"     : None,
    }


# ════════════════════════════════════════════════════════════
# RA-HRP — Risk-Adjusted HRP por Sharpe
# ════════════════════════════════════════════════════════════

def _rahrp_iv_weights(assets: list, cov: pd.DataFrame) -> np.ndarray:
    diag = np.diag(cov.loc[assets, assets].values)
    inv_v = 1.0 / diag
    return inv_v / inv_v.sum()


def _rahrp_sharpe(assets: list, df_ret: pd.DataFrame, cov: pd.DataFrame, rf: float) -> float:
    w = _rahrp_iv_weights(assets, cov)
    rp = df_ret[assets].values @ w
    ret_a = rp.mean() * 12
    vol_a = rp.std() * np.sqrt(12)
    return (ret_a - rf) / vol_a if vol_a > 0 else 0.0


def _rahrp_var(assets: list, cov: pd.DataFrame) -> float:
    w = _rahrp_iv_weights(assets, cov)
    sub = cov.loc[assets, assets].values
    return float(w @ sub @ w)


def _rahrp_bisect(assets: list, df_ret: pd.DataFrame, cov: pd.DataFrame, rf: float,
                   signal_fn=None) -> pd.Series:
    """
    Bisección top-down.
    signal_fn(items) -> float: señal de calidad del cluster (mayor = más peso).
    Si es None, usa Sharpe histórico IV-ponderado (modo base).
    """
    pesos = pd.Series(1.0, index=assets)

    def _rec(items):
        if len(items) <= 1:
            return
        mid = len(items) // 2
        izq, der = items[:mid], items[mid:]

        if signal_fn is not None:
            sr_i = signal_fn(izq)
            sr_d = signal_fn(der)
        else:
            sr_i = _rahrp_sharpe(izq, df_ret, cov, rf)
            sr_d = _rahrp_sharpe(der, df_ret, cov, rf)

        if sr_i > 0 and sr_d > 0:
            total = sr_i + sr_d
            w_izq = sr_i / total
        else:
            v_i = _rahrp_var(izq, cov)
            v_d = _rahrp_var(der, cov)
            total = (1/v_i) + (1/v_d)
            w_izq = (1/v_i) / total  # fallback HRP

        pesos[izq] *= w_izq
        pesos[der] *= (1 - w_izq)
        _rec(izq)
        _rec(der)

    _rec(assets)
    return pesos / pesos.sum()


def run_rahrp(df_ret: pd.DataFrame, cov_ann: pd.DataFrame,
              rf: float = 0.043, window_corr: int = 504,
              score_ldp: dict = None) -> dict:
    """
    RA-HRP: bisección proporcional al Sharpe por cluster IV-weighted.
    Si score_ldp es un dict {ticker: score}, usa el Score LdP promedio
    del cluster como señal de bisección (modo causal anclado al Módulo 1).
    Fallback a varianza inversa cuando la señal ≤ 0.
    """
    std_a     = np.sqrt(np.diag(cov_ann.values))
    _corr_arr = (cov_ann.values / np.outer(std_a, std_a)).copy()
    np.fill_diagonal(_corr_arr, 1.0)
    corr = pd.DataFrame(_corr_arr, index=cov_ann.index, columns=cov_ann.columns)

    dist = np.sqrt(2 * (1 - _corr_arr).clip(0))
    np.fill_diagonal(dist, 0.0)

    Z = linkage(squareform(dist), method="single")
    order = list(leaves_list(Z))
    assets_ord = [corr.columns[i] for i in order]

    if score_ldp is not None:
        # Señal causal: Score LdP promedio ponderado por IV dentro del cluster
        def _signal_causal(items):
            iv_w = _rahrp_iv_weights(items, cov_ann)
            vals = np.array([score_ldp.get(a, 0.0) for a in items])
            return float(np.dot(iv_w, vals))
        signal_fn = _signal_causal
    else:
        signal_fn = None

    weights = _rahrp_bisect(assets_ord, df_ret, cov_ann, rf, signal_fn=signal_fn)

    mu_ann = df_ret.mean() * 12
    vol_ann = pd.Series(std_a, index=cov_ann.columns)
    sharpe_by_asset = (mu_ann - rf) / vol_ann

    return {
        "weights"         : weights,
        "order"           : order,
        "assets_ord"      : assets_ord,
        "corr"            : corr,
        "linkage"         : Z,
        "sharpe_by_asset" : sharpe_by_asset,
        "score_ldp"       : score_ldp,
        "signal_mode"     : "causal_ldp" if score_ldp is not None else "sharpe_iv",
        "metrics"         : portfolio_metrics(weights, df_ret, rf),
        "error"           : None,
    }


# ════════════════════════════════════════════════════════════
# HERC — Hierarchical Equal Risk Contribution
# Variantes: Var · CVaR · CDaR
# ════════════════════════════════════════════════════════════

def _erc_weights(cov_sub: np.ndarray) -> np.ndarray:
    n = len(cov_sub)
    if n == 1:
        return np.array([1.0])

    def obj(w):
        w = np.maximum(w, 1e-8)
        sigma = np.sqrt(w @ cov_sub @ w)
        mrc = cov_sub @ w / sigma
        rc = w * mrc
        return sum((rc[i] - rc[j])**2 for i in range(n) for j in range(i+1, n))

    res = minimize(obj, np.ones(n)/n, method="SLSQP",
                   bounds=[(0.001, 1.0)]*n,
                   constraints=[{"type": "eq", "fun": lambda w: w.sum()-1}],
                   options={"ftol": 1e-12, "maxiter": 1000})
    w = np.maximum(res.x, 0)
    return w / w.sum()


def _risk_var(ret_cl: np.ndarray) -> float:
    w = np.ones(ret_cl.shape[1]) / ret_cl.shape[1]
    cov_cl = np.cov(ret_cl.T)
    return float(w @ cov_cl @ w) if cov_cl.ndim > 0 else float(cov_cl)


def _risk_cvar(ret_cl: np.ndarray, alpha: float = 0.05) -> float:
    w = np.ones(ret_cl.shape[1]) / ret_cl.shape[1]
    rp = ret_cl @ w
    var_val = np.percentile(rp, alpha * 100)
    tail = rp[rp <= var_val]
    return float(-tail.mean()) if len(tail) > 0 else 0.0


def _risk_cdar(ret_cl: np.ndarray, alpha: float = 0.05) -> float:
    w = np.ones(ret_cl.shape[1]) / ret_cl.shape[1]
    rp = pd.Series(ret_cl @ w)
    cum = (1 + rp).cumprod()
    dd = (cum - cum.cummax()) / cum.cummax()
    thresh = np.percentile(dd, alpha * 100)
    tail = dd[dd <= thresh]
    return float(-tail.mean()) if len(tail) > 0 else 0.0


def _herc_bisect(cov: pd.DataFrame, df_ret: pd.DataFrame, assets_ord: list,
                 cluster_labels: list, k_opt: int, medida: str, alpha: float) -> pd.Series:
    pesos = pd.Series(1.0, index=assets_ord)

    def get_risk(act):
        ret_cl = df_ret[act].values
        if ret_cl.ndim == 1:
            ret_cl = ret_cl.reshape(-1, 1)
        if ret_cl.shape[1] == 1:
            if medida == "var":
                return float(cov.loc[act[0], act[0]])
            return _risk_cvar(ret_cl, alpha) if medida == "cvar" else _risk_cdar(ret_cl, alpha)
        if medida == "var":
            return _risk_var(ret_cl)
        elif medida == "cvar":
            return _risk_cvar(ret_cl, alpha)
        else:
            return _risk_cdar(ret_cl, alpha)

    def bisect(lista):
        if len(lista) <= 1:
            return
        mid = len(lista) // 2
        izq, der = lista[:mid], lista[mid:]
        r_i = get_risk(izq)
        r_d = get_risk(der)
        total = r_i + r_d
        a_i = r_d / total if total > 0 else 0.5  # inverso: más riesgo → menos peso
        pesos[izq] *= a_i
        pesos[der] *= (1 - a_i)
        bisect(izq)
        bisect(der)

    bisect(assets_ord)

    # ERC intra-cluster
    for ki in range(1, k_opt + 1):
        miembros = [a for a, c in zip(assets_ord, cluster_labels) if c == ki]
        if len(miembros) > 1:
            cov_sub = cov.loc[miembros, miembros].values
            w_erc = _erc_weights(cov_sub)
            peso_cl = pesos[miembros].sum()
            pesos[miembros] = w_erc * peso_cl

    return pesos / pesos.sum()


def run_herc(df_ret: pd.DataFrame, cov_ann: pd.DataFrame, alpha: float = 0.05) -> dict:
    """
    HERC con Ward Linkage + K óptimo (Silhouette).
    Devuelve dict con HERC-Var, HERC-CVaR, HERC-CDaR.
    """
    std_a     = np.sqrt(np.diag(cov_ann.values))
    _corr_arr = (cov_ann.values / np.outer(std_a, std_a)).copy()
    np.fill_diagonal(_corr_arr, 1.0)
    _corr_arr = (_corr_arr + _corr_arr.T) / 2
    corr      = pd.DataFrame(_corr_arr, index=cov_ann.index, columns=cov_ann.columns)

    dist = np.sqrt(2 * (1 - _corr_arr).clip(0))
    np.fill_diagonal(dist, 0.0)

    Z = linkage(squareform(dist), method="ward")
    order = list(leaves_list(Z))
    assets_ord = [corr.columns[i] for i in order]

    # Número óptimo de clusters por Silhouette
    n = len(cov_ann)
    sil_scores = {}
    for k in range(2, min(8, n)):
        lbls = fcluster(Z, k, criterion="maxclust")
        try:
            sil = silhouette_score(dist, lbls, metric="precomputed")
            sil_scores[k] = float(sil)
        except Exception:
            pass
    k_opt = max(sil_scores, key=sil_scores.get) if sil_scores else 2

    labels = fcluster(Z, k_opt, criterion="maxclust")
    labels_ord = [int(labels[list(corr.columns).index(a)]) for a in assets_ord]

    results = {}
    for medida, key in [("var", "HERC-Var"), ("cvar", "HERC-CVaR"), ("cdar", "HERC-CDaR")]:
        try:
            w = _herc_bisect(cov_ann, df_ret, assets_ord, labels_ord, k_opt, medida, alpha)
            results[key] = {"weights": w, "metrics": portfolio_metrics(w, df_ret), "error": None}
        except Exception as e:
            results[key] = {"weights": pd.Series(dtype=float), "metrics": {}, "error": str(e)}

    # Composición de clusters
    clusters_comp = {}
    for ki in range(1, k_opt + 1):
        clusters_comp[ki] = [a for a, c in zip(assets_ord, labels_ord) if c == ki]

    return {
        **results,
        "order"          : order,
        "assets_ord"     : assets_ord,
        "corr"           : corr,
        "dist"           : pd.DataFrame(dist, index=corr.index, columns=corr.columns),
        "linkage"        : Z,
        "k_optimal"      : k_opt,
        "sil_scores"     : sil_scores,
        "cluster_labels" : labels_ord,
        "clusters_comp"  : clusters_comp,
        "error"          : None,
    }
