# ============================================================
# config.py — Configuraciones de activos y series macro
# ============================================================

# ── Umbral de suficiencia para selección automática de tratamiento ───────────
# Un tratamiento es "suficiente" si cumple los 3 criterios simultáneamente.
# Si T1 no es suficiente → se prueba T2, luego T3.
# Si ninguno es suficiente → se usa el de mayor Score LdP.
TREATMENT_SUFFICIENT = {
    "lingam_p_ty_min": 0.40,   # P(T→Y) mínimo (LiNGAM bootstrap)
    "pval_max"        : 0.10,   # p-value máximo (significancia marginal)
    "score_ldp_min"   : 20.0,   # Score LdP mínimo (supera umbral REDUCIR)
}

# Empresas cargadas dinámicamente desde ticker_data/custom_configs.json
# (vacío aquí para que no haya configs hard-codeadas en el código fuente)
ASSET_CONFIGS = {}

# ── FRED series a descargar ──────────────────────────────────
FRED_SERIES = {
    "FEDFUNDS"     : "FEDFUNDS",
    "GS10"         : "DGS10",
    "DGS2"         : "DGS2",
    "DFII10"       : "REAL_YIELD_10Y",
    "CPIAUCSL"     : "CPI_LEVEL",
    "CPILFESL"     : "CORE_CPI_LEVEL",
    "PCEPI"        : "PCE_LEVEL",
    "UNRATE"       : "UNRATE",
    "INDPRO"       : "INDPRO_LEVEL",
    "UMCSENT"      : "CONSUMER_SENT",
    "VIXCLS"       : "VIX",
    "BAMLH0A0HYM2" : "CREDIT_SPREAD",
    # TEDRATE discontinuado jun-2023; reemplazado por spread LIBOR-OIS via BAMLH0A0HYM2
    "DCOILWTICO"   : "WTI_RAW",
    # GPRC no existe en FRED; GPR_CHANGE se construye vía Caldara & Iacoviello
    "MTSDS133FMS"  : "DEFICIT_MONTHLY",
    "IPG2211A2N"   : "ELECTRICITY_PROD",
    # Producción industrial semis + equipos electrónicos (proxy demanda sector)
    "IPG3344S"     : "SEMI_PROD_LEVEL",
    # Gasto total en construcción EE.UU. (proxy demanda maquinaria pesada)
    "TTLCONS"      : "TOTCON_LEVEL",
    # CPI Alimentos en casa (proxy trade-down grocers — WMT, KR, etc.)
    "CPIFABSL"     : "CPI_Food_LEVEL",
}

# ── yfinance series a descargar ──────────────────────────────
YF_SERIES = {
    "^GSPC"    : "SP500_Return",
    "^IXIC"    : "NASDAQ_Return",
    "DX-Y.NYB" : "DXY_Change",
    "GC=F"     : "GoldPrice_Change",
    "CL=F"     : "CRUDE_YF_Change",
    "^SOX"     : "SOXX_Return",
    "QQQ"      : "QQQ_Return",
    # BRL=X: Brazilian Real en términos de USD (↑ = BRL aprecia)
    "BRL=X"    : "BRL_LEVEL",
}

# ── Hyperscalers para construir AI_CapEx_Proxy ───────────────
HYPERSCALERS = {
    "full"    : ["MSFT", "GOOGL", "META", "AMZN"],
    "no_msft" : ["GOOGL", "META", "AMZN"],
    "no_amzn" : ["MSFT", "GOOGL", "META"],
}

# ── Rezago de publicación por variable (capa 1 del lag) ─────────────────────
# Cuántos meses tarda el dato en estar disponible para el mercado tras el mes de referencia.
# Se usa como fallback cuando Claude no ha analizado documentos de la empresa.
# La capa 2 (transmisión económica, empresa/sector-específica) la determina Claude via recommended_lag.
PUBLICATION_LAG = {
    # Tiempo real / mismo mes de referencia
    "FEDFUNDS_CHANGE"      : 0,
    "DGS10_CHANGE"         : 0,
    "DGS2_CHANGE"          : 0,
    "YIELD_SPREAD_CHANGE"  : 0,
    "GPR_CHANGE"           : 0,
    "DXY_Change"           : 0,
    "GoldPrice_Change"     : 0,
    "CRUDE_YF_Change"      : 0,
    "CRUDE_OIL_Change"     : 0,
    "VIX"                  : 0,
    "SP500_Return"         : 0,
    "NASDAQ_Return"        : 0,
    "SOXX_Return"          : 0,
    "QQQ_Return"           : 0,
    "BRL_Change"           : 0,
    "CREDIT_SPREAD_CHANGE" : 0,
    "CREDIT_SPREAD"        : 0,
    "CPI_YoY"              : 0,   # publicado ~2 semanas post-mes
    "Core_CPI_YoY"         : 0,
    "CPI_Food_Change"      : 0,
    "CONSUMER_SENT"        : 0,   # encuesta publicada al final del mismo mes
    # Publicado ~1 mes post-mes
    "INDPRO_YoY"           : 1,
    "ELEC_YoY"             : 1,
    "SEMI_PROD_YoY"        : 1,
    "TOTCON_YoY"           : 1,
    "UNRATE"               : 1,
    "PCE_YoY"              : 1,
    # Publicado ~2 meses post-mes
    "DEFICIT_MONTHLY"      : 2,
    # AI CapEx: trimestral, publicado ~1 mes post-trimestre
    "AI_CapEx_Proxy"            : 1,
    "AI_CapEx_Proxy_no_msft"    : 1,
    "AI_CapEx_Proxy_no_amzn"    : 1,
}

# Variables que son ya estacionarias por construcción (no diferenciar)
FORCE_STATIONARY = {
    "NASDAQ_Return", "SP500_Return", "SOXX_Return", "QQQ_Return",
    "DXY_Change", "CRUDE_OIL_Change", "GoldPrice_Change", "GPR_CHANGE",
    "CRUDE_YF_Change", "AI_CapEx_Proxy", "AI_CapEx_Proxy_no_msft", "AI_CapEx_Proxy_no_amzn",
    "CPI_YoY", "Core_CPI_YoY", "PCE_YoY", "INDPRO_YoY", "ELEC_YoY",
    "SEMI_PROD_YoY", "TOTCON_YoY", "BRL_Change",
    "FEDFUNDS_CHANGE", "DGS10_CHANGE", "DGS2_CHANGE",
    "YIELD_SPREAD_CHANGE", "CREDIT_SPREAD_CHANGE",
    "VIX", "CPI_Food_Change",
}
