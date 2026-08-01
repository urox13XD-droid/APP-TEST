from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core import config

app = FastAPI(
    title="OneLine Studio API",
    description=(
        "Turns any image into a single, fully connected line-art graph "
        "reconstructed from lines/arcs/beziers -- never a raw pixel trace -- "
        "ready to export as SVG, DXF, STL or OBJ for one-piece FDM printing."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {"name": "OneLine Studio API", "docs": "/docs"}
