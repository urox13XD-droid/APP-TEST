import trimesh

from app.models.schemas import Mode, ProcessOptions
from app.pipeline.export import export_dxf, export_svg
from app.pipeline.run import process_image
from app.pipeline.thickness import buffer_graph_to_polygon, extrude_to_mesh


def test_svg_export_writes_a_path_per_edge(two_shapes_image, tmp_path):
    graph, stats, scale, w, h = process_image(two_shapes_image, ProcessOptions())
    out = tmp_path / "out.svg"
    export_svg(graph, out)
    content = out.read_text()
    assert content.count("<path") == graph.number_of_edges()


def test_dxf_export_creates_valid_file(two_shapes_image, tmp_path):
    graph, stats, scale, w, h = process_image(two_shapes_image, ProcessOptions())
    out = tmp_path / "out.dxf"
    export_dxf(graph, out)
    assert out.exists() and out.stat().st_size > 0


def test_buffered_graph_is_a_single_watertight_polygon(two_shapes_image):
    graph, stats, scale, w, h = process_image(two_shapes_image, ProcessOptions(thickness_mm=4.0))
    polygon = buffer_graph_to_polygon(graph, scale, 4.0)
    assert polygon.geom_type == "Polygon"  # never MultiPolygon: graph is connected
    assert polygon.area > 0


def test_extrusion_produces_a_single_watertight_mesh(two_shapes_image, tmp_path):
    graph, stats, scale, w, h = process_image(two_shapes_image, ProcessOptions(thickness_mm=4.0, depth_mm=3.0))
    polygon = buffer_graph_to_polygon(graph, scale, 4.0)
    mesh = extrude_to_mesh(polygon, 3.0)
    assert isinstance(mesh, trimesh.Trimesh)
    assert mesh.is_watertight
    out = tmp_path / "out.stl"
    mesh.export(str(out), file_type="stl")
    assert out.exists() and out.stat().st_size > 0
