from typing import Literal
from datetime import date
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

COV_BUILDERS = {
    "sample": "cov_sample",
    "ewma":   "cov_ewma",
    "ledoit": "cov_lw",
    "gerber": "cov_gerber",
}


class OptimizeRequest(BaseModel):
    tickers: list[str]
    start_date: str = "2018-01-01"
    end_date: str | None = None
    strategy: Literal["markowitz", "hrp", "ra-hrp", "herc"] = "hrp"
    covariance: Literal["sample", "ewma", "ledoit", "gerber"] = "ledoit"
    risk_measure: Literal["var", "cvar", "cdar"] = "var"


@router.post("/optimize")
def optimize_portfolio(body: OptimizeRequest):
    import causal.portfolio as pf

    end = body.end_date or str(date.today())

    try:
        df_ret = pf.download_returns(tuple(body.tickers), body.start_date, end)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data download failed: {e}")

    if df_ret.empty:
        raise HTTPException(status_code=400, detail="No return data for the given tickers/dates")

    # Build covariance (daily scale → annualize × 252)
    try:
        cov_fn = getattr(pf, COV_BUILDERS[body.covariance])
        cov_ann = cov_fn(df_ret) * 252
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Covariance estimation failed: {e}")

    try:
        strategy = body.strategy.lower()
        if strategy == "markowitz":
            result = pf.run_markowitz(df_ret, cov_ann)
        elif strategy == "hrp":
            result = pf.run_hrp(df_ret, cov_ann)
        elif strategy == "ra-hrp":
            result = pf.run_rahrp(df_ret, cov_ann)
        elif strategy == "herc":
            result = pf.run_herc(df_ret, cov_ann)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown strategy: {strategy}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {e}")

    # Sanitize non-serializable values (numpy floats, NaN)
    import math
    import numpy as np

    def _clean(v):
        if isinstance(v, float) and math.isnan(v):
            return None
        if isinstance(v, (np.floating,)):
            return float(v)
        if isinstance(v, (np.integer,)):
            return int(v)
        return v

    def sanitize(obj):
        if isinstance(obj, dict):
            return {k: sanitize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [sanitize(x) for x in obj]
        return _clean(obj)

    return sanitize(result)
