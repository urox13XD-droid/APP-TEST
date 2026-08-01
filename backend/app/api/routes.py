from __future__ import annotations

import logging

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from app.core import config
from app.core.graph_utils import graph_to_schema
from app.core.session_store import store
from app.models.schemas import (
    EditOp, LineGraph, ProcessOptions, ProcessResponse, UploadResponse,
)
from app.pipeline.edit_ops import EditError, apply_edit
from app.pipeline.export import export_dxf, export_obj, export_stl, export_svg
from app.pipeline.run import process_image, recompute_stats
from app.pipeline.thickness import buffer_graph_to_polygon, extrude_to_mesh

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


def _session_or_404(session_id: str):
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _require_graph(session):
    if session.graph is None:
        raise HTTPException(status_code=400, detail="Session has not been processed yet -- call /process first")
    return session.graph


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)):
    contents = await file.read()
    arr = np.frombuffer(contents, dtype=np.uint8)
    image_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode image -- unsupported or corrupt file")

    session = store.create(image_bgr)
    return UploadResponse(session_id=session.id, width=session.width, height=session.height)


@router.get("/session/{session_id}/image")
def get_source_image(session_id: str):
    session = _session_or_404(session_id)
    ok, buf = cv2.imencode(".png", session.image_bgr)
    if not ok:
        raise HTTPException(status_code=500, detail="Could not encode source image")
    return Response(content=buf.tobytes(), media_type="image/png")


@router.post("/process/{session_id}", response_model=ProcessResponse)
def process(session_id: str, options: ProcessOptions):
    session = _session_or_404(session_id)
    try:
        graph, stats, scale_px_per_mm, w, h = process_image(session.image_bgr, options)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    session.graph = graph
    session.scale_px_per_mm = scale_px_per_mm
    session.options = options
    session.mode = options.mode
    session.stats = stats

    line_graph = graph_to_schema(graph, options.thickness_mm, options.depth_mm, w, h, scale_px_per_mm, stats)
    return ProcessResponse(session_id=session_id, graph=line_graph)


@router.get("/session/{session_id}/graph", response_model=LineGraph)
def get_graph(session_id: str):
    session = _session_or_404(session_id)
    graph = _require_graph(session)
    return graph_to_schema(
        graph, session.options.thickness_mm, session.options.depth_mm,
        session.width, session.height, session.scale_px_per_mm, session.stats,
    )


@router.post("/session/{session_id}/edit", response_model=ProcessResponse)
def edit(session_id: str, op: EditOp):
    session = _session_or_404(session_id)
    graph = _require_graph(session)
    try:
        apply_edit(graph, op)
    except EditError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    stats = recompute_stats(graph, session.scale_px_per_mm, session.options.thickness_mm, session.options.depth_mm, session.mode)
    session.stats = stats

    line_graph = graph_to_schema(
        graph, session.options.thickness_mm, session.options.depth_mm,
        session.width, session.height, session.scale_px_per_mm, stats,
    )
    return ProcessResponse(session_id=session_id, graph=line_graph)


@router.put("/session/{session_id}/thickness", response_model=ProcessResponse)
def set_thickness(session_id: str, width_mm: float, depth_mm: float | None = None):
    session = _session_or_404(session_id)
    graph = _require_graph(session)
    if width_mm <= 0:
        raise HTTPException(status_code=422, detail="width_mm must be positive")
    session.options.thickness_mm = width_mm
    if depth_mm is not None:
        session.options.depth_mm = depth_mm

    stats = recompute_stats(graph, session.scale_px_per_mm, session.options.thickness_mm, session.options.depth_mm, session.mode)
    session.stats = stats
    line_graph = graph_to_schema(
        graph, session.options.thickness_mm, session.options.depth_mm,
        session.width, session.height, session.scale_px_per_mm, stats,
    )
    return ProcessResponse(session_id=session_id, graph=line_graph)


@router.get("/session/{session_id}/export/svg")
def export_svg_route(session_id: str):
    session = _session_or_404(session_id)
    graph = _require_graph(session)
    path = config.EXPORT_DIR / f"{session_id}.svg"
    export_svg(graph, path)
    return FileResponse(path, media_type="image/svg+xml", filename="oneline-studio.svg")


@router.get("/session/{session_id}/export/dxf")
def export_dxf_route(session_id: str):
    session = _session_or_404(session_id)
    graph = _require_graph(session)
    path = config.EXPORT_DIR / f"{session_id}.dxf"
    export_dxf(graph, path)
    return FileResponse(path, media_type="application/dxf", filename="oneline-studio.dxf")


def _build_mesh(session):
    graph = _require_graph(session)
    polygon = buffer_graph_to_polygon(graph, session.scale_px_per_mm, session.options.thickness_mm)
    if polygon.is_empty:
        raise HTTPException(status_code=422, detail="Graph has no printable geometry")
    return extrude_to_mesh(polygon, session.options.depth_mm)


@router.get("/session/{session_id}/export/stl")
def export_stl_route(session_id: str):
    session = _session_or_404(session_id)
    mesh = _build_mesh(session)
    path = config.EXPORT_DIR / f"{session_id}.stl"
    export_stl(mesh, path)
    return FileResponse(path, media_type="model/stl", filename="oneline-studio.stl")


@router.get("/session/{session_id}/export/obj")
def export_obj_route(session_id: str):
    session = _session_or_404(session_id)
    mesh = _build_mesh(session)
    path = config.EXPORT_DIR / f"{session_id}.obj"
    export_obj(mesh, path)
    return FileResponse(path, media_type="model/obj", filename="oneline-studio.obj")
