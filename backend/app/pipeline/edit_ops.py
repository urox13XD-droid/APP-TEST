"""Interactive editing operations exposed to the KonvaJS editor.

Every op mutates the working graph in place and the caller (see
app/api/routes.py) always re-runs `verify_and_fix`/`recompute_stats`
afterwards -- so a deletion that disconnects the graph is immediately
healed with a fresh bridge rather than left broken. This is what "Le
logiciel met immédiatement à jour le graphe" means in practice: the
single-component invariant holds after every single edit, not just after
the initial generation.
"""
from __future__ import annotations

import networkx as nx

from app.core.graph_utils import next_edge_id
from app.models.schemas import EditOp, EditOpType


class EditError(ValueError):
    pass


def _find_edge(graph: nx.Graph, edge_id: int) -> tuple[int, int]:
    for u, v, data in graph.edges(data=True):
        if data.get("id") == edge_id:
            return u, v
    raise EditError(f"No edge with id {edge_id}")


def delete_edge(graph: nx.Graph, edge_id: int) -> None:
    u, v = _find_edge(graph, edge_id)
    graph.remove_edge(u, v)


def merge_nodes(graph: nx.Graph, node_a: int, node_b: int) -> None:
    if node_a not in graph or node_b not in graph:
        raise EditError("Both nodes must exist")
    if node_a == node_b:
        return
    for neighbor in list(graph.neighbors(node_b)):
        if neighbor == node_a:
            continue
        data = graph.edges[node_b, neighbor]
        if not graph.has_edge(node_a, neighbor):
            graph.add_edge(node_a, neighbor, **data)
    graph.remove_node(node_b)


def add_bridge(graph: nx.Graph, node_a: int, node_b: int) -> None:
    if node_a not in graph or node_b not in graph:
        raise EditError("Both nodes must exist")
    if graph.has_edge(node_a, node_b):
        return
    graph.add_edge(
        node_a, node_b, id=next_edge_id(graph), type="line",
        control_points=[], is_bridge=True,
    )


def add_connection(graph: nx.Graph, node_a: int, node_b: int) -> None:
    if node_a not in graph or node_b not in graph:
        raise EditError("Both nodes must exist")
    if graph.has_edge(node_a, node_b):
        return
    graph.add_edge(
        node_a, node_b, id=next_edge_id(graph), type="line",
        control_points=[], is_bridge=False,
    )


def move_node(graph: nx.Graph, node_id: int, x: float, y: float) -> None:
    if node_id not in graph:
        raise EditError(f"No node with id {node_id}")
    graph.nodes[node_id]["x"] = x
    graph.nodes[node_id]["y"] = y


def thicken_edge(graph: nx.Graph, edge_id: int, width_mm: float) -> None:
    u, v = _find_edge(graph, edge_id)
    if width_mm <= 0:
        raise EditError("width_mm must be positive")
    graph.edges[u, v]["width_mm"] = width_mm


def apply_edit(graph: nx.Graph, op: EditOp) -> None:
    if op.type == EditOpType.delete_edge:
        if op.edge_id is None:
            raise EditError("edge_id required")
        delete_edge(graph, op.edge_id)
    elif op.type == EditOpType.merge_nodes:
        if op.node_a is None or op.node_b is None:
            raise EditError("node_a and node_b required")
        merge_nodes(graph, op.node_a, op.node_b)
    elif op.type == EditOpType.add_bridge:
        if op.node_a is None or op.node_b is None:
            raise EditError("node_a and node_b required")
        add_bridge(graph, op.node_a, op.node_b)
    elif op.type == EditOpType.add_connection:
        if op.node_a is None or op.node_b is None:
            raise EditError("node_a and node_b required")
        add_connection(graph, op.node_a, op.node_b)
    elif op.type == EditOpType.move_node:
        if op.node_id is None or op.x is None or op.y is None:
            raise EditError("node_id, x and y required")
        move_node(graph, op.node_id, op.x, op.y)
    elif op.type == EditOpType.thicken_edge:
        if op.edge_id is None or op.width_mm is None:
            raise EditError("edge_id and width_mm required")
        thicken_edge(graph, op.edge_id, op.width_mm)
    else:
        raise EditError(f"Unknown op type {op.type}")
