"""Polygon rings -> vector graph.

This is the step that turns pixel contours into an actual line-art
construction: every ring becomes a chain of `Node`s joined by straight or
cubic-Bezier `Edge`s. Nothing here ever stores a raw pixel path -- only
vertices and (optionally) Bezier control points, per the "never follow
pixels, reconstruct with lines/arcs/curves" requirement.

Vertices that land within `snap_distance` of an existing node (typically
because two shapes touch, or a ring closes on itself) are merged into one
node. This both keeps the graph small and is what lets touching shapes
become naturally connected before the explicit bridging step even runs.
"""
from __future__ import annotations

import math
from collections import defaultdict

import networkx as nx
import numpy as np
from shapely.geometry import Polygon


class NodeSnapper:
    """Grid-hash based spatial dedup: O(1) average lookup, good enough at
    the vertex counts this pipeline deals with (hundreds, not millions)."""

    def __init__(self, snap_distance: float):
        self.snap_distance = max(snap_distance, 1e-6)
        self._cell_to_node: dict[tuple[int, int], int] = {}
        self._coords: dict[int, tuple[float, float]] = {}
        self._next_id = 0

    def _cell(self, x: float, y: float) -> tuple[int, int]:
        return (round(x / self.snap_distance), round(y / self.snap_distance))

    def get_or_create(self, x: float, y: float) -> int:
        # Check the 3x3 neighbourhood of grid cells so points that fall
        # just across a cell boundary still snap together.
        cx, cy = self._cell(x, y)
        best_id = None
        best_dist = self.snap_distance
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                node_id = self._cell_to_node.get((cx + dx, cy + dy))
                if node_id is None:
                    continue
                nx_, ny_ = self._coords[node_id]
                dist = math.hypot(nx_ - x, ny_ - y)
                if dist < best_dist:
                    best_dist = dist
                    best_id = node_id
        if best_id is not None:
            return best_id

        node_id = self._next_id
        self._next_id += 1
        self._coords[node_id] = (x, y)
        self._cell_to_node[cx, cy] = node_id
        return node_id


def _catmull_rom_to_bezier(points: np.ndarray, closed: bool) -> list[tuple[np.ndarray, np.ndarray]]:
    """For a polyline `points` (N, 2), return N-1 (or N for closed) cubic
    Bezier control-point pairs so the resulting curve interpolates every
    original vertex smoothly (uniform Catmull-Rom -> Bezier)."""
    n = len(points)
    controls = []
    segment_count = n if closed else n - 1
    for i in range(segment_count):
        p0 = points[(i - 1) % n] if closed or i > 0 else points[i]
        p1 = points[i % n]
        p2 = points[(i + 1) % n]
        p3 = points[(i + 2) % n] if closed or i < n - 2 else points[(i + 1) % n]
        c1 = p1 + (p2 - p0) / 6.0
        c2 = p2 - (p3 - p1) / 6.0
        controls.append((c1, c2))
    return controls


def _ring_to_graph(
    graph: nx.Graph,
    ring_coords: list[tuple[float, float]],
    snapper: NodeSnapper,
    use_curves: bool,
    edge_id_counter: "list[int]",
) -> None:
    if len(ring_coords) < 3:
        return
    # Shapely rings repeat the first point at the end; drop the duplicate.
    pts = ring_coords[:-1] if ring_coords[0] == ring_coords[-1] else ring_coords
    if len(pts) < 3:
        return

    node_ids = [snapper.get_or_create(x, y) for x, y in pts]
    for node_id, (x, y) in zip(node_ids, pts):
        if node_id not in graph:
            graph.add_node(node_id, x=x, y=y)

    n = len(node_ids)
    beziers = None
    if use_curves and n >= 4:
        beziers = _catmull_rom_to_bezier(np.array(pts, dtype=float), closed=True)

    for i in range(n):
        a, b = node_ids[i], node_ids[(i + 1) % n]
        if a == b:
            continue
        if graph.has_edge(a, b):
            continue  # already connected (e.g. degenerate/duplicate vertex)
        edge_id_counter[0] += 1
        if beziers is not None:
            c1, c2 = beziers[i]
            graph.add_edge(
                a, b, id=edge_id_counter[0], type="cubic",
                control_points=[tuple(c1), tuple(c2)], is_bridge=False,
            )
        else:
            graph.add_edge(a, b, id=edge_id_counter[0], type="line", control_points=[], is_bridge=False)


def polygons_to_graph(polygons: list[Polygon], snap_distance: float, use_curves: bool) -> nx.Graph:
    """Build the working NetworkX graph from simplified polygons. Both the
    exterior and every hole ring become closed cycles in the graph; the
    connectivity step is responsible for bridging any that end up
    disconnected from the rest."""
    graph = nx.Graph()
    snapper = NodeSnapper(snap_distance)
    edge_id_counter = [0]

    for poly in polygons:
        _ring_to_graph(graph, list(poly.exterior.coords), snapper, use_curves, edge_id_counter)
        for interior in poly.interiors:
            _ring_to_graph(graph, list(interior.coords), snapper, use_curves, edge_id_counter)

    return graph
