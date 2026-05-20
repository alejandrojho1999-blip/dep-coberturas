import os
import json
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# In-memory store (loaded once from env or file at startup).
# For persistent storage, wire to Supabase via REST here.
_configs: dict[str, Any] = {}

_CONFIGS_PATH = os.path.join(os.path.dirname(__file__), "..", "ticker_data", "custom_configs.json")


def _load_from_file() -> None:
    if os.path.exists(_CONFIGS_PATH):
        with open(_CONFIGS_PATH, encoding="utf-8") as f:
            _configs.update(json.load(f))


_load_from_file()


class ConfigPayload(BaseModel):
    ticker: str
    config: dict[str, Any]


@router.get("")
def list_configs():
    return {"configs": _configs}


@router.post("")
def upsert_config(payload: ConfigPayload):
    _configs[payload.ticker] = payload.config
    return {"ok": True, "ticker": payload.ticker}


@router.delete("/{ticker}")
def delete_config(ticker: str):
    if ticker not in _configs:
        raise HTTPException(status_code=404, detail="Ticker not found")
    del _configs[ticker]
    return {"ok": True}
