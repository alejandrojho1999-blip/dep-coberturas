# ============================================================
# data.py — Descarga y preparación de datos macro + activos
# ============================================================

import io
import time
import warnings
from typing import Optional

import numpy as np
import pandas as pd
import requests
import yfinance as yf

warnings.filterwarnings("ignore")


def _fred_get(fred_client, series_id: str, start: str, retries: int = 3) -> Optional[pd.Series]:
    for attempt in range(retries):
        try:
            s = fred_client.get_series(series_id, observation_start=start)
            s = s.resample("MS").last().replace(0, np.nan)
            return s
        except Exception as e:
            msg = str(e)
            if "Bad Request" in msg or "does not exist" in msg:
                return None
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
    return None


def download_gpr(start_date: str = "2010-01-01") -> pd.Series:
    """
    Descarga el Índice de Riesgo Geopolítico (GPR) de Caldara & Iacoviello.
    Fuente: matteoiacoviello.com/gpr_files/data_gpr_daily_recent.xls
    Columnas del archivo: date (datetime), GPRD (float diario).
    Retorna cambio porcentual mensual (GPR_CHANGE). Serie vacía si falla.
    """
    url = "https://matteoiacoviello.com/gpr_files/data_gpr_daily_recent.xls"
    try:
        resp = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        df_raw = pd.read_excel(io.BytesIO(resp.content), usecols=["date", "GPRD"])
    except Exception:
        return pd.Series(dtype=float, name="GPR_CHANGE")

    if df_raw.empty or "GPRD" not in df_raw.columns:
        return pd.Series(dtype=float, name="GPR_CHANGE")

    df_raw["date"] = pd.to_datetime(df_raw["date"], errors="coerce")
    df_raw = df_raw.dropna().set_index("date").sort_index()

    # Promedio mensual → cambio porcentual mensual
    gpr_monthly = (
        df_raw["GPRD"]
        .resample("MS").mean()
        .loc[start_date:]
        .dropna()
    )

    if len(gpr_monthly) < 6:
        return pd.Series(dtype=float, name="GPR_CHANGE")

    gpr_change = gpr_monthly.pct_change().dropna()
    gpr_change.name = "GPR_CHANGE"
    return gpr_change


