# ============================================================
# ticker_prep.py — Extracción de datos Excel + PDF para análisis causal
# Usado por: prepare_ticker.py (CLI) y app.py (Streamlit Tab 6)
# ============================================================

import re
import tempfile
from pathlib import Path
from typing import List, Dict, Any

import pandas as pd

AVAILABLE_VARS = """\
VARIABLES DISPONIBLES EN EL SISTEMA
=====================================
FRED (macro — QUASI-EXÓGENAS para tratamiento):
  FEDFUNDS_CHANGE    — Cambio mensual tasa fondos federales
  DGS10_CHANGE       — Cambio mensual bono 10Y
  YIELD_SPREAD       — Curva 10Y-2Y (ciclo económico)
  CPI_YoY            — Inflación CPI YoY (%)
  Core_CPI_YoY       — Inflación núcleo YoY (%)
  UNRATE             — Tasa desempleo (%)
  INDPRO_YoY         — Producción industrial EE.UU. YoY (%)
  SEMI_PROD_YoY      — Producción industrial semis/electrónica YoY% (FRED: IPG3344S)
  TOTCON_YoY         — Gasto total construcción EE.UU. YoY% (FRED: TTLCONS)
  CONSUMER_SENT      — Confianza consumidor Michigan
  CRUDE_OIL_Change   — Cambio % mensual WTI (FRED)
  DEFICIT_MONTHLY    — Déficit fiscal mensual EE.UU.
  ELEC_YoY           — Producción electricidad EE.UU. YoY
  VIX                — Índice volatilidad CBOE (confounder habitual)
  CREDIT_SPREAD      — High-yield spread (confounder habitual)

yfinance (mercado — QUASI-EXÓGENAS para tratamiento):
  DXY_Change         — Cambio % mensual índice dólar (exógeno para EM y exportadores)
  GoldPrice_Change   — Cambio % mensual precio oro (ciclo commodities)
  CRUDE_YF_Change    — Cambio % mensual WTI (yfinance)
  GPR_CHANGE         — Cambio % Riesgo Geopolítico (Caldara & Iacoviello) — exógeno para defensa/EM
  BRL_Change         — Cambio % mensual BRL/USD (+ = BRL aprecia; exógeno para empresas Brasil)

  NOTA: SP500_Return, SOXX_Return, QQQ_Return y NASDAQ_Return son endógenos para
  compañías que forman parte de esos índices. Solo usar como confounders, NUNCA como
  tratamiento en el modelo causal.

Custom (construido — QUASI-EXÓGENAS si la empresa NO es el hyperscaler medido):
  AI_CapEx_Proxy        — ΔCapEx YoY% de MSFT+GOOG+META+AMZN (demanda AI infra)
  AI_CapEx_Proxy_no_msft— ΔCapEx YoY% de GOOG+META+AMZN (excluye MSFT, usar para MSFT)
  AI_CapEx_Proxy_no_amzn— ΔCapEx YoY% de MSFT+GOOG+META (excluye AMZN, usar para AMZN)
"""

