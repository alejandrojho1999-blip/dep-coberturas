from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import signals, portfolio, causal, configs, documents

app = FastAPI(title="ERGO-Quant API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://dep-coberturas.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(signals.router, prefix="/signals", tags=["signals"])
app.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
app.include_router(causal.router, prefix="/causal", tags=["causal"])
app.include_router(configs.router, prefix="/configs", tags=["configs"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])


@app.get("/health")
def health():
    return {"status": "ok"}