def download_macro(fred_key: str, start_date: str = "2010-01-01") -> pd.DataFrame:
    """Descarga FRED + yfinance y devuelve df_macro con series transformadas."""
    from fredapi import Fred
    from causal.config import FRED_SERIES, YF_SERIES

    fred = Fred(api_key=fred_key)

    # ── FRED ────────────────────────────────────────────────
    raw_fred: dict = {}
    for fid, cname in FRED_SERIES.items():
        time.sleep(0.3)
        s = _fred_get(fred, fid, start_date)
        if s is not None and s.dropna().shape[0] > 0:
            raw_fred[cname] = s

    df_fred = pd.DataFrame(raw_fred)

    # ── yfinance ─────────────────────────────────────────────
    raw_yf: dict = {}
    for ytick, cname in YF_SERIES.items():
        try:
            time.sleep(0.2)
            r = yf.download(ytick, start=start_date, interval="1mo",
                            auto_adjust=True, progress=False)
            if not r.empty:
                # yfinance ≥0.2.40 puede devolver MultiIndex en columnas
                close = r["Close"]
                if isinstance(close, pd.DataFrame):
                    close = close.squeeze()
                s_yf = close.resample("MS").last()
                # Eliminar timezone para alinear con índice FRED (naive)
                if s_yf.index.tz is not None:
                    s_yf.index = s_yf.index.tz_convert(None)
                s_yf.index = s_yf.index.normalize()
                raw_yf[cname] = s_yf
        except Exception:
            pass

    # ── Construcción df_macro ────────────────────────────────
    # Normalizar índice FRED a timezone-naive month-start.
    # Si df_fred está vacío (todas las series FRED fallaron) el índice es RangeIndex,
    # que no tiene .tz → crear date_range explícito para que yfinance pueda unirse.
    fred_idx = df_fred.index
    if isinstance(fred_idx, pd.DatetimeIndex):
        if fred_idx.tz is not None:
            fred_idx = fred_idx.tz_convert(None)
        fred_idx = fred_idx.normalize()
    else:
        fred_idx = pd.date_range(start=start_date, end=pd.Timestamp.today().normalize(), freq="MS")
    df = pd.DataFrame(index=fred_idx)

    for col in ["FEDFUNDS", "DGS10", "DGS2", "REAL_YIELD_10Y", "CREDIT_SPREAD", "TED_SPREAD"]:
        if col in df_fred.columns:
            df[col] = df_fred[col]
            df[f"{col}_CHANGE"] = df_fred[col].diff()

    if {"DGS10", "DGS2"}.issubset(df.columns):
        df["YIELD_SPREAD"] = df["DGS10"] - df["DGS2"]
        df["YIELD_SPREAD_CHANGE"] = df["YIELD_SPREAD"].diff()

    for raw_col, yoy_col in [("CPI_LEVEL", "CPI_YoY"), ("CORE_CPI_LEVEL", "Core_CPI_YoY"), ("PCE_LEVEL", "PCE_YoY")]:
        if raw_col in df_fred.columns:
            df[yoy_col] = df_fred[raw_col].pct_change(12) * 100

    for col in ["UNRATE", "CONSUMER_SENT"]:
        if col in df_fred.columns:
            df[col] = df_fred[col]

    if "INDPRO_LEVEL" in df_fred.columns:
        df["INDPRO_YoY"] = df_fred["INDPRO_LEVEL"].pct_change(12) * 100

    if "WTI_RAW" in df_fred.columns:
        df["CRUDE_OIL_Change"] = df_fred["WTI_RAW"].pct_change()

    # GPR descargado directamente de Caldara & Iacoviello (no disponible en FRED)
    gpr_series = download_gpr(start_date)
    if not gpr_series.empty:
        gpr_aligned = gpr_series.reindex(df.index)
        if hasattr(gpr_aligned.index, "tz") and gpr_aligned.index.tz is not None:
            gpr_aligned.index = gpr_aligned.index.tz_convert(None)
        df["GPR_CHANGE"] = gpr_aligned

    if "DEFICIT_MONTHLY" in df_fred.columns:
        df["DEFICIT_MONTHLY"] = df_fred["DEFICIT_MONTHLY"]

    if "ELECTRICITY_PROD" in df_fred.columns:
        df["ELEC_YoY"] = df_fred["ELECTRICITY_PROD"].pct_change(12) * 100

    # Producción industrial semiconductores YoY% (FRED: IPG3344S)
    if "SEMI_PROD_LEVEL" in df_fred.columns:
        df["SEMI_PROD_YoY"] = df_fred["SEMI_PROD_LEVEL"].pct_change(12) * 100

    # Gasto en construcción EE.UU. YoY% (FRED: TTLCONS)
    if "TOTCON_LEVEL" in df_fred.columns:
        df["TOTCON_YoY"] = df_fred["TOTCON_LEVEL"].pct_change(12) * 100

    # CPI Alimentos: cambio % mensual (ya estacionario — no diferenciar más)
    if "CPI_Food_LEVEL" in df_fred.columns:
        df["CPI_Food_Change"] = df_fred["CPI_Food_LEVEL"].pct_change()

    # VIX: nivel (no retorno)
    if "VIX" in df_fred.columns:
        df["VIX"] = df_fred["VIX"]

    # yfinance: retornos porcentuales mensuales
    for cname, s in raw_yf.items():
        if cname == "BRL_LEVEL":
            # BRL=X en yf da precio del BRL en USD; pct_change positivo = BRL aprecia
            df["BRL_Change"] = s.pct_change()
        else:
            df[cname] = s.pct_change()

    return df.dropna(how="all")