# ── Candidatos de tratamiento quasi-exógenos ──────────────────────────────────
# Cada entrada mapea una variable FRED/yfinance (externa a la empresa) a un
# conjunto de palabras clave extraídas del 10-K. Solo estas variables pueden
# ser tratamiento: la empresa no las controla → quasi-exogeneidad garantizada.
TREATMENT_CANDIDATES: Dict[str, Dict[str, Any]] = {
    "DEFICIT_MONTHLY": {
        "type"                : "fred",
        "label"               : "Déficit federal mensual (proxy gasto gubernamental)",
        "unit"                : "USD millones déficit mensual",
        "canal"               : "Gasto federal↑ → contratos gobierno↑ → revenue↑",
        "quasi_exog"          : "El déficit federal lo determina el Congreso de EE.UU. mediante la ley de presupuesto. Ninguna empresa privada puede causarlo ni anticiparlo sistemáticamente.",
        "justif_10k_tpl"      : "10-K menciona contratos con el gobierno federal / DoD como fuente de revenue. El gasto público es exógeno a la empresa.",
        "justif_excel_tpl"    : "Excel Bloomberg: segmento de ingresos gubernamentales correlaciona con el ciclo de gasto federal.",
        "default_confounders" : ["VIX", "GPR_CHANGE", "FEDFUNDS", "DXY_Change", "INDPRO_YoY"],
        "colisionadores"      : ["SP500_Return"],
        "moderador_cate"      : "GPR_CHANGE",
        "keywords": [
            "defense", "government contract", "dod", "department of defense",
            "military", "federal government", "pentagon", "national security",
            "nato", "weapons", "munitions", "aerospace", "procurement",
            "defense spending", "defense budget", "armed forces", "government spending",
            "federal contract", "public sector",
        ],
    },
    "CRUDE_OIL_Change": {
        "type"                : "fred",
        "label"               : "Cambio mensual precio WTI (proxy actividad energía/minería)",
        "unit"                : "cambio % mensual WTI",
        "canal"               : "WTI↑ → inversión energía/minería↑ → revenue↑",
        "quasi_exog"          : "El precio del WTI lo fija el mercado global de energía (OPEC+, inventarios EIA, demanda China). La empresa analizada es usuaria de energía o maquinaria para extraerla, no determinante del precio.",
        "justif_10k_tpl"      : "10-K identifica el ciclo de inversión en energía/upstream como driver de la demanda de equipos o servicios de la empresa.",
        "justif_excel_tpl"    : "Excel Bloomberg: revenue y EBIT correlacionan con ciclos del precio del crudo en los segmentos industriales/energía.",
        "default_confounders" : ["VIX", "FEDFUNDS", "DXY_Change", "INDPRO_YoY", "GPR_CHANGE"],
        "colisionadores"      : ["SP500_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "oil", "energy", "petroleum", "refiner", "lng", "natural gas",
            "upstream", "downstream", "drilling", "oilfield", "oil and gas",
            "energy sector", "hydrocarbon", "fuel", "mining equipment",
            "power systems", "oil services",
        ],
    },
    "GoldPrice_Change": {
        "type"                : "yf",
        "label"               : "Cambio % mensual precio oro (proxy ciclo mineral)",
        "unit"                : "cambio % mensual oro",
        "canal"               : "Ciclo commodities↑ → demanda minerales↑ → revenue↑",
        "quasi_exog"          : "El precio del oro lo fija el mercado global de commodities (reservas de bancos centrales, flujos de refugio seguro, producción minera global). La empresa analizada es extractora/usuaria, no determinante del precio spot.",
        "justif_10k_tpl"      : "10-K señala tierras raras, minerales críticos o metales preciosos como insumo o producto clave. El precio del oro es proxy del ciclo de commodities.",
        "justif_excel_tpl"    : "Excel Bloomberg: márgenes operativos correlacionan con el ciclo de precios de metales preciosos/commodities.",
        "default_confounders" : ["VIX", "DXY_Change", "GPR_CHANGE", "FEDFUNDS"],
        "colisionadores"      : ["SP500_Return"],
        "moderador_cate"      : "GPR_CHANGE",
        "keywords": [
            "rare earth", "mining", "mineral", "gold", "silver", "metals",
            "neodymium", "lithium", "cobalt", "critical mineral", "commodity",
            "tungsten", "molybdenum", "palladium", "platinum", "copper mining",
            "metal production", "ore", "smelting",
        ],
    },
    "AI_CapEx_Proxy": {
        "type"                : "custom",
        "label"               : "ΔCapEx YoY% hyperscalers MSFT+GOOG+META+AMZN — demanda AI/datacenter",
        "unit"                : "ΔCapEx YoY% hyperscalers",
        "canal"               : "AI_CapEx hyperscalers↑ → demanda chips/hardware/energía/construcción datacenter↑ → revenue cadena suministro empresa↑",
        "quasi_exog"          : "Mide el CapEx de MSFT+GOOG+META+AMZN. La empresa analizada es proveedora en la cadena de suministro de esos hyperscalers, no uno de ellos → no determina sus decisiones de inversión en infraestructura AI.",
        "justif_10k_tpl"      : "10-K identifica a los hyperscalers (MSFT, Google, Meta, Amazon) como clientes clave o como drivers de demanda de AI/datacenter para los productos de la empresa.",
        "justif_excel_tpl"    : "Excel Bloomberg: segmento de datacenter/cloud crece en paralelo con el CapEx de los hyperscalers; margen operativo mejora con el ciclo AI.",
        "default_confounders" : ["VIX", "FEDFUNDS_CHANGE", "DXY_Change", "CREDIT_SPREAD", "INDPRO_YoY"],
        "colisionadores"      : ["SP500_Return", "NASDAQ_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "artificial intelligence", "data center", "gpu", "accelerator",
            "hyperscaler", "ai infrastructure", "ai workload",
            "foundation model", "large language model", "generative ai",
            "ai spending", "cloud capacity", "inference", "training compute",
            "capital expenditure on ai", "ai investment", "ai chip",
            "nvidia", "h100", "a100", "hopper", "blackwell",
        ],
    },
    "AI_CapEx_Proxy_no_msft": {
        "type"                : "custom_no_msft",
        "label"               : "ΔCapEx 4m% hyperscalers GOOG+META+AMZN (excluye MSFT)",
        "unit"                : "ΔCapEx YoY% hyperscalers sin MSFT",
        "canal"               : "AI CapEx peers↑ → MSFT debe construir capacidad equivalente → revenue Azure↑",
        "quasi_exog"          : "Mide el CapEx de GOOG+META+AMZN (excluyendo la propia MSFT). La presión competitiva de los peers obliga a MSFT a invertir más en Azure → la empresa no controla el CapEx de sus competidores.",
        "justif_10k_tpl"      : "10-K de MSFT: el crecimiento de Azure compite directamente con AWS y GCP. El CapEx de los peers es exógeno y presiona a MSFT a responder.",
        "justif_excel_tpl"    : "Excel Bloomberg: revenue de Azure crece en línea con el CapEx del sector cloud; MSFT está respondiendo a la demanda, no creándola unilateralmente.",
        "default_confounders" : ["VIX", "FEDFUNDS_CHANGE", "DXY_Change", "CREDIT_SPREAD", "INDPRO_YoY"],
        "colisionadores"      : ["SP500_Return", "NASDAQ_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "azure", "microsoft cloud", "microsoft ai", "copilot", "openai",
            "microsoft 365", "teams ai", "windows ai", "bing ai",
            "power platform", "dynamics 365", "azure openai",
        ],
    },
    "AI_CapEx_Proxy_no_amzn": {
        "type"                : "custom_no_amzn",
        "label"               : "ΔCapEx 4m% hyperscalers MSFT+GOOG+META (excluye AMZN)",
        "unit"                : "ΔCapEx YoY% hyperscalers sin AMZN",
        "canal"               : "AI CapEx peers↑ → AWS debe construir capacidad equivalente → revenue AWS↑",
        "quasi_exog"          : "Mide el CapEx de MSFT+GOOG+META (excluyendo la propia AMZN). La presión de los peers obliga a AWS a invertir más → AMZN no controla el CapEx de Microsoft ni Google.",
        "justif_10k_tpl"      : "10-K de AMZN: AWS es el líder cloud pero compite con Azure y GCP. El CapEx de los competidores es exógeno y presiona a AWS a mantener inversión.",
        "justif_excel_tpl"    : "Excel Bloomberg: CapEx de AWS correlaciona con el del sector; la presión competitiva de los peers actúa como tratamiento exógeno.",
        "default_confounders" : ["VIX", "FEDFUNDS_CHANGE", "DXY_Change", "CREDIT_SPREAD", "INDPRO_YoY"],
        "colisionadores"      : ["SP500_Return", "NASDAQ_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "aws", "amazon web services", "amazon cloud", "bedrock", "sagemaker",
            "ec2", "s3", "lambda", "amazon ai", "alexa ai",
            "amazon trainium", "amazon inferentia", "graviton",
        ],
    },
    "CONSUMER_SENT": {
        "type"                : "fred",
        "label"               : "Índice sentimiento consumidor Michigan",
        "unit"                : "índice Michigan",
        "canal"               : "Confianza consumidor↑ → gasto discrecional↑ → revenue↑",
        "quasi_exog"          : "El índice Michigan lo elabora la Universidad de Michigan encuestando 500 hogares. Ninguna empresa individual puede influir en el sentimiento agregado de los consumidores de EE.UU.",
        "justif_10k_tpl"      : "10-K señala que la demanda de los consumidores es el principal driver del negocio: retail, bienes discrecionales o servicios al consumidor.",
        "justif_excel_tpl"    : "Excel Bloomberg: revenue y comparable store sales correlacionan con el índice Michigan en períodos de expansión y contracción del ciclo consumidor.",
        "default_confounders" : ["UNRATE", "CPI_YoY", "FEDFUNDS", "SP500_Return", "VIX"],
        "colisionadores"      : ["SP500_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "retail", "consumer", "e-commerce", "ecommerce", "discretionary",
            "household", "shopping", "store", "consumer spending",
            "apparel", "electronics", "home goods", "consumer confidence",
        ],
    },
    "CPI_Food_Change": {
        "type"                : "fred",
        "label"               : "Cambio % mensual IPC Alimentos (CPIFABSL)",
        "unit"                : "cambio % mensual IPC alimentos",
        "canal"               : "Food CPI↑ → trade-down↑ → cuota grocery↑ → revenue↑",
        "quasi_exog"          : "El IPC de alimentos lo determinan condiciones climáticas, costos agrícolas, cadena de suministro global y política agraria. Los retailers de alimentos son distribuidores, no productores primarios del índice.",
        "justif_10k_tpl"      : "10-K identifica la inflación alimentaria como factor clave de demanda: cuando los precios suben, los consumidores tienden al trade-down hacia tiendas de descuento / private label.",
        "justif_excel_tpl"    : "Excel Bloomberg: gross margin y tráfico de tiendas muestran correlación positiva con períodos de alta inflación alimentaria (trade-down effect).",
        "default_confounders" : ["SP500_Return", "DXY_Change", "CRUDE_OIL_Change", "DGS10", "VIX", "UNRATE"],
        "colisionadores"      : ["SP500_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "grocery", "food", "supermarket", "staple", "trade-down",
            "private label", "fresh produce", "food inflation",
            "food at home", "grocery store", "consumable", "food retail",
        ],
    },
    "FEDFUNDS_CHANGE": {
        "type"                : "fred",
        "label"               : "Cambio mensual tasa fondos federales",
        "unit"                : "cambio pp mensual FEDFUNDS",
        "canal"               : "Tasas Fed↑ → costo financiamiento↑ → márgenes afectados → revenue",
        "quasi_exog"          : "La tasa de fondos federales la fija el FOMC de la Fed en función del mandato dual (inflación/empleo). Ninguna empresa privada controla la política monetaria de EE.UU.",
        "justif_10k_tpl"      : "10-K señala el riesgo de tasas de interés como factor material: spreads de crédito, costo de capital, refinanciamiento de deuda o demanda de hipotecas son sensibles a la Fed.",
        "justif_excel_tpl"    : "Excel Bloomberg: márgenes netos de interés (NIM), ratios de cobertura o valuación P/E correlacionan con el ciclo de tasas de la Fed.",
        "default_confounders" : ["VIX", "DGS10", "CREDIT_SPREAD", "SP500_Return", "UNRATE"],
        "colisionadores"      : ["SP500_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "interest rate", "mortgage", "bank", "lending", "credit",
            "real estate", "reit", "financial service", "insurance",
            "fixed income", "bond", "duration", "rate sensitive",
            "net interest margin", "floating rate",
        ],
    },
    "INDPRO_YoY": {
        "type"                : "fred",
        "label"               : "Producción industrial YoY%",
        "unit"                : "% YoY producción industrial",
        "canal"               : "Producción industrial↑ → demanda equipos industriales↑ → revenue↑",
        "quasi_exog"          : "El INDPRO mide la producción industrial de toda la economía de EE.UU. (manufactura, minería, utilities). Ninguna empresa individual representa más del 1-2% del índice → es un dato externo para cualquier firma.",
        "justif_10k_tpl"      : "10-K identifica la actividad industrial (manufactura, fábricas, plantas) como driver de demanda para los productos o servicios de la empresa.",
        "justif_excel_tpl"    : "Excel Bloomberg: revenue y backlog de órdenes correlacionan con el ciclo industrial; los márgenes son más altos en expansión del INDPRO.",
        "default_confounders" : ["VIX", "FEDFUNDS", "CRUDE_OIL_Change", "DXY_Change", "CREDIT_SPREAD"],
        "colisionadores"      : ["SP500_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "industrial", "manufacturing", "factory", "production",
            "supply chain", "logistics", "automation", "robotics",
            "capital goods", "industrial equipment", "plant", "fabrication",
        ],
    },
    "DXY_Change": {
        "type"                : "yf",
        "label"               : "Cambio % mensual índice dólar (DXY) — driver FX internacional",
        "unit"                : "cambio % mensual DXY",
        "canal"               : "DXY↑ → USD aprecia vs divisas locales → revenue/costos internacionales se revalorizan → margen vía FX translation",
        "quasi_exog"          : "El DXY lo determina la política monetaria de la Fed, los flujos globales de capital y los diferenciales de tasas entre países. Ninguna empresa individual tiene poder de mercado sobre el tipo de cambio del dólar.",
        "justif_10k_tpl"      : "10-K reporta operaciones en múltiples monedas: fábricas en Asia (JPY, NTD, SGD), clientes en Europa (EUR) o EM. El FX es un riesgo explícito del modelo de negocio.",
        "justif_excel_tpl"    : "Excel Bloomberg: márgenes brutos y revenue reportado en USD varían con el DXY; la empresa muestra sensibilidad FX en el segmento internacional.",
        "default_confounders" : ["VIX", "FEDFUNDS_CHANGE", "DGS10_CHANGE", "SP500_Return", "CPI_YoY"],
        "colisionadores"      : ["SP500_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "export", "import", "foreign exchange", "currency", "international",
            "global revenue", "overseas", "exchange rate", "foreign currency",
            "multinational", "cross-border", "international sales",
        ],
    },
    # SOXX_Return y QQQ_Return ELIMINADOS de candidatos de tratamiento:
    # son retornos de índices que incluyen a las propias empresas analizadas →
    # endógenos por construcción. Solo válidos como confounders.
    "SEMI_PROD_YoY": {
        "type"                : "fred",
        "label"               : "Producción industrial semis/electrónica YoY% (FRED IPG3344S)",
        "unit"                : "% YoY producción semiconductores EE.UU.",
        "canal"               : "Ciclo DRAM/NAND↑ → utilización fab↑ → precio memoria↑ → revenue↑",
        "quasi_exog"          : "El IPG3344S consolida la producción de todo el sector (TSMC, Samsung, Intel, TI, etc.). Ninguna empresa individual representa más del 15-20% del índice → el ciclo global de semis es exógeno para cualquier firma.",
        "justif_10k_tpl"      : "10-K identifica el ciclo global de semiconductores como driver primario: fabs, wafer demand, DRAM/NAND pricing o equipos de litografía como negocio principal.",
        "justif_excel_tpl"    : "Excel Bloomberg: revenue YoY y gross margin correlacionan directamente con el ciclo de producción de semis; la empresa es cíclica pura del sector.",
        "default_confounders" : ["VIX", "FEDFUNDS_CHANGE", "DXY_Change", "CREDIT_SPREAD", "INDPRO_YoY"],
        "colisionadores"      : ["SP500_Return", "NASDAQ_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "semiconductor", "foundry", "wafer", "chip", "fab", "fabrication",
            "logic", "memory", "advanced node", "process node", "transistor",
            "integrated circuit", "ic design", "tsmc", "asml", "lithography",
            "moore", "nanometer", "node", "advanced manufacturing",
            "chip maker", "semiconductor equipment", "etching", "deposition",
            "packaging", "hbm", "nand", "dram", "soc", "gpu fab",
            "electronic component", "printed circuit board", "pcb",
        ],
    },
    "TOTCON_YoY": {
        "type"                : "fred",
        "label"               : "Gasto total construcción EE.UU. YoY% (FRED TTLCONS)",
        "unit"                : "% YoY construcción EE.UU.",
        "canal"               : "Inversión en construcción↑ → demanda maquinaria pesada↑ → revenue↑",
        "quasi_exog"          : "El gasto en construcción lo determinan la política de infraestructura pública, tasas hipotecarias y el ciclo económico. Los fabricantes de maquinaria son proveedores de ese ciclo, no sus causantes.",
        "justif_10k_tpl"      : "10-K muestra que la empresa vende maquinaria pesada, equipos de construcción o componentes para obras civiles; el nivel de actividad constructora es la demanda exógena.",
        "justif_excel_tpl"    : "Excel Bloomberg: backlog de órdenes y revenue del segmento construcción correlacionan con el TTLCONS; los márgenes siguen el ciclo constructor.",
        "default_confounders" : ["VIX", "FEDFUNDS_CHANGE", "CRUDE_OIL_Change", "DXY_Change", "INDPRO_YoY"],
        "colisionadores"      : ["SP500_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "construction", "infrastructure", "building", "heavy equipment",
            "excavator", "bulldozer", "crane", "earthmover", "backhoe",
            "road building", "civil engineering", "construction equipment",
            "quarry", "ground engaging", "asphalt", "pipeline construction",
            "building product", "site preparation", "heavy machinery",
            "compactor", "motor grader", "wheel loader", "dozer",
            "construction machinery", "mining equipment", "off-highway",
        ],
    },
    "GPR_CHANGE": {
        "type"                : "gpr",
        "label"               : "Cambio % Índice Riesgo Geopolítico (Caldara & Iacoviello)",
        "unit"                : "cambio % mensual GPR",
        "canal"               : "Riesgo geopolítico↑ → demanda seguridad/defensa↑ → revenue↑",
        "quasi_exog"          : "El GPR de Caldara & Iacoviello mide eventos geopolíticos globales (conflictos, tensiones entre estados, ataques terroristas). Ninguna empresa privada puede causar o controlar el riesgo geopolítico mundial.",
        "justif_10k_tpl"      : "10-K señala eventos geopolíticos (guerras, sanciones, tensiones en Taiwan/Oriente Medio) como driver de demanda para productos de defensa, seguridad o como riesgo operacional.",
        "justif_excel_tpl"    : "Excel Bloomberg: el revenue del segmento defensa/seguridad muestra correlación positiva con períodos de alta tensión geopolítica (GPR elevado).",
        "default_confounders" : ["VIX", "FEDFUNDS_CHANGE", "DXY_Change", "CREDIT_SPREAD"],
        "colisionadores"      : ["SP500_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "geopolit", "war", "conflict", "sanction", "embargo",
            "terrorism", "political risk", "international tension",
            "ukraine", "taiwan strait", "middle east", "cyber attack",
            "homeland security", "critical infrastructure",
            "counter-drone", "counter drone", "unmanned", "uas", "uav",
            "electronic warfare", "c4isr", "command and control",
            "missile defense", "hypersonic", "space defense",
        ],
    },
    "BRL_Change": {
        "type"                : "yf",
        "label"               : "Cambio % mensual BRL/USD (+ = BRL aprecia vs dólar)",
        "unit"                : "cambio % mensual BRL vs USD",
        "canal"               : "BRL aprecia↑ → poder adquisitivo local↑ / costos en USD↓ → revenue↑",
        "quasi_exog"          : "El BRL/USD lo determina el Banco Central de Brasil (política de intervención), los flujos de capital hacia EM y el diferencial de tasas SELIC/FEDFUNDS. La empresa analizada opera en ese entorno pero no controla el tipo de cambio.",
        "justif_10k_tpl"      : "10-K identifica Brasil/LATAM como mercado clave: el tipo de cambio BRL afecta directamente el poder adquisitivo de los clientes y la traducción de resultados a USD.",
        "justif_excel_tpl"    : "Excel Bloomberg: revenue Brasil en USD fluctúa con el BRL; márgenes locales son estables en moneda local pero muestran volatilidad en USD debido al FX.",
        "default_confounders" : ["VIX", "DXY_Change", "FEDFUNDS_CHANGE", "GPR_CHANGE", "CREDIT_SPREAD"],
        "colisionadores"      : ["SP500_Return"],
        "moderador_cate"      : "VIX",
        "keywords": [
            "brazil", "brasil", "latin america", "latam", "emerging market",
            "real", "brl", "selic", "banco central do brasil",
            "nubank", "fintech brazil", "digital bank", "neobank",
            "financial inclusion", "credit brazil", "pix", "open banking",
            "mexico", "colombia", "peru", "chile", "latin fintech",
            "unbanked", "underbanked", "emerging economy",
        ],
    },
}


