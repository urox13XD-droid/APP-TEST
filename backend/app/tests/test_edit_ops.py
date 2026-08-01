import networkx as nx
import pytest

from app.models.schemas import EditOp, EditOpType
from app.pipeline.edit_ops import EditError, apply_edit
from app.pipeline.run import recompute_stats
from app.models.schemas import Mode


def _square_graph():
    g = nx.Graph()
    coords = {0: (0, 0), 1: (10, 0), 2: (10, 10), 3: (0, 10)}
    for n, (x, y) in coords.items():
        g.add_node(n, x=x, y=y)
    for i, (u, v) in enumerate([(0, 1), (1, 2), (2, 3), (3, 0)]):
        g.add_edge(u, v, id=i, type="line", control_points=[], is_bridge=False)
    return g


def test_delete_edge_then_recompute_reheals_connectivity():
    g = _square_graph()
    apply_edit(g, EditOp(type=EditOpType.delete_edge, edge_id=0))
    apply_edit(g, EditOp(type=EditOpType.delete_edge, edge_id=1))
    # node 1 is now isolated -- recompute_stats must heal this automatically
    stats = recompute_stats(g, scale_px_per_mm=1.0, width_mm=4.0, depth_mm=3.0, mode=Mode.artistic)
    assert stats.is_fully_connected is True
    assert nx.is_connected(g)


def test_move_node_updates_position():
    g = _square_graph()
    apply_edit(g, EditOp(type=EditOpType.move_node, node_id=0, x=5, y=5))
    assert g.nodes[0]["x"] == 5
    assert g.nodes[0]["y"] == 5


def test_thicken_edge_sets_override():
    g = _square_graph()
    apply_edit(g, EditOp(type=EditOpType.thicken_edge, edge_id=0, width_mm=8.0))
    assert g.edges[0, 1]["width_mm"] == 8.0


def test_add_bridge_between_disconnected_pieces_reconnects():
    g = _square_graph()
    g.add_node(10, x=100, y=100)
    g.add_node(11, x=110, y=100)
    g.add_edge(10, 11, id=99, type="line", control_points=[], is_bridge=False)
    assert not nx.is_connected(g)

    apply_edit(g, EditOp(type=EditOpType.add_bridge, node_a=0, node_b=10))
    assert nx.is_connected(g)
    assert g.edges[0, 10]["is_bridge"] is True


def test_merge_nodes_removes_one_node_and_keeps_edges():
    g = _square_graph()
    apply_edit(g, EditOp(type=EditOpType.merge_nodes, node_a=0, node_b=1))
    assert 1 not in g
    assert g.number_of_nodes() == 3


def test_delete_nonexistent_edge_raises():
    g = _square_graph()
    with pytest.raises(EditError):
        apply_edit(g, EditOp(type=EditOpType.delete_edge, edge_id=999))