def build_ai_capex_proxy(hyperscalers: tuple, start_date: str = "2010-01-01") -> pd.Series:
    """
    Construye AI CapEx Proxy = ΔCapEx YoY% de los hyperscalers indicados.

    Estrategia:
    1. Tasas YoY trimestrales: pct_change(4) sobre niveles trimestales  → 1 punto (el más reciente)
    2. Tasas YoY anuales:      pct_change(1) sobre niveles anuales       → 3 puntos (2023-2025)
    3. Combinar tasas YoY (misma escala: % cambio anual) normalizando fechas a month-start
    4. Interpolar mensualmente → proxy de ~30-40 meses
    No se mezclan niveles con tasas para evitar inconsistencias de escala.
    """
    _CAPEX_KW = [
        "capital expenditure", "purchase of property", "property plant",
        "capex", "capital expenditures", "purchases of property",
        "capitalexpenditure",
    ]

    def _find_capex_row(cf: pd.DataFrame) -> Optional[pd.Series]:
        matches = [r for r in cf.index if any(kw in str(r).lower() for kw in _CAPEX_KW)]
        if not matches:
            return None
        best = max(matches, key=lambda r: cf.loc[r].abs().sum())
        return cf.loc[best].abs().dropna()

    def _normalize_to_ms(s: pd.Series) -> pd.Series:
        """Convierte índice fin-de-mes/trimestre a month-start para alinear con df_macro."""
        s = s.copy()
        s.index = pd.to_datetime(s.index).to_period("M").to_timestamp()
        return s.groupby(level=0).mean().sort_index()

    capex_q: dict = {}   # tasas YoY trimestrales (1 punto por empresa)
    capex_a: dict = {}   # tasas YoY anuales     (3 puntos por empresa)

    for ticker in hyperscalers:
        try:
            time.sleep(0.3)
            tk = yf.Ticker(ticker)

            # ── 1. Tasas YoY trimestrales: pct_change(4) ─────────────────────
            for attr in ["quarterly_cashflow", "quarterly_cash_flow"]:
                try:
                    cf_q = getattr(tk, attr)
                    if cf_q is not None and not cf_q.empty:
                        row = _find_capex_row(cf_q)
                        if row is not None and len(row) >= 5:
                            row.index = pd.to_datetime(row.index)
                            yoy = row.sort_index().pct_change(4).dropna()
                            if len(yoy) >= 1:
                                capex_q[ticker] = _normalize_to_ms(yoy)
                                break
                except Exception:
                    pass

            # ── 2. Tasas YoY anuales: pct_change(1) ──────────────────────────
            try:
                cf_a = tk.cashflow
                if cf_a is not None and not cf_a.empty:
                    row = _find_capex_row(cf_a)
                    if row is not None and len(row) >= 2:
                        row.index = pd.to_datetime(row.index)
                        yoy = row.sort_index().pct_change(1).dropna()
                        if len(yoy) >= 1:
                            capex_a[ticker] = _normalize_to_ms(yoy)
            except Exception:
                pass

        except Exception:
            pass

    # ── 3. Combinar tasas YoY (misma escala) por ticker ──────────────────────
    # Para cada empresa: anual da puntos base + trimestral da punto más reciente
    combined_per_ticker: dict = {}
    for ticker in set(list(capex_q.keys()) + list(capex_a.keys())):
        q_part = capex_q.get(ticker)
        a_part = capex_a.get(ticker)
        if q_part is not None and a_part is not None:
            # Prioridad al trimestral para fechas recientes; anual para el resto
            cutoff = q_part.index.min()
            older  = a_part[a_part.index < cutoff]
            combined = pd.concat([older, q_part], sort=True).sort_index()
        elif q_part is not None:
            combined = q_part
        else:
            combined = a_part
        combined_per_ticker[ticker] = combined

    if len(combined_per_ticker) < 2:
        return pd.Series(dtype=float, name="AI_CapEx_Proxy")

    # ── 4. Interpolar mensualmente y promediar entre hyperscalers ────────────
    monthly_list = []
    for yoy_series in combined_per_ticker.values():
        idx = pd.date_range(yoy_series.index[0], yoy_series.index[-1], freq="MS")
        s   = yoy_series.reindex(idx).interpolate(method="linear")
        monthly_list.append(s)

    avg_monthly = pd.concat(monthly_list, axis=1).mean(axis=1, skipna=True)
    avg_monthly = avg_monthly[avg_monthly.notna()]

    if len(avg_monthly) < 3:
        return pd.Series(dtype=float, name="AI_CapEx_Proxy")

    proxy = (avg_monthly * 100).dropna()
    proxy.name = "AI_CapEx_Proxy"
    return proxy


def download_extra_series(fred_key: str, series_extra: dict, start_date: str) -> dict:
    """
    Descarga series FRED adicionales específicas de un activo
    (ej: CPIFABSL → CPI_Food_Change para WMT).
    Aplica pct_change() si el nombre de columna destino contiene '_Change'.
    """
    from fredapi import Fred
    fred = Fred(api_key=fred_key)
    result: dict = {}
    for fid, cname in series_extra.items():
        s = _fred_get(fred, fid, start_date)
        if s is None or s.empty:
            continue
        if "_Change" in cname or "Change" in cname:
            s = s.pct_change().dropna()
        s.name = cname
        result[cname] = s
    return result


