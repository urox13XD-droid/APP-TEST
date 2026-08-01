"""File export: SVG (vector line art), DXF (CAD/laser), STL + OBJ (print
mesh). SVG/DXF export the graph geometry directly; STL/OBJ export the
extruded, thickness-buffered mesh produced by thickness.py.
"""
from __future__ import annotations

from pathlib import Path

import ezdxf
import networkx as nx
import svgwrite
import trimesh

from app.core.graph_utils import edge_to_linestring


def export_svg(graph: nx.Graph, path: str | Path, stroke_width_px: float = 3.0) -> None:
    xs = [d["x"] for _, d in graph.nodes(data=True)] or [0]
    ys = [d["y"] for _, d in graph.nodes(data=True)] or [0]
    width, height = (max(xs) + 20) if xs else 100, (max(ys) + 20) if ys else 100

    dwg = svgwrite.Drawing(str(path), size=(f"{width}px", f"{height}px"), profile="tiny")
    group = dwg.g(fill="none", stroke="black", stroke_width=stroke_width_px, stroke_linecap="round")

    for u, v, data in graph.edges(data=True):
        p0 = (graph.nodes[u]["x"], graph.nodes[u]["y"])
        p1 = (graph.nodes[v]["x"], graph.nodes[v]["y"])
        cps = data.get("control_points") or []
        color = "#e11d48" if data.get("is_bridge") else "black"
        if data.get("type") == "cubic" and len(cps) == 2:
            d = f"M {p0[0]},{p0[1]} C {cps[0][0]},{cps[0][1]} {cps[1][0]},{cps[1][1]} {p1[0]},{p1[1]}"
        elif data.get("type") == "quad" and len(cps) == 1:
            d = f"M {p0[0]},{p0[1]} Q {cps[0][0]},{cps[0][1]} {p1[0]},{p1[1]}"
        else:
            d = f"M {p0[0]},{p0[1]} L {p1[0]},{p1[1]}"
        group.add(dwg.path(d=d, stroke=color))

    dwg.add(group)
    dwg.save()


def export_dxf(graph: nx.Graph, path: str | Path) -> None:
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    doc.layers.add(name="LINEART", color=7)
    doc.layers.add(name="BRIDGES", color=1)

    for u, v, data in graph.edges(data=True):
        layer = "BRIDGES" if data.get("is_bridge") else "LINEART"
        if data.get("type") in ("cubic", "quad"):
            line = edge_to_linestring(graph, u, v, samples=16)
            points = [(x, -y) for x, y in line.coords]  # DXF is Y-up
            msp.add_lwpolyline(points, dxfattribs={"layer": layer})
        else:
            p0 = graph.nodes[u]
            p1 = graph.nodes[v]
            msp.add_line((p0["x"], -p0["y"]), (p1["x"], -p1["y"]), dxfattribs={"layer": layer})

    doc.saveas(str(path))


def export_stl(mesh: trimesh.Trimesh, path: str | Path) -> None:
    mesh.export(str(path), file_type="stl")


def export_obj(mesh: trimesh.Trimesh, path: str | Path) -> None:
    mesh.export(str(path), file_type="obj")
