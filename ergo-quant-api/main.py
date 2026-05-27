import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from routers import signals, portfolio, causal, configs, documents

app = FastAPI(title="ERGO-Quant API", version="1.0.0")

DEFAULT_CORS_ORIGINS = [
    "https://dep-coberturas.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
]


def get_cors_origins() -> list[str]:
    configured = os.environ.get("CORS_ORIGINS") or os.environ.get("FRONTEND_ORIGIN")
    if not configured:
        return DEFAULT_CORS_ORIGINS
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = os.environ.get("API_KEY")
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API_KEY not configured",
        )
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)

protected = [Depends(require_api_key)]

app.include_router(signals.router, prefix="/signals", tags=["signals"], dependencies=protected)
app.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"], dependencies=protected)
app.include_router(causal.router, prefix="/causal", tags=["causal"], dependencies=protected)
app.include_router(configs.router, prefix="/configs", tags=["configs"], dependencies=protected)
app.include_router(documents.router, prefix="/documents", tags=["documents"], dependencies=protected)


@app.get("/health")
def health():
    return {"status": "ok"}