def download_asset_prices(ticker: str, start_date: str, horizon: int = 1) -> pd.DataFrame:
    """Descarga precios mensuales y construye retorno forward."""
    raw = yf.download(ticker, start=start_date, interval="1mo",
                      auto_adjust=True, progress=False)
    prices = raw["Close"].squeeze().resample("MS").last().dropna()
    # yfinance ≥0.2.x devuelve índice tz-aware (UTC); df_macro es tz-naive → strip
    if prices.index.tz is not None:
        prices.index = prices.index.tz_localize(None)
    prices.index = prices.index.normalize()
    df = pd.DataFrame({"Price": prices})
    df["Monthly_Return"] = df["Price"].pct_change()
    df["PRICE_RETURN"] = df["Monthly_Return"].shift(-horizon)
    return df


def prepare_dataset(
    ticker: str,
    cfg: dict,
    df_macro: pd.DataFrame,
    treatment_series: Optional[pd.Series] = None,
    extra_series: Optional[dict] = None,
) -> tuple:
    """
    Combina precios del activo + macro + tratamiento + series extra.
    Devuelve (df_clean, confounders_disponibles, columnas_faltantes).

    Para tratamientos custom (AI_CapEx_Proxy, AI_CapEx_Proxy_no_msft, etc.):
      Inyecta el treatment_series bajo el nombre exacto de cfg["treatment"].
      Si el proxy falla, el tratamiento queda fuera → pipeline abortará limpiamente.
      No hay fallback a índices de mercado (endógenos).

    extra_series: dict {col_name: pd.Series} descargado por download_extra_series()
    """
    df_prices = download_asset_prices(ticker, cfg["start_date"], cfg["horizon"])

    # Unir por índice — strip timezone + normalizar a MS
    if df_prices.index.tz is not None:
        df_prices.index = df_prices.index.tz_localize(None)
    df_prices.index = df_prices.index.normalize()
    df_mac = df_macro.copy()
    if df_mac.index.tz is not None:
        df_mac.index = df_mac.index.tz_localize(None)
    df_mac.index = df_mac.index.normalize()

    df_all = df_prices.join(df_mac, how="inner")

    # ── Inyectar series extra (ej: CPI_Food_Change para WMT) ─
    if extra_series:
        for cname, series in extra_series.items():
            if cname not in df_all.columns and series is not None and not series.empty:
                s_aligned = series.copy()
                s_aligned.index = pd.to_datetime(s_aligned.index).normalize()
                df_all[cname] = s_aligned.reindex(df_all.index)

    # ── Inyectar / construir tratamiento custom ──────────────
    ttype = cfg["treatment_type"]
    if ttype.startswith("custom"):
        # Usar el nombre exacto del tratamiento para que coincida con cfg["treatment"]
        # (e.g. "AI_CapEx_Proxy", "AI_CapEx_Proxy_no_msft", "AI_CapEx_Proxy_no_amzn")
        if treatment_series is not None and not treatment_series.empty:
            ts = treatment_series.copy()
            ts.index = pd.to_datetime(ts.index).normalize()
            aligned = ts.reindex(df_all.index)
            if aligned.notna().sum() >= 15:
                df_all[cfg["treatment"]] = aligned
        # Si el proxy falla la columna no existirá → missing list → pipeline aborta limpiamente

    # ── Seleccionar columnas requeridas ──────────────────────
    treatment  = cfg["treatment"]
    confounders = cfg["confounders"]
    required   = [treatment, "PRICE_RETURN"] + confounders
    available  = [c for c in required if c in df_all.columns]
    missing    = [c for c in required if c not in df_all.columns]

    # Interpolar pequeños gaps en confundidores (máx 2 meses)
    df_sub = df_all[available].copy()
    df_sub = df_sub.replace([np.inf, -np.inf], np.nan)
    for c in confounders:
        if c in df_sub.columns:
            df_sub[c] = df_sub[c].interpolate(method="linear", limit=2, limit_direction="both")

    df_clean = df_sub.dropna(subset=[c for c in [treatment, "PRICE_RETURN"] if c in df_sub.columns])
    confounders_ok = [c for c in confounders if c in df_clean.columns]

    return df_clean, confounders_ok, missing
