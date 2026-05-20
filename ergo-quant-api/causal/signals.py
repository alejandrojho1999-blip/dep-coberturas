# ============================================================
# signals.py — Señal trimestral de cambio de tratamiento
#              (input para el Agente PPO — Módulo 3)
# ============================================================

import numpy as np
import pandas as pd
from typing import Optional


def compute_treatment_signal(
    treatment_series: pd.Series,
    window_historical: int = 20,
) -> dict:
    """
    Dado el histórico del tratamiento, calcula la señal actual.

    Devuelve:
        current_value   : valor del último mes disponible
        prev_q_value    : valor de hace 3 meses (inicio trimestre anterior)
        quarterly_change: cambio absoluto trimestral
        zscore_level    : z-score del nivel actual vs histórico (window_historical meses)
        zscore_change   : z-score del cambio trimestral vs histórico de cambios
        direction       : "BULLISH" | "BEARISH" | "NEUTRAL"
        magnitude       : "HIGH" | "MEDIUM" | "LOW"
        regime_changed  : True si zscore_change > 1.5 (cambio significativo)
    """
    s = treatment_series.dropna()
    if len(s) < 6:
        return _empty_signal()

    current  = float(s.iloc[-1])
    prev_q   = float(s.iloc[-4]) if len(s) >= 4 else float(s.iloc[0])
    q_change = current - prev_q

    # Z-score del nivel actual
    hist = s.iloc[-window_historical:]
    mu_lvl, std_lvl = hist.mean(), hist.std()
    z_level = (current - mu_lvl) / std_lvl if std_lvl > 1e-10 else 0.0

    # Z-score del cambio trimestral vs cambios históricos
    q_changes = s.diff(3).dropna()
    if len(q_changes) >= 4:
        mu_ch, std_ch = q_changes.mean(), q_changes.std()
        z_change = (q_change - mu_ch) / std_ch if std_ch > 1e-10 else 0.0
    else:
        z_change = 0.0

    # Dirección (basada en z_change)
    if z_change > 0.5:
        direction = "BULLISH"
    elif z_change < -0.5:
        direction = "BEARISH"
    else:
        direction = "NEUTRAL"

    # Magnitud
    abs_z = abs(z_change)
    if abs_z >= 2.0:
        magnitude = "HIGH"
    elif abs_z >= 1.0:
        magnitude = "MEDIUM"
    else:
        magnitude = "LOW"

    return {
        "current_value"   : round(current, 4),
        "prev_q_value"    : round(prev_q, 4),
        "quarterly_change": round(q_change, 4),
        "zscore_level"    : round(z_level, 3),
        "zscore_change"   : round(z_change, 3),
        "direction"       : direction,
        "magnitude"       : magnitude,
        "regime_changed"  : abs(z_change) > 1.5,
        "last_date"       : str(s.index[-1].date()),
    }


def compute_all_signals(
    configs: dict,
    df_macro: pd.DataFrame,
    treatment_overrides: Optional[dict] = None,
) -> pd.DataFrame:
    """
    Calcula señales trimestrales para todos los activos del universo.

    treatment_overrides: {ticker: pd.Series} para tratamientos custom (AI_CapEx_Proxy)

    Devuelve DataFrame con una fila por activo.
    """
    rows = []
    overrides = treatment_overrides or {}

    for ticker, cfg in configs.items():
        treatment_name = cfg["treatment"]

        # Obtener la serie de tratamiento
        if ticker in overrides and not overrides[ticker].empty:
            t_series = overrides[ticker]
        elif treatment_name in df_macro.columns:
            t_series = df_macro[treatment_name].dropna()
        else:
            t_series = pd.Series(dtype=float)

        signal = compute_treatment_signal(t_series)
        signal["ticker"]       = ticker
        signal["name"]         = cfg["name"]
        signal["treatment_var"] = treatment_name
        signal["canal"]        = cfg.get("canal", "")
        rows.append(signal)

    df = pd.DataFrame(rows)
    if not df.empty:
        cols_front = ["ticker", "name", "treatment_var", "direction", "magnitude",
                      "regime_changed", "current_value", "quarterly_change",
                      "zscore_change", "zscore_level", "last_date", "canal"]
        cols_front = [c for c in cols_front if c in df.columns]
        df = df[cols_front + [c for c in df.columns if c not in cols_front]]
    return df


def _empty_signal() -> dict:
    return {
        "current_value"   : np.nan,
        "prev_q_value"    : np.nan,
        "quarterly_change": np.nan,
        "zscore_level"    : np.nan,
        "zscore_change"   : np.nan,
        "direction"       : "SIN DATOS",
        "magnitude"       : "N/A",
        "regime_changed"  : False,
        "last_date"       : "N/A",
    }


def treatment_history_df(treatment_series: pd.Series, n_quarters: int = 12) -> pd.DataFrame:
    """Devuelve DataFrame con historial de tratamiento + señal para graficar."""
    s = treatment_series.dropna()
    if s.empty:
        return pd.DataFrame()

    df = pd.DataFrame({"value": s})
    df["q_change"]   = df["value"].diff(3)
    df["rolling_mu"] = df["value"].rolling(window=20, min_periods=8).mean()
    df["rolling_std"]= df["value"].rolling(window=20, min_periods=8).std()
    df["zscore"]     = (df["value"] - df["rolling_mu"]) / df["rolling_std"].replace(0, np.nan)

    return df.tail(n_quarters * 3)  # ~3 meses por trimestre
