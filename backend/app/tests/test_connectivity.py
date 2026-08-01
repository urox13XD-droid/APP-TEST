import networkx as nx

from app.pipeline.connect import bridge_components, find_components


def _line_graph(edges, coords):
    g = nx.Graph()
    for n, (x, y) in coords.items():
        g.add_node(n, x=x, y=y)
    for i, (u, v) in enumerate(edges):
        g.add_edge(u, v, id=i, type="line", control_points=[], is_bridge=False)
    return g


def test_already_connected_graph_gets_no_bridges():
    g = _line_graph([(0, 1), (1, 2), (2, 0)], {0: (0, 0), 1: (1, 0), 2: (0, 1)})
    bridges = bridge_components(g)
    assert bridges == []
    assert nx.is_connected(g)


def test_two_components_get_bridged_into_one():
    edges = [(0, 1), (1, 2), (2, 0), (10, 11), (11, 12), (12, 10)]
    coords = {0: (0, 0), 1: (1, 0), 2: (0, 1), 10: (100, 100), 11: (101, 100), 12: (100, 101)}
    g = _line_graph(edges, coords)
    assert len(find_components(g)) == 2

    bridges = bridge_components(g)
    assert len(bridges) == 1
    assert nx.is_connected(g)
    u, v = bridges[0]
    assert g.edges[u, v]["is_bridge"] is True


def test_five_components_need_exactly_four_bridges():
    g = nx.Graph()
    for i in range(5):
        g.add_node(i * 3, x=i * 50, y=0)
        g.add_node(i * 3 + 1, x=i * 50 + 5, y=0)
        g.add_node(i * 3 + 2, x=i * 50, y=5)
        g.add_edge(i * 3, i * 3 + 1, id=i * 3, type="line", control_points=[], is_bridge=False)
        g.add_edge(i * 3 + 1, i * 3 + 2, id=i * 3 + 1, type="line", control_points=[], is_bridge=False)
        g.add_edge(i * 3 + 2, i * 3, id=i * 3 + 2, type="line", control_points=[], is_bridge=False)

    assert len(find_components(g)) == 5
    bridges = bridge_components(g)
    assert len(bridges) == 4  # MST over k components always needs k-1 edges
    assert nx.is_connected(g)


def test_bridge_connects_nearest_points_not_arbitrary_ones():
    # Two squares; the closest corners are (10,0) and (11,0).
    g = nx.Graph()
    g.add_node(0, x=0, y=0)
    g.add_node(1, x=10, y=0)
    g.add_node(2, x=10, y=10)
    g.add_node(3, x=0, y=10)
    for a, b in [(0, 1), (1, 2), (2, 3), (3, 0)]:
        g.add_edge(a, b, id=a, type="line", control_points=[], is_bridge=False)

    g.add_node(10, x=11, y=0)
    g.add_node(11, x=21, y=0)
    g.add_node(12, x=21, y=10)
    g.add_node(13, x=11, y=10)
    for a, b in [(10, 11), (11, 12), (12, 13), (13, 10)]:
        g.add_edge(a, b, id=a + 100, type="line", control_points=[], is_bridge=False)

    bridges = bridge_components(g)
    assert len(bridges) == 1
    endpoints = set(bridges[0])
    assert endpoints == {1, 10}