def _build_suggestion(var: str, meta: Dict[str, Any], hits: int, score: int) -> Dict[str, Any]:
    return {
        "variable"           : var,
        "score"              : score,
        "hits"               : hits,
        "keywords_total"     : len(meta["keywords"]),
        "type"               : meta["type"],
        "label"              : meta["label"],
        "unit"               : meta["unit"],
        "canal"              : meta["canal"],
        "default_confounders": meta["default_confounders"],
        "colisionadores"     : meta["colisionadores"],
        "moderador_cate"     : meta["moderador_cate"],
        "fred_id"            : meta.get("fred_id"),
    }


def suggest_treatment_from_text(text: str) -> List[Dict[str, Any]]:
    """
    Fallback por keyword matching cuando no hay API key de Anthropic.
    Devuelve los candidatos ordenados por score (hasta 3).
    """
    text_lower = text.lower()
    results = []
    for var, meta in TREATMENT_CANDIDATES.items():
        hits = sum(1 for kw in meta["keywords"] if kw.lower() in text_lower)
        if hits == 0:
            continue
        score = min(100, int(hits / len(meta["keywords"]) * 400))
        results.append(_build_suggestion(var, meta, hits, score))
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:3]


# ── Tipos válidos por nombre de variable ─────────────────────────────────────
_VAR_TYPE_MAP: Dict[str, str] = {v: m["type"] for v, m in TREATMENT_CANDIDATES.items()}
_VAR_UNIT_MAP: Dict[str, str] = {v: m["unit"] for v, m in TREATMENT_CANDIDATES.items()}
_VAR_MOD_MAP:  Dict[str, str] = {v: m["moderador_cate"] for v, m in TREATMENT_CANDIDATES.items()}


