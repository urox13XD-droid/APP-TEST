"""Stroke thickness -> printable solid.

Every edge is flattened to a polyline in millimetre space, buffered into a
round-capped ribbon of the chosen stroke width, and all ribbons are unioned
together. Because the graph is guaranteed connected (see connect.py) before
this step ever runs, the buffered ribbons always overlap at shared nodes,
so the union is always a single polygon -- never a MultiPolygon -- which is
exactly what "printable in one piece" requires.
"""
from __future__ import annotations

import networkx as nx
import numpy as np
import trimesh
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.ops import unary_union

from app.core.graph_utils import edge_to_linestring, total_length

PLA_DENSITY_G_PER_CM3 = 1.24
LAYER_HEIGHT_MM = 0.2
PRINT_SPEED_MM_PER_S = 40  # typical perimeter speed, used only for the estimate


def graph_to_mm_geometry(graph: nx.Graph, scale_px_per_mm: float, default_width_mm: float):
    """Returns a list of (LineString_mm, width_mm) ready to buffer."""
    items = []
    for u, v, data in graph.edges(data=True):
        line_px = edge_to_linestring(graph, u, v)
        coords_mm = [(x / scale_px_per_mm, y / scale_px_per_mm) for x, y in line_px.coords]
        width = data.get("width_mm") or default_width_mm
        items.append((LineString(coords_mm), width))
    return items


def buffer_graph_to_polygon(
    graph: nx.Graph, scale_px_per_mm: float, default_width_mm: float
) -> Polygon | MultiPolygon:
    items = graph_to_mm_geometry(graph, scale_px_per_mm, default_width_mm)
    if not items:
        return Polygon()
    buffered = [
        line.buffer(width / 2.0, cap_style="round", join_style="round", quad_segs=8)
        for line, width in items
        if not line.is_empty and line.length > 0
    ]
    if not buffered:
        return Polygon()
    return unary_union(buffered)


def extrude_to_mesh(polygon: Polygon | MultiPolygon, depth_mm: float) -> trimesh.Trimesh:
    if polygon.is_empty:
        raise ValueError("Cannot extrude an empty polygon -- graph has no edges.")
    if isinstance(polygon, MultiPolygon):
        # Should not normally happen once the graph is verified connected,
        # but stay robust: extrude every part and combine into one mesh.
        meshes = [trimesh.creation.extrude_polygon(p, height=depth_mm) for p in polygon.geoms]
        return trimesh.util.concatenate(meshes)
    return trimesh.creation.extrude_polygon(polygon, height=depth_mm)


def estimate_print_stats(total_length_mm: float, width_mm: float, depth_mm: float) -> tuple[float, float]:
    """Rough estimate only -- real slicers account for infill, travel
    moves, retraction and acceleration, none of which we model here."""
    volume_mm3 = total_length_mm * width_mm * depth_mm
    volume_cm3 = volume_mm3 / 1000.0
    filament_g = volume_cm3 * PLA_DENSITY_G_PER_CM3

    num_layers = max(1, round(depth_mm / LAYER_HEIGHT_MM))
    seconds_per_layer = total_length_mm / PRINT_SPEED_MM_PER_S
    total_seconds = seconds_per_layer * num_layers * 1.3  # +30% overhead (travel, accel, retraction)
    print_time_min = total_seconds / 60.0

    return round(print_time_min, 1), round(filament_g, 2)


def graph_total_length_mm(graph: nx.Graph, scale_px_per_mm: float) -> float:
    return total_length(graph) / scale_px_per_mm
