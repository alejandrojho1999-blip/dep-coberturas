import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")


class DocumentAnalyzeRequest(BaseModel):
    ticker: str
    year: int
    quarter: int
    pdf_text: str
    openrouter_api_key: str | None = None


@router.post("/analyze")
def analyze_document(body: DocumentAnalyzeRequest):
    from causal.quarterly_analysis import analyze_report

    api_key = body.openrouter_api_key or OPENROUTER_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENROUTER_API_KEY not configured")

    try:
        result = analyze_report(
            pdf_text=body.pdf_text,
            ticker=body.ticker,
            year=body.year,
            quarter=body.quarter,
            api_key=api_key,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
