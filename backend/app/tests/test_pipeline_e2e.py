import networkx as nx

from app.models.schemas import Mode, ProcessOptions
from app.pipeline.run import process_image


def test_two_disjoint_shapes_end_up_as_one_connected_graph(two_shapes_image):
    options = ProcessOptions(mode=Mode.artistic, thickness_mm=4.0, use_curves=True)
    graph, stats, scale, w, h = process_image(two_shapes_image, options)

    assert nx.is_connected(graph)
    assert stats.is_fully_connected is True
    assert stats.num_components == 1
    assert stats.num_bridges >= 1
    assert stats.num_nodes > 0
    assert stats.num_edges > 0


def test_shape_with_hole_stays_single_component(ring_image):
    options = ProcessOptions(mode=Mode.minimal, thickness_mm=4.0, use_curves=False)
    graph, stats, scale, w, h = process_image(ring_image, options)

    assert nx.is_connected(graph)
    assert stats.is_fully_connected is True
    # the outer ring and the hole ring must be bridged together
    assert stats.num_bridges >= 1


def test_print3d_mode_never_leaves_a_disconnected_graph(two_shapes_image):
    options = ProcessOptions(mode=Mode.print3d, thickness_mm=3.0, use_curves=True)
    graph, stats, scale, w, h = process_image(two_shapes_image, options)
    assert nx.is_connected(graph)
    assert stats.num_components == 1


def test_scale_maps_longest_edge_to_target_size(two_shapes_image):
    options = ProcessOptions(target_size_mm=200.0)
    graph, stats, scale, w, h = process_image(two_shapes_image, options)
    assert abs(max(w, h) / scale - 200.0) < 1e-6