_CLAUDE_SYSTEM = """Eres un econometrista y analista de inversiones especializado en inferencia causal.
Tu tarea es leer los documentos financieros de una empresa y determinar con precisión cuáles son
las 3 variables macroeconómicas o de mercado que tienen efecto causal directo sobre el retorno
de esa acción.

PRINCIPIOS CAUSALES QUE DEBES RESPETAR:
- El tratamiento T debe ser QUASI-EXÓGENO: la empresa NO lo controla
- Nunca uses SP500_Return, SOXX_Return, QQQ_Return, NASDAQ_Return como tratamiento;
  son endógenos para empresas que forman parte de esos índices
- El confundidor X debe afectar TANTO a T como a Y; no confundir con mediadores
- El colisionador es una variable que es EFECTO común de T e Y; NO condicionar sobre él
- Razona el mecanismo causal específico de ESTA empresa, no uno genérico
"""

_CLAUDE_USER_TEMPLATE = """Empresa: {ticker}

VARIABLES DISPONIBLES — SOLO puedes elegir nombres de esta lista:
{available_vars}

DOCUMENTOS FINANCIEROS:
{text}

Analiza el modelo de negocio, segmentos de revenue, estructura de costos y riesgos específicos
de esta empresa. Luego propón EXACTAMENTE 3 tratamientos quasi-exógenos en orden de prioridad.

Para source_evidence cita TEXTUALMENTE o numéricamente de dónde extrajiste la conclusión:
una frase del 10-K (indicando sección: MD&A, Risk Factors, Item 1) o un dato concreto del
Excel (segmento, margen, métrica). Máx 160 caracteres. Ejemplos:
  "MD&A: 'Data center revenue grew 43% YoY driven by AI demand'"
  "Excel: Power RPO $94B vs $73B (+$21B FY2025)"
  "Risk Factors: 'Substantially all revenue denominated in EUR and GBP'"

Para recommended_lag: estima cuántos meses tarda el mercado de {ticker} en incorporar cambios
de esta variable. Razona sobre la velocidad de publicación del dato y la anticipación del mercado.
  0 = inmediato (Fed decisions, FX spot, precios commodities — mercado descuenta el día mismo)
  1 = 1 mes (datos macro publicados con 4-6 semanas de retraso, mercado anticipa parcialmente)
  2 = 2 meses (producción industrial, construcción — datos rezagados + ciclos de pedido largos)

Responde ÚNICAMENTE con este JSON (sin texto adicional):
{{
  "candidates": [
    {{
      "variable": "NOMBRE_EXACTO_DE_LA_LISTA",
      "confidence": 85,
      "reasoning": "Por qué esta variable causa cambios en el retorno de {ticker} (2-3 oraciones específicas al negocio)",
      "canal": "Variable↑ → mecanismo causal específico a esta empresa → retorno {ticker}↑",
      "source_evidence": "Cita o dato del 10-K / Excel que sustenta esta elección (máx 160 chars)",
      "recommended_lag": 1,
      "confounders": ["VIX", "FEDFUNDS_CHANGE", "DGS10_CHANGE"],
      "colisionadores": []
    }},
    {{...}},
    {{...}}
  ]
}}"""

