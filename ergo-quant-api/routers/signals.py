import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

FRED_KEY = os.environ.get("FRED_API_KEY", "")
START_DATE = "2010-01-01"


class SignalsRequest(BaseModel):
    fred_key: str | None = None
    start_date: str = START_DATE


@router.post("")
def get_signals(body: SignalsRequest):
    from causal.data import download_macro, build_ai_capex_proxy
    from causal.signals import compute_all_signals
    from causal.config import HYPERSCALERS
    from routers.configs import _configs

    fred_key = body.fred_key or FRED_KEY
    if not fred_key:
        raise HTTPException(status_code=400, detail="FRED_API_KEY not configured")
    if not _configs:
        return {"signals": [], "message": "No asset configs loaded"}

    try:
        df_macro = download_macro(fred_key, body.start_date)

        # Build capex overrides for tickers that use AI_CapEx_Proxy as treatment
        capex_overrides: dict = {}
        capex_tickers = [t for t, c in _configs.items() if "AI_CapEx_Proxy" in c.get("treatment", "")]
        if capex_tickers:
            for variant, hyperscalers in HYPERSCALERS.items():
                proxy = build_ai_capex_proxy(tuple(hyperscalers), body.start_date)
                if not proxy.empty:
                    col = "AI_CapEx_Proxy" if variant == "full" else f"AI_CapEx_Proxy_{variant.replace('-', '_')}"
                    for ticker in capex_tickers:
                        if _configs[ticker].get("treatment") == col:
                            capex_overrides[ticker] = proxy

        df_signals = compute_all_signals(_configs, df_macro, treatment_overrides=capex_overrides or None)
        return {"signals": df_signals.to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TreatmentHistoryRequest(BaseModel):
    ticker: str
    fred_key: str | None = None
    start_date: str = START_DATE
    n_quarters: int = 12


@router.post("/history")
def get_treatment_history(body: TreatmentHistoryRequest):
    from causal.data import download_macro
    from causal.signals import treatment_history_df
    from routers.configs import _configs

    fred_key = body.fred_key or FRED_KEY
    if not fred_key:
        raise HTTPException(status_code=400, detail="FRED_API_KEY not configured")
    if body.ticker not in _configs:
        raise HTTPException(status_code=404, detail=f"Config for {body.ticker} not found")

    try:
        df_macro = download_macro(fred_key, body.start_date)
        treatment_name = _configs[body.ticker]["treatment"]
        if treatment_name not in df_macro.columns:
            raise HTTPException(status_code=404, detail=f"Treatment '{treatment_name}' not in macro data")
        t_series = df_macro[treatment_name].dropna()
        df_hist = treatment_history_df(t_series, n_quarters=body.n_quarters)
        return {"history": df_hist.reset_index().to_dict(orient="records")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
