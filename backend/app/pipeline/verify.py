"""Structural verification pass.

Checked, per the spec: minimum segment width (enforced at extrusion time,
see thickness.py -- geometric line width has no meaning before a stroke
width is applied), minimum edge length, minimum angle between edges
meeting at a node, bridge integrity, and -- the hard requirement -- zero
islands / zero dead or suspended geometry, which here means "graph has
exactly one connected component and no self-loops or duplicate edges."
"""
from __future__ import annotations

import math

import networkx as nx

from app.pipeline.connect import bridge_components
from app.core.graph_utils import edge_length


def collapse_short_edges(graph: nx.Graph, min_length_px: float) -> int:
    """Contract edges shorter than `min_length_px` (Douglas-Peucker leaves
    some near-duplicate vertices behind, and bridges between very close
    components can be degenerate). Returns the number of edges collapsed."""
    collapsed = 0
    changed = True
    while changed:
        changed = False
        for u, v, data in list(graph.edges(data=True)):
            if not graph.has_edge(u, v):
                continue
            if data.get("type") != "line":
                continue  # never collapse a curve, it would distort the shape
            if edge_length(graph, u, v) >= min_length_px:
                continue
            if graph.nodes[u].get("locked") or graph.nodes[v].get("locked"):
                continue
            # Merge v into u, keep u's position, rewire v's other edges to u.
            for neighbor in list(graph.neighbors(v)):
                if neighbor == u:
                    continue
                edata = graph.edges[v, neighbor]
                if not graph.has_edge(u, neighbor):
                    graph.add_edge(u, neighbor, **edata)
            graph.remove_node(v)
            collapsed += 1
            changed = True
    return collapsed


def remove_isolated_nodes(graph: nx.Graph) -> int:
    isolated = [n for n in graph.nodes() if graph.degree(n) == 0]
    graph.remove_nodes_from(isolated)
    return len(isolated)


def check_min_angles(graph: nx.Graph, min_angle_deg: float) -> list[str]:
    warnings: list[str] = []
    for node in graph.nodes():
        neighbors = list(graph.neighbors(node))
        if len(neighbors) < 2:
            continue
        cx, cy = graph.nodes[node]["x"], graph.nodes[node]["y"]
        angles = []
        for nb in neighbors:
            nx_, ny_ = graph.nodes[nb]["x"], graph.nodes[nb]["y"]
            angles.append(math.degrees(math.atan2(ny_ - cy, nx_ - cx)))
        angles.sort()
        gaps = [(angles[(i + 1) % len(angles)] - angles[i]) % 360 for i in range(len(angles))]
        min_gap = min(gaps) if gaps else 360
        if min_gap < min_angle_deg:
            warnings.append(
                f"Node {node}: sharp angle {min_gap:.1f}° between adjacent edges "
                f"(< {min_angle_deg}° minimum) -- may cause a thin/weak print joint."
            )
    return warnings


def verify_and_fix(
    graph: nx.Graph,
    min_edge_length_px: float,
    min_angle_deg: float,
    enforce_connectivity: bool = True,
) -> dict:
    """Runs the full verification pass, auto-fixing what's safe to
    auto-fix (short edges, isolated nodes, disconnection) and reporting
    everything else as a warning. Returns a report dict."""
    fixes: list[str] = []

    collapsed = collapse_short_edges(graph, min_edge_length_px)
    if collapsed:
        fixes.append(f"Collapsed {collapsed} sub-minimum-length edge(s).")

    removed = remove_isolated_nodes(graph)
    if removed:
        fixes.append(f"Removed {removed} isolated node(s).")

    bridges_added: list[tuple[int, int]] = []
    if enforce_connectivity:
        bridges_added = bridge_components(graph)
        if bridges_added:
            fixes.append(f"Added {len(bridges_added)} bridge(s) to fully connect the graph.")

    self_loops = list(nx.selfloop_edges(graph))
    if self_loops:
        graph.remove_edges_from(self_loops)
        fixes.append(f"Removed {len(self_loops)} degenerate self-loop edge(s).")

    warnings = check_min_angles(graph, min_angle_deg)

    is_connected = nx.is_connected(graph) if graph.number_of_nodes() else True
    num_components = nx.number_connected_components(graph) if graph.number_of_nodes() else 0
    num_bridges = sum(1 for _, _, d in graph.edges(data=True) if d.get("is_bridge"))

    return {
        "is_fully_connected": is_connected,
        "num_components": num_components,
        "num_bridges": num_bridges,
        "bridges_added_this_pass": bridges_added,
        "fixes_applied": fixes,
        "warnings": warnings,
    }