_VALID_VARS: set = set(TREATMENT_CANDIDATES.keys())


def suggest_treatment_with_claude(
    text: str,
    ticker: str,
    api_key: str,
    model: str = "claude-opus-4-7",
) -> List[Dict[str, Any]]:
    """
    Llama a la API de Claude para analizar los documentos de la empresa y
    proponer 3 tratamientos quasi-exógenos con razonamiento causal específico.

    Devuelve lista con exactamente 3 candidatos en el mismo formato que
    suggest_treatment_from_text, para compatibilidad con el resto del pipeline.
    """
    import anthropic, json, re

    var_list = "\n".join(f"  {v} — {m['label']}" for v, m in TREATMENT_CANDIDATES.items())
    user_msg = _CLAUDE_USER_TEMPLATE.format(
        ticker=ticker,
        available_vars=var_list,
        text=text[:28_000],   # Claude tiene 200k tokens; limitamos para costo
    )

    client  = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=model,
        max_tokens=2000,
        system=_CLAUDE_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = message.content[0].text.strip()

    # Extraer JSON aunque venga envuelto en ```json ... ```
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        raise ValueError(f"Respuesta de Claude no contiene JSON: {raw[:300]}")
    data = json.loads(m.group(0))

    candidates = data.get("candidates", [])[:3]
    results: List[Dict[str, Any]] = []

    for cand in candidates:
        var = cand.get("variable", "")
        if var not in _VALID_VARS:
            continue   # ignorar variables inventadas
        meta = TREATMENT_CANDIDATES[var]
        results.append({
            "variable"           : var,
            "score"              : int(cand.get("confidence", 80)),
            "hits"               : 0,          # no aplica para LLM
            "keywords_total"     : 0,
            "type"               : meta["type"],
            "label"              : cand.get("reasoning", meta["label"])[:120],
            "reasoning"          : cand.get("reasoning", meta["label"]),   # full text for justification.md
            "unit"               : meta["unit"],
            "canal"              : cand.get("canal", meta["canal"]),
            "source_evidence"    : cand.get("source_evidence", "")[:160],
            "recommended_lag"    : int(cand.get("recommended_lag", 0)),
            "default_confounders": cand.get("confounders", meta["default_confounders"]),
            "colisionadores"     : cand.get("colisionadores", meta["colisionadores"]),
            "moderador_cate"     : meta["moderador_cate"],
            "fred_id"            : meta.get("fred_id"),
        })

    if len(results) < 1:
        raise ValueError("Claude no devolvió ningún candidato válido.")

    return results


_JUSTIF_SYSTEM = """Eres un analista de inversiones causal experto. Tu tarea es generar un archivo
de justificación del análisis causal en Markdown. El documento debe ser riguroso, basado ÚNICAMENTE
en datos extraídos de los documentos proporcionados (Excel + 10-K), y seguir el formato exacto
especificado. NO inventes cifras. Si no encuentras un dato específico, escribe "No disponible en documentos"."""

