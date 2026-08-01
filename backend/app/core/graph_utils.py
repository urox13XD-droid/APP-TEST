"""Conversions and small numeric helpers shared by every pipeline stage
that touches the working NetworkX graph.

Graph attribute convention (kept intentionally flat so it maps 1:1 onto
`LineGraph` in app/models/schemas.py and shared/types.ts):
  node:  x, y, locked
  edge:  id, type ("line"|"quad"|"cubic"), control_points, is_bridge, width_mm
"""
from __future__ import annotations

import math

import networkx as nx
import numpy as np
from shapely.geometry import LineString

from app.models.schemas import Edge, EdgeType, GraphStats, LineGraph, Node


def edge_to_linestring(graph: nx.Graph, u: int, v: int, samples: int = 12) -> LineString:
    """Flatten a (possibly curved) edge into a polyline in the same
    coordinate space as the node positions."""
    data = graph.edges[u, v]
    p0 = np.array([graph.nodes[u]["x"], graph.nodes[u]["y"]])
    p3 = np.array([graph.nodes[v]["x"], graph.nodes[v]["y"]])
    cps = data.get("control_points") or []

    if data.get("type") == "cubic" and len(cps) == 2:
        c1, c2 = np.array(cps[0]), np.array(cps[1])
        t = np.linspace(0, 1, samples)[:, None]
        pts = (
            (1 - t) ** 3 * p0
            + 3 * (1 - t) ** 2 * t * c1
            + 3 * (1 - t) * t ** 2 * c2
            + t ** 3 * p3
        )
        return LineString(pts)
    if data.get("type") == "quad" and len(cps) == 1:
        c1 = np.array(cps[0])
        t = np.linspace(0, 1, samples)[:, None]
        pts = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * c1 + t ** 2 * p3
        return LineString(pts)
    return LineString([tuple(p0), tuple(p3)])


def edge_length(graph: nx.Graph, u: int, v: int) -> float:
    data = graph.edges.get((u, v)) or graph.edges.get((v, u))
    if data and data.get("type") in ("cubic", "quad"):
        return edge_to_linestring(graph, u, v).length
    p0 = graph.nodes[u]
    p1 = graph.nodes[v]
    return math.hypot(p0["x"] - p1["x"], p0["y"] - p1["y"])


def total_length(graph: nx.Graph) -> float:
    return sum(edge_length(graph, u, v) for u, v in graph.edges())


def next_node_id(graph: nx.Graph) -> int:
    return (max(graph.nodes) + 1) if graph.number_of_nodes() else 0


def next_edge_id(graph: nx.Graph) -> int:
    ids = [d.get("id", 0) for _, _, d in graph.edges(data=True)]
    return (max(ids) + 1) if ids else 0


def graph_to_schema(
    graph: nx.Graph,
    width_mm: float,
    depth_mm: float,
    image_width: int,
    image_height: int,
    scale_px_per_mm: float,
    stats: GraphStats | None = None,
) -> LineGraph:
    nodes = [
        Node(id=n, x=d["x"], y=d["y"], locked=d.get("locked", False))
        for n, d in graph.nodes(data=True)
    ]
    edges = [
        Edge(
            id=d["id"],
            source=u,
            target=v,
            type=EdgeType(d.get("type", "line")),
            control_points=[tuple(cp) for cp in d.get("control_points", [])],
            is_bridge=d.get("is_bridge", False),
            width_mm=d.get("width_mm"),
        )
        for u, v, d in graph.edges(data=True)
    ]
    return LineGraph(
        nodes=nodes,
        edges=edges,
        width_mm=width_mm,
        depth_mm=depth_mm,
        image_width=image_width,
        image_height=image_height,
        scale_px_per_mm=scale_px_per_mm,
        stats=stats,
    )


def schema_to_graph(line_graph: LineGraph) -> nx.Graph:
    graph = nx.Graph()
    for node in line_graph.nodes:
        graph.add_node(node.id, x=node.x, y=node.y, locked=node.locked)
    for edge in line_graph.edges:
        graph.add_edge(
            edge.source,
            edge.target,
            id=edge.id,
            type=edge.type.value,
            control_points=[tuple(cp) for cp in edge.control_points],
            is_bridge=edge.is_bridge,
            width_mm=edge.width_mm,
        )
    return graph
