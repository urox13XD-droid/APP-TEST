import networkx as nx

from app.pipeline.verify import check_min_angles, collapse_short_edges, remove_isolated_nodes, verify_and_fix


def test_collapse_short_edges_merges_close_nodes():
    g = nx.Graph()
    g.add_node(0, x=0, y=0)
    g.add_node(1, x=0.05, y=0)  # 0.05px apart -- noise from simplification
    g.add_node(2, x=50, y=0)
    g.add_edge(0, 1, id=0, type="line", control_points=[], is_bridge=False)
    g.add_edge(1, 2, id=1, type="line", control_points=[], is_bridge=False)

    collapsed = collapse_short_edges(g, min_length_px=1.0)
    assert collapsed == 1
    assert g.number_of_nodes() == 2
    assert g.has_edge(0, 2)


def test_collapse_never_touches_curves():
    g = nx.Graph()
    g.add_node(0, x=0, y=0)
    g.add_node(1, x=0.01, y=0)
    g.add_edge(0, 1, id=0, type="cubic", control_points=[(0.003, 1), (0.007, 1)], is_bridge=False)
    collapsed = collapse_short_edges(g, min_length_px=5.0)
    assert collapsed == 0
    assert g.number_of_edges() == 1


def test_remove_isolated_nodes():
    g = nx.Graph()
    g.add_node(0, x=0, y=0)
    g.add_node(1, x=1, y=0)
    g.add_node(2, x=100, y=100)  # isolated
    g.add_edge(0, 1, id=0, type="line", control_points=[], is_bridge=False)
    removed = remove_isolated_nodes(g)
    assert removed == 1
    assert 2 not in g


def test_min_angle_flags_sharp_corner():
    g = nx.Graph()
    g.add_node(0, x=0, y=0)
    g.add_node(1, x=10, y=0)
    g.add_node(2, x=9, y=0.1)  # edge folds almost back on itself at node 1 -> very sharp angle
    g.add_edge(0, 1, id=0, type="line", control_points=[], is_bridge=False)
    g.add_edge(1, 2, id=1, type="line", control_points=[], is_bridge=False)
    warnings = check_min_angles(g, min_angle_deg=20)
    assert any("Node 1" in w for w in warnings)


def test_verify_and_fix_produces_single_connected_component():
    g = nx.Graph()
    g.add_node(0, x=0, y=0)
    g.add_node(1, x=1, y=0)
    g.add_node(2, x=100, y=100)
    g.add_node(3, x=101, y=100)
    g.add_edge(0, 1, id=0, type="line", control_points=[], is_bridge=False)
    g.add_edge(2, 3, id=1, type="line", control_points=[], is_bridge=False)

    report = verify_and_fix(g, min_edge_length_px=0.0, min_angle_deg=10.0)
    assert report["is_fully_connected"] is True
    assert report["num_components"] == 1
    assert nx.is_connected(g)