_JUSTIF_USER_TEMPLATE = """Empresa: {ticker} — {company_name}
Fuentes de documentos: {doc_sources}

CANDIDATOS DE TRATAMIENTO SELECCIONADOS POR ANÁLISIS PREVIO:
{candidates_json}

METADATOS DE CONFUNDIDORES (para cada confundidor listado arriba):
{confounders_meta}

TEXTO COMPLETO DE LOS DOCUMENTOS:
{text}

---
Genera el archivo de justificación completo en Markdown siguiendo EXACTAMENTE este formato:

# Justificación del análisis causal: {ticker} ({company_name})
*Generado por Claude | Fuentes: {doc_sources}*

---

## H1 · Tratamiento principal: `[variable_h1]`
[descripción en 1 línea de qué mide esta variable]

### Evidencia del Excel — [nombre de hoja o sección relevante]
[tabla markdown con datos reales de revenue/segmentos/márgenes del Excel]
| Segmento | Revenue | % Total | CAGR o variación |
|----------|---------|---------|------------------|
| ... | ... | ... | ... |

[si hay sub-segmentos relevantes, agregar tabla adicional]

### Señal cuantitativa
[2-4 puntos concretos que demuestran la relación causal usando datos del Excel]
- XXXX (evento): revenue/margen cambió X%
- XXXX-XXXX: correlación directa observable

### Evidencia del 10-K ([sección: Item 1 / MD&A / Risk Factors])
> "cita textual exacta del 10-K"

[1-2 oraciones interpretando la cita en el contexto causal]

---

## H2 · Tratamiento alternativo: `[variable_h2]`
[mismo formato que H1, más breve — solo la evidencia más relevante]

### Evidencia del documento
[tabla o cita más relevante]

### Señal cuantitativa
[1-2 puntos clave]

---

## H3 · Tratamiento alternativo: `[variable_h3]`
[mismo formato resumido que H2]

---

## Mecanismo causal — H1
```
[variable_h1]↑ → [canal específico empresa] → [efecto en revenue]
              → [segundo canal si aplica]   → [efecto en margen]
→ Retorno {ticker}↑
```

---

## Confundidores del modelo H1
[Para CADA confundidor en la lista de H1:]

### `[nombre_confundidor]` — [label del confundidor]
**Fuente:** [¿Mencionado en documentos? Cita sección. Si no: "Variable de mercado estructural"]
**Por qué es confundidor:** [Cómo afecta TANTO a [variable_h1] COMO al retorno de {ticker}]
[Si hay datos del Excel que lo demuestren, incluir cifras concretas]

---

## Colisionadores — excluidos del modelo
[Para CADA colisionador:]

### `[nombre_colisionador]`
**Por qué NO es confundidor:** [Explicación de por qué condicionar sobre él introduciría collider bias]

---

## Moderador CATE: `[nombre_moderador]`
**Hipótesis:** El efecto de `[variable_h1]` sobre {ticker} varía según el régimen de `[moderador]`
- **[moderador] bajo:** [efecto esperado]
- **[moderador] alto:** [efecto esperado]
[Si hay evidencia en el Excel de esta heterogeneidad, incluir datos]

---

INSTRUCCIONES CRÍTICAS:
1. Extrae tablas REALES del Excel — busca hojas con segmentos de revenue, márgenes operacionales, CAGR
2. Cita TEXTUALMENTE del 10-K, indicando siempre la sección (Item 1, Item 7 MD&A, Item 1A Risk Factors)
3. El mecanismo causal debe usar flechas → específicas al negocio de {ticker}, no genéricas
4. Para cada confundidor explica exactamente por qué es causa común de T e Y (no mediador ni colisionador)
5. Si el Excel tiene datos de varios años, úsalos para mostrar la correlación temporal con el tratamiento
6. No incluyas texto antes del título # ni después del último separador ---
7. Escribe markdown limpio, listo para renderizar directamente"""


def generate_rich_justification_with_claude(
    text: str,
    ticker: str,
    company_name: str,
    candidates: List[Dict],
    api_key: str,
    doc_sources: str = "",
    model: str = "claude-opus-4-7",
) -> str:
    """
    Segunda llamada a Claude para generar el markdown de justificación en formato rico:
    tablas de Excel, citas del 10-K, mecanismo causal con flechas, confundidores con evidencia.
    Fallback: build_justification_md (formato simple).
    """
    import anthropic, json

    # Construir metadatos de confundidores (label + canal) para ayudar a Claude
    conf_meta_lines = []
    all_confounders: set = set()
    for c in candidates:
        for cf in c.get("default_confounders", []):
            all_confounders.add(cf)
    for cf in sorted(all_confounders):
        meta = TREATMENT_CANDIDATES.get(cf, {})
        lbl  = meta.get("label", cf)
        conf_meta_lines.append(f"  {cf}: {lbl}")
    confounders_meta = "\n".join(conf_meta_lines) if conf_meta_lines else "  (ver lista en candidatos)"

    candidates_json = json.dumps(
        [{
            "variable"      : c.get("variable", ""),
            "reasoning"     : c.get("reasoning", ""),
            "canal"         : c.get("canal", ""),
            "source_evidence": c.get("source_evidence", ""),
            "recommended_lag": c.get("recommended_lag", 0),
            "confounders"   : c.get("default_confounders", []),
            "colisionadores": c.get("colisionadores", []),
        } for c in candidates],
        ensure_ascii=False, indent=2
    )

    user_msg = _JUSTIF_USER_TEMPLATE.format(
        ticker          = ticker,
        company_name    = company_name,
        doc_sources     = doc_sources or f"{ticker}.xlsx + {ticker} 10K.pdf",
        candidates_json = candidates_json,
        confounders_meta= confounders_meta,
        text            = text[:32_000],
    )

    client  = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model      = model,
        max_tokens = 4000,
        system     = _JUSTIF_SYSTEM,
        messages   = [{"role": "user", "content": user_msg}],
    )

    return message.content[0].text.strip()


