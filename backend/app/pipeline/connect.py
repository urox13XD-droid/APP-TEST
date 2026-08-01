"""Connected-graph enforcement.

Core guarantee of the whole app: after this step, the working graph has
exactly one connected component. If segmentation produced several
disjoint shapes (or simplification split one), we compute the minimum-
spanning-tree of nearest-point distances between components and splice in
one straight "bridge" edge per MST edge -- the smallest possible number of
bridges (k-1 for k components) with minimal total added length.
"""
from __future__ import annotations

import networkx as nx
import numpy as np
from scipy.spatial import cKDTree

from app.core.graph_utils import next_edge_id


def find_components(graph: nx.Graph) -> list[set[int]]:
    return [set(c) for c in nx.connected_components(graph)]


def _nearest_pair(graph: nx.Graph, comp_a: set[int], comp_b: set[int]) -> tuple[int, int, float]:
    ids_a = list(comp_a)
    ids_b = list(comp_b)
    coords_a = np.array([[graph.nodes[n]["x"], graph.nodes[n]["y"]] for n in ids_a])
    coords_b = np.array([[graph.nodes[n]["x"], graph.nodes[n]["y"]] for n in ids_b])

    tree = cKDTree(coords_a)
    dists, idxs = tree.query(coords_b)
    b_local = int(np.argmin(dists))
    a_local = int(idxs[b_local])
    return ids_a[a_local], ids_b[b_local], float(dists[b_local])


def bridge_components(graph: nx.Graph) -> list[tuple[int, int]]:
    """Mutates `graph` in place, adding the minimal bridge set needed to
    make it fully connected. Returns the list of (node, node) bridges
    added (empty if it was already connected)."""
    components = find_components(graph)
    if len(components) <= 1:
        return []

    comp_graph = nx.Graph()
    comp_graph.add_nodes_from(range(len(components)))
    pair_cache: dict[tuple[int, int], tuple[int, int, float]] = {}
    for i in range(len(components)):
        for j in range(i + 1, len(components)):
            na, nb, dist = _nearest_pair(graph, components[i], components[j])
            pair_cache[(i, j)] = (na, nb, dist)
            comp_graph.add_edge(i, j, weight=dist)

    mst_edges = nx.minimum_spanning_edges(comp_graph, weight="weight", data=False)

    next_id = next_edge_id(graph)
    bridges: list[tuple[int, int]] = []
    for i, j in mst_edges:
        key = (i, j) if (i, j) in pair_cache else (j, i)
        na, nb, _ = pair_cache[key]
        graph.add_edge(na, nb, id=next_id, type="line", control_points=[], is_bridge=True)
        bridges.append((na, nb))
        next_id += 1

    return bridges
