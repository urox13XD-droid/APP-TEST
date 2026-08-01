"""Pipeline orchestrator: wires every stage together in the order from the
spec -- detect, analyse/simplify, reconstruct, connect, verify."""
from __future__ import annotations

import math

import cv2
import networkx as nx
import numpy as np

from app.core import config
from app.models.schemas import GraphStats, Mode, ProcessOptions
from app.pipeline.connect import bridge_components
from app.pipeline.contours import mask_to_polygons
from app.pipeline.reconstruct import polygons_to_graph
from app.pipeline.segmentation import get_segmenter
from app.pipeline.simplify import MODE_PRESETS, simplify_shapes
from app.pipeline.thickness import estimate_print_stats, graph_total_length_mm
from app.pipeline.verify import verify_and_fix


def resize_to_working_dim(image_bgr: np.ndarray, max_dim: int) -> np.ndarray:
    h, w = image_bgr.shape[:2]
    longest = max(h, w)
    if longest <= max_dim:
        return image_bgr
    scale = max_dim / longest
    return cv2.resize(image_bgr, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)


def process_image(image_bgr: np.ndarray, options: ProcessOptions) -> tuple[nx.Graph, GraphStats, float, int, int]:
    """Runs the full detect -> simplify -> reconstruct -> connect -> verify
    pipeline. Returns (graph, stats, scale_px_per_mm, width, height)."""
    image_bgr = resize_to_working_dim(image_bgr, config.MAX_WORKING_DIM)
    h, w = image_bgr.shape[:2]

    # 1-2: detection / segmentation
    segmenter = get_segmenter(config.SEGMENTER_BACKEND, config.SAM2_CHECKPOINT, config.SAM2_MODEL_CFG)
    masks = segmenter.segment(image_bgr, max_objects=options.max_objects)

    # 3: analysis -- contours/holes/islands as polygons
    polygons = []
    for mask in masks:
        polygons.extend(mask_to_polygons(mask))
    if not polygons:
        raise ValueError("No shapes could be detected in this image.")

    # 4: simplification (small holes/textures/details removed here)
    diagonal = math.hypot(w, h)
    area = float(w * h)
    simplified = simplify_shapes(polygons, options.mode, diagonal, area, options.simplify_tolerance)
    if not simplified:
        raise ValueError("Simplification removed every shape -- try a less aggressive mode.")

    # 5: reconstruction -- lines/beziers only, never raw pixel paths
    preset = MODE_PRESETS[options.mode]
    use_curves = options.use_curves and preset.smooth
    graph = polygons_to_graph(simplified, options.snap_distance_px, use_curves)

    # px -> mm scale: longest image edge maps to the requested target size
    scale_px_per_mm = max(w, h) / options.target_size_mm

    # 6-7: connectivity + verification (auto-bridges + auto-fixes short edges)
    min_edge_px = options.min_edge_length_mm * scale_px_per_mm
    report = verify_and_fix(graph, min_edge_px, options.min_angle_deg, enforce_connectivity=True)

    total_len_mm = graph_total_length_mm(graph, scale_px_per_mm)
    time_min, filament_g = estimate_print_stats(total_len_mm, options.thickness_mm, options.depth_mm)

    stats = GraphStats(
        num_nodes=graph.number_of_nodes(),
        num_edges=graph.number_of_edges(),
        num_components=report["num_components"],
        num_bridges=report["num_bridges"],
        total_length_mm=round(total_len_mm, 2),
        is_fully_connected=report["is_fully_connected"],
        warnings=report["warnings"] + report["fixes_applied"],
        estimated_print_time_min=time_min,
        estimated_filament_g=filament_g,
    )
    return graph, stats, scale_px_per_mm, w, h


def recompute_stats(graph: nx.Graph, scale_px_per_mm: float, width_mm: float, depth_mm: float, mode: Mode) -> GraphStats:
    """Recomputes connectivity + stats after an interactive edit. In
    print3d mode (and really, always) disconnection is auto-repaired with
    fresh bridges rather than merely reported."""
    report = verify_and_fix(graph, min_edge_length_px=0.0, min_angle_deg=8.0, enforce_connectivity=True)
    total_len_mm = graph_total_length_mm(graph, scale_px_per_mm)
    time_min, filament_g = estimate_print_stats(total_len_mm, width_mm, depth_mm)
    return GraphStats(
        num_nodes=graph.number_of_nodes(),
        num_edges=graph.number_of_edges(),
        num_components=report["num_components"],
        num_bridges=report["num_bridges"],
        total_length_mm=round(total_len_mm, 2),
        is_fully_connected=report["is_fully_connected"],
        warnings=report["warnings"] + report["fixes_applied"],
        estimated_print_time_min=time_min,
        estimated_filament_g=filament_g,
    )