def build_justification_md(
    ticker: str,
    company_name: str,
    candidates: List[Dict],
    excel_text: str = "",
) -> str:
    """
    Genera el contenido de {ticker}_justification.md a partir de los candidatos
    devueltos por suggest_treatment_with_claude. Se llama automáticamente después
    de cada análisis con Claude para que la sección de justificación aparezca en
    cualquier empresa, no solo en las que tienen archivo manual.
    """
    from datetime import date as _date
    labels = ["H1 · Hipótesis Principal", "H2 · Hipótesis Alternativa", "H3 · Hipótesis Alternativa"]

    # Dividir el Excel en secciones para referencia por hipótesis
    _excel_sections: dict = {}
    if excel_text:
        import re as _re
        _parts = _re.split(r"={3,}\s*(.+?)\s*={3,}", excel_text)
        # _parts alternates: [pre, title1, body1, title2, body2, ...]
        for _j in range(1, len(_parts) - 1, 2):
            _excel_sections[_parts[_j].strip()] = _parts[_j + 1].strip()

    lines = [
        f"# Justificación del análisis causal: {ticker} ({company_name})",
        f"*Generado automáticamente por Claude — {_date.today().isoformat()}*",
        "",
        "---",
        "",
    ]

    for i, cand in enumerate(candidates):
        lbl = labels[i] if i < len(labels) else f"H{i+1}"
        var = cand.get("variable", "")
        reasoning = cand.get("reasoning") or cand.get("label", "")
        canal = cand.get("canal", "")
        evidence = cand.get("source_evidence", "")
        lag = int(cand.get("recommended_lag", 0))
        lag_str = "lag = 0 — contemporáneo (mercado descuenta el dato de forma inmediata)" if lag == 0 \
                  else f"lag = {lag} mes{'es' if lag > 1 else ''} — mercado tarda ~{lag}m en incorporar este dato"
        conf_str  = " · ".join(f"`{c}`" for c in cand.get("default_confounders", []))
        coli_list = cand.get("colisionadores", [])
        coli_str  = " · ".join(f"`{c}`" for c in coli_list) if coli_list else "ninguno"

        lines += [
            f"## {lbl}: `{var}`",
            "",
            f"**Razonamiento causal:** {reasoning}",
            "",
            f"**Canal:** `{canal}`",
            "",
        ]
        if evidence:
            lines += [
                f"**Evidencia del documento:**",
                f"> {evidence}",
                "",
            ]

        # ── Evidencia del Excel Bloomberg ──────────────────────────────────
        if _excel_sections:
            lines += ["### 📊 Evidencia del Excel Bloomberg", ""]
            # H1 recibe todas las secciones; H2/H3 solo los primeros 1 200 chars
            _char_limit = 4000 if i == 0 else 1200
            _chars_used = 0
            for _sec_title, _sec_body in _excel_sections.items():
                if _chars_used >= _char_limit:
                    break
                _excerpt = _sec_body[: _char_limit - _chars_used]
                lines += [
                    f"**{_sec_title}**",
                    "```",
                    _excerpt,
                    "```",
                    "",
                ]
                _chars_used += len(_excerpt)

        lines += [
            f"**Lag recomendado:** {lag_str}",
            "",
            f"**Confundidores:** {conf_str}",
            f"**Colisionadores:** {coli_str}",
            "",
            "---",
            "",
        ]

    return "\n".join(lines)


def build_pipeline_justification_md(
    ticker: str,
    company_name: str,
    result,
    selected_cand: dict,
    confounders_used: list,
) -> str:
    """
    Genera {ticker}_justification.md a partir de los resultados del pipeline causal.
    Fallback para empresas sin análisis Claude — permite mostrar la sección de
    justificación en TODAS las empresas analizadas, no solo las que tienen doc upload.
    """
    from datetime import date as _date
    import math

    def _fmt_float(x, fmt=".4f"):
        try:
            return format(float(x), fmt) if not math.isnan(float(x)) else "—"
        except (TypeError, ValueError):
            return "—"

    lines = [
        f"# Justificación del análisis causal: {ticker} ({company_name})",
        f"*Generado automáticamente por pipeline — {_date.today().isoformat()}*",
        "",
        "---",
        "",
        f"## Tratamiento seleccionado: `{result.treatment}`",
        "",
    ]

    canal = (selected_cand.get("canal") or "") if selected_cand else ""
    reasoning = ""
    if selected_cand:
        reasoning = (
            selected_cand.get("reasoning")
            or selected_cand.get("label")
            or selected_cand.get("treatment_description", "")
        )

    # Si el razonamiento es el placeholder de override manual o está vacío,
    # usar la descripción estándar del tratamiento desde TREATMENT_CANDIDATES
    _is_placeholder = not reasoning or reasoning.strip() == "Override manual"
    if _is_placeholder:
        _meta = TREATMENT_CANDIDATES.get(result.treatment, {})
        reasoning = _meta.get("label", "")
        if not canal:
            canal = _meta.get("canal", "")

    # Lag aplicado (Claude > PUBLICATION_LAG)
    from causal.config import PUBLICATION_LAG as _PUB_LAG
    _lag = int(selected_cand.get("recommended_lag") or _PUB_LAG.get(result.treatment, 0)) if selected_cand else _PUB_LAG.get(result.treatment, 0)
    _lag_str = (
        "lag = 0 — contemporáneo (dato disponible en el mismo mes de referencia)"
        if _lag == 0
        else f"lag = {_lag} mes{'es' if _lag > 1 else ''} — publicación FRED + transmisión económica"
    )

    if reasoning:
        lines += [f"**Razonamiento:** {reasoning}", ""]
    if canal:
        lines += [f"**Canal causal:** `{canal}`", ""]
    lines += [f"**Lag aplicado:** {_lag_str}", ""]

    # ── Estadísticos del pipeline ──
    ate_str  = _fmt_float(result.ate_best, "+.4f")
    pval_str = _fmt_float(result.pval_best, ".4f")
    score_str = _fmt_float(result.score_ldp, ".1f")

    lines += [
        "### Resultados del pipeline",
        "",
        "| Estadístico | Valor |",
        "|-------------|-------|",
        f"| N observaciones | {result.n_obs} |",
        f"| ATE (mejor estimador) | {ate_str} |",
        f"| p-value | {pval_str} |",
        f"| Significativo (α=5%) | {'✅ Sí' if result.significant else '❌ No'} |",
        f"| Score LdP | {score_str} |",
        f"| Decisión | **{result.decision}** |",
        "",
    ]

    # ── LiNGAM ──
    p_ty = result.lingam_prob_t_to_y
    p_yt = result.lingam_prob_y_to_t
    try:
        _lingam_ok = not math.isnan(float(p_ty))
    except (TypeError, ValueError):
        _lingam_ok = False

    if _lingam_ok:
        lingam_dir = (
            "✅ confirmada" if result.lingam_ok
            else ("⚠️ débil" if float(p_ty) >= 0.40 else "❌ no confirmada")
        )
        lines += [
            "### LiNGAM — Dirección causal",
            "",
            "| | Probabilidad |",
            "|--|--|",
            f"| P(T→Y) | {float(p_ty)*100:.0f}% |",
            f"| P(Y→T) | {float(p_yt)*100:.0f}% |",
            f"| Dirección T→Y | {lingam_dir} |",
            "",
        ]
        if result.lingam_order:
            lines += [f"**Orden causal (DirectLiNGAM):** {' → '.join(result.lingam_order)}", ""]

    # ── Refutaciones ──
    lines += [
        "### Refutaciones",
        "",
        f"**Estado:** {'✅ Ambas pruebas pasan — efecto robusto' if result.refut_ok else '⚠️ Una o más pruebas fallan — revisar especificación'}",
        "",
    ]
    try:
        if not math.isnan(float(result.refut_placebo_pval)):
            p_pl = float(result.refut_placebo_pval)
            lines.append(f"- Placebo DML: p = {p_pl:.4f} ({'✅' if p_pl < 0.05 else '❌'})")
    except (TypeError, ValueError):
        pass
    try:
        if not math.isnan(float(result.refut_random_pval)):
            p_rc = float(result.refut_random_pval)
            lines.append(f"- Random common cause: p = {p_rc:.4f} ({'✅' if p_rc > 0.05 else '❌'})")
    except (TypeError, ValueError):
        pass
    lines.append("")

    # ── Confundidores ──
    if confounders_used:
        conf_str = " · ".join(f"`{c}`" for c in confounders_used)
        lines += ["### Confundidores usados", "", conf_str, ""]

    coli_list = (selected_cand.get("colisionadores") or []) if selected_cand else []
    if coli_list:
        coli_str = " · ".join(f"`{c}`" for c in coli_list)
        lines += [f"**Colisionadores excluidos:** {coli_str}", ""]

    lines += ["---", ""]
    return "\n".join(lines)


