import os
import dataclasses
import math
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

FRED_KEY = os.environ.get("FRED_API_KEY", "")
START_DATE = "2010-01-01"


class CausalAnalyzeRequest(BaseModel):
    ticker: str
    fred_key: str | None = None
    start_date: str = START_DATE
    run_refutations: bool = False


@router.post("/analyze")
def analyze_causal(body: CausalAnalyzeRequest):
    from causal.data import download_macro, prepare_dataset
    from causal.pipeline import run_full_pipeline
    from routers.configs import _configs

    fred_key = body.fred_key or FRED_KEY
    if not fred_key:
        raise HTTPException(status_code=400, detail="FRED_API_KEY not configured")
    if body.ticker not in _configs:
        raise HTTPException(status_code=404, detail=f"Config for {body.ticker} not found")

    try:
        cfg = _configs[body.ticker]
        df_macro = download_macro(fred_key, body.start_date)
        df_clean, confounders, missing = prepare_dataset(body.ticker, cfg, df_macro)

        if df_clean is None or df_clean.empty:
            raise HTTPException(status_code=422, detail=f"Insufficient data. Missing: {missing}")

        result = run_full_pipeline(
            ticker=body.ticker,
            cfg=cfg,
            df_clean=df_clean,
            confounders=confounders,
            run_refut=body.run_refutations,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # CausalResult is a dataclass — serialize safely
    raw = dataclasses.asdict(result)

    def _clean(v):
        if isinstance(v, float) and math.isnan(v):
            return None
        if isinstance(v, (np.floating,)):
            return float(v)
        if isinstance(v, (np.integer,)):
            return int(v)
        if isinstance(v, (np.bool_,)):
            return bool(v)
        return v

    def sanitize(obj):
        if isinstance(obj, dict):
            return {k: sanitize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [sanitize(x) for x in obj]
        return _clean(obj)

    return sanitize(raw)
