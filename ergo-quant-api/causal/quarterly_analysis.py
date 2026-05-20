"""
quarterly_analysis.py — Análisis de reportes trimestrales (10-Q, 6-K, IFRS, etc.)
con Google Gemini Flash (gratuito) para extraer señal de tratamiento causal.
Soporta empresas de cualquier bolsa mundial.
"""
import json
import re
from pathlib import Path
from datetime import datetime

QUARTERLY_DIR = Path(__file__).parent.parent / "outputs" / "quarterly"
QUARTERLY_DIR.mkdir(parents=True, exist_ok=True)


# ── Extracción de texto ──────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_file) -> str:
    """Extrae texto de un PDF subido (file-like object o path)."""
    try:
        import pdfplumber
    except ImportError:
        raise ImportError("Instala pdfplumber: pip install pdfplumber")

    parts = []
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages[:50]:          # max 50 páginas
            t = page.extract_text()
            if t:
                parts.append(t)
    return "\n".join(parts)


# ── Persistencia ─────────────────────────────────────────────────────────────

def quarter_key(year: int, q: int) -> str:
    return f"{year}_Q{q}"

def prev_quarter(year: int, q: int) -> tuple[int, int]:
    return (year - 1, 4) if q == 1 else (year, q - 1)

def save_report(ticker: str, qkey: str, data: dict) -> None:
    d = QUARTERLY_DIR / ticker
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{qkey}.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )

def load_report(ticker: str, qkey: str) -> dict | None:
    p = QUARTERLY_DIR / ticker / f"{qkey}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None

def list_reports(ticker: str) -> list[str]:
    d = QUARTERLY_DIR / ticker
    return sorted([p.stem for p in d.glob("*.json")]) if d.exists() else []

def all_tickers_with_reports() -> list[str]:
    return [d.name for d in QUARTERLY_DIR.iterdir() if d.is_dir()]


# ── Análisis con Gemini ──────────────────────────────────────────────────────

_PROMPT = """Eres un analista financiero cuantitativo experto en reportes de resultados \
corporativos de cualquier bolsa del mundo. Analiza el siguiente reporte trimestral de \
{ticker} ({year} Q{quarter}) — puede estar en cualquier idioma y formato \
(10-Q, 6-K, informe trimestral IFRS, Quarterly Securities Report japonés, etc.).

{prev_block}

═══════════════ REPORTE (primeras {n_chars} caracteres) ═══════════════
{text}
═══════════════════════════════════════════════════════════════════════

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin markdown, \
sin texto adicional):

{{
  "ticker": "{ticker}",
  "year": {year},
  "quarter": {quarter},

  "revenue_current":        <número o null>,
  "revenue_currency":       "<código ISO o null>",
  "revenue_growth_qoq":     <% vs trimestre anterior, número o null>,
  "revenue_growth_yoy":     <% vs mismo trimestre año anterior, número o null>,

  "net_income_current":     <número o null>,
  "eps_current":            <número o null>,
  "eps_growth_yoy":         <% vs mismo trimestre año anterior, número o null>,

  "gross_margin":           <% margen bruto, número o null>,
  "gross_margin_delta_qoq": <cambio en pp vs trimestre anterior, número o null>,
  "operating_margin":       <% margen operativo, número o null>,

  "management_tone":        <1–10, 1=muy negativo, 5=neutral, 10=muy positivo>,
  "guidance_direction":     <-1=reducida | 0=mantenida | 1=mejorada | null=no aplica>,
  "guidance_summary":       "<1 oración>",

  "new_risks":              ["<riesgo nuevo 1>", "..."],
  "key_positives":          ["<punto positivo 1>", "..."],
  "key_negatives":          ["<punto negativo 1>", "..."],

  "qoq_change_summary":     "<2 oraciones comparando con trimestre anterior, \
o 'Primer reporte cargado' si no hay datos previos>",

  "treatment_score":        <float en [-1.0, 1.0]>,
  "treatment_rationale":    "<1 oración explicando el score>"
}}

Reglas para calcular treatment_score:
• Normaliza revenue_growth_yoy y eps_growth_yoy: +20% → +1, 0% → 0, -20% → -1 (lineal, clampea ±1)
• management_tone normalizada: (tone - 5) / 5
• guidance_direction ya está en [-1, 0, 1]
• score_base = 0.30×rev_norm + 0.25×eps_norm + 0.25×tone_norm + 0.20×guidance (ignora nulls, redistribuye pesos)
• Si hay datos del trimestre anterior: ajusta ±0.10 según mejora/deterioro neto QoQ
• Clampea resultado final a [-1.0, 1.0] con 2 decimales"""