_NEXT_ITEM = re.compile(r"item\s+(?:1b|2|3|4|5|6|7a|8|9)\b", re.IGNORECASE)

_SECTION_PATTERNS = {
    "BUSINESS (Item 1)": [
        r"item\s+1[\.\s]+business",
        r"item\s+1\.\s*our\s+business",
        r"business\s+overview",
        r"overview\s+of\s+our\s+business",
    ],
    "RISK FACTORS (Item 1A)": [
        r"item\s+1a[\.\s]+risk\s+factor",
        r"risk\s+factors",
    ],
    "MD&A (Item 7)": [
        r"item\s+7[\.\s]+management",
        r"management.s\s+discussion",
        r"results\s+of\s+operations",
    ],
}


# ── Excel ─────────────────────────────────────────────────────────────────────

def _read_sheet_flexible(xls: pd.ExcelFile, candidates: list) -> pd.DataFrame | None:
    for name in xls.sheet_names:
        for candidate in candidates:
            if candidate.lower() in name.lower():
                try:
                    return xls.parse(name, header=None)
                except Exception:
                    pass
    return None


def extract_excel(path: str) -> str:
    """Extrae hojas clave de un Excel Bloomberg. Acepta ruta en disco."""
    xls = pd.ExcelFile(path, engine="openpyxl")
    sections = []

    specs = [
        (["negocio", "business", "segment"],                      "NEGOCIO / SEGMENTOS",     40, 12),
        (["estado de resultado", "income", "p&l", "resultado"],   "ESTADO DE RESULTADOS",    35, 12),
        (["análisis negocio", "analisis negocio", "business anal"],"ANÁLISIS NEGOCIO",        30, 10),
        (["ratio", "ratios financiero", "financial ratio"],        "RATIOS FINANCIEROS",       25, 10),
    ]

    for candidates, title, nrows, ncols in specs:
        df = _read_sheet_flexible(xls, candidates)
        if df is not None:
            preview = df.iloc[:nrows, :ncols].fillna("").astype(str)
            sections.append(f"=== {title} ===\n{preview.to_string(index=False, header=False)}")

    if not sections:
        sections.append(f"Hojas disponibles: {xls.sheet_names}")
        first = xls.parse(xls.sheet_names[0], header=None)
        sections.append(first.iloc[:30, :10].fillna("").astype(str).to_string())

    return "\n\n".join(sections)


# ── PDF ───────────────────────────────────────────────────────────────────────

def _find_section(pages_text: list, patterns: list) -> str:
    full = "\n".join(pages_text)
    for pattern in patterns:
        for m in re.finditer(pattern, full, re.IGNORECASE):
            chunk = full[m.start(): m.start() + 5000]
            end = _NEXT_ITEM.search(chunk, 80)
            if end:
                chunk = chunk[: end.start()]
            chunk = chunk.strip()
            if len(chunk) > 400:
                return chunk[:3500]
    return "[Sección no encontrada]"


def extract_pdf(path: str, max_pages: int = 150) -> str:
    """Extrae secciones Item 1, 1A y 7 de un PDF 10-K. Acepta ruta en disco."""
    try:
        import pdfplumber
    except ImportError:
        return "[ERROR] pip install pdfplumber"

    pages_text = []
    try:
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                pages_text.append(page.extract_text() or "")
                if i >= max_pages - 1:
                    break
    except Exception as e:
        return f"[ERROR leyendo PDF] {e}"

    parts = []
    for name, patterns in _SECTION_PATTERNS.items():
        text = _find_section(pages_text, patterns)
        parts.append(f"=== {name} ===\n{text}")
    return "\n\n".join(parts)


# ── Construcción del resumen final ────────────────────────────────────────────

def build_summary(
    ticker: str,
    start_date: str,
    excel_text: str,
    pdf_texts: list,   # lista de str, uno por PDF subido
) -> str:
    lines = [
        f"# Datos para análisis causal: {ticker}",
        f"Fecha inicio sugerida: {start_date}\n",
        "## DATOS FINANCIEROS (Bloomberg Excel)\n",
        excel_text,
    ]

    if pdf_texts:
        lines.append("\n\n## DOCUMENTOS 10-K (SEC Filings)\n")
        for i, text in enumerate(pdf_texts, 1):
            lines.append(f"### Documento {i}\n{text}")
    else:
        lines.append("\n\n## DOCUMENTOS 10-K\n[No proporcionados — análisis basado solo en Excel]")

    lines.append(f"\n\n{AVAILABLE_VARS}")
    return "\n".join(lines)


def save_uploaded_file(uploaded_file, dest_dir: Path) -> str:
    """Guarda un UploadedFile de Streamlit en disco y devuelve la ruta."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / uploaded_file.name
    dest.write_bytes(uploaded_file.getvalue())
    return str(dest)