_PREV_BLOCK = """Datos del trimestre anterior ({year} Q{quarter}) para comparación QoQ:
• Revenue growth YoY: {revenue_growth_yoy}%
• EPS growth YoY:     {eps_growth_yoy}%
• Gross margin:       {gross_margin}%  (delta QoQ: {gross_margin_delta_qoq} pp)
• Management tone:    {management_tone}/10
• Guidance:           {guidance_direction}
• Treatment score:    {treatment_score}
"""


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek/deepseek-chat"   # DeepSeek-V3 — mejor modelo no-reasoning


def analyze_report(
    pdf_text: str,
    ticker: str,
    year: int,
    quarter: int,
    api_key: str,
) -> dict:
    """
    Envía el texto del reporte a DeepSeek via OpenRouter y devuelve el dict de análisis.
    Carga automáticamente el trimestre anterior si existe para comparación QoQ.
    """
    import requests as _req

    py, pq = prev_quarter(year, quarter)
    prev = load_report(ticker, quarter_key(py, pq))

    prev_block = ""
    if prev:
        prev_block = _PREV_BLOCK.format(
            year                   = py,
            quarter                = pq,
            revenue_growth_yoy     = prev.get("revenue_growth_yoy", "N/D"),
            eps_growth_yoy         = prev.get("eps_growth_yoy", "N/D"),
            gross_margin           = prev.get("gross_margin", "N/D"),
            gross_margin_delta_qoq = prev.get("gross_margin_delta_qoq", "N/D"),
            management_tone        = prev.get("management_tone", "N/D"),
            guidance_direction     = prev.get("guidance_direction", "N/D"),
            treatment_score        = prev.get("treatment_score", "N/D"),
        )

    truncated = pdf_text[:55_000]
    prompt = _PROMPT.format(
        ticker     = ticker,
        year       = year,
        quarter    = quarter,
        n_chars    = len(truncated),
        text       = truncated,
        prev_block = prev_block,
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dep-coberturas.vercel.app",
        "X-Title": "ERGOS QUANT",
    }
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 1200,
    }

    resp = _req.post(OPENROUTER_URL, json=payload, headers=headers, timeout=60)
    resp.raise_for_status()
    raw = resp.json()["choices"][0]["message"]["content"].strip()

    # Quitar bloques markdown si el modelo los añade
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    data = json.loads(raw)
    data["analyzed_at"]         = datetime.now().isoformat()
    data["has_prev_comparison"] = prev is not None
    data["input_chars"]         = len(pdf_text)
    data["model"]               = DEEPSEEK_MODEL

    return data


# ── Helpers para el PPO ──────────────────────────────────────────────────────

def build_treatment_scores_for_quarter(
    tickers: list[str],
    year: int,
    quarter: int,
) -> dict[str, float]:
    """
    Devuelve {ticker: treatment_score} para el trimestre dado.
    Si no hay reporte cargado para un ticker devuelve 0.0.
    """
    scores = {}
    qk = quarter_key(year, quarter)
    for t in tickers:
        data = load_report(t, qk)
        scores[t] = float(data["treatment_score"]) if data and "treatment_score" in data else 0.0
    return scores
