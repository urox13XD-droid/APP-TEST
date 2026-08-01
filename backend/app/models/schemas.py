"""Pydantic models shared by the API layer.

The `LineGraph` shape mirrors `/shared/types.ts` on purpose: both the
Python backend and the TypeScript frontend serialise/deserialise the exact
same JSON structure, so keep the two in sync when either changes.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Mode(str, Enum):
    minimal = "minimal"
    artistic = "artistic"
    cartoon = "cartoon"
    poster = "poster"
    metal = "metal"
    print3d = "print3d"


class EdgeType(str, Enum):
    line = "line"
    quad = "quad"   # quadratic bezier, 1 control point
    cubic = "cubic"  # cubic bezier, 2 control points


class Node(BaseModel):
    id: int
    x: float
    y: float
    locked: bool = False


class Edge(BaseModel):
    id: int
    source: int
    target: int
    type: EdgeType = EdgeType.line
    control_points: list[tuple[float, float]] = Field(default_factory=list)
    is_bridge: bool = False
    width_mm: Optional[float] = None  # per-edge override, None = use global thickness


class GraphStats(BaseModel):
    num_nodes: int
    num_edges: int
    num_components: int
    num_bridges: int
    total_length_mm: float
    is_fully_connected: bool
    warnings: list[str] = Field(default_factory=list)
    estimated_print_time_min: float = 0.0
    estimated_filament_g: float = 0.0


class LineGraph(BaseModel):
    nodes: list[Node]
    edges: list[Edge]
    width_mm: float = 4.0
    depth_mm: float = 3.0
    image_width: int
    image_height: int
    scale_px_per_mm: float
    stats: Optional[GraphStats] = None


class ProcessOptions(BaseModel):
    mode: Mode = Mode.artistic
    thickness_mm: float = 4.0
    depth_mm: float = 3.0
    simplify_tolerance: Optional[float] = None  # px, None = derived from mode
    min_hole_area_ratio: float = 0.001   # relative to image area
    min_island_area_ratio: float = 0.0015
    snap_distance_px: float = 4.0
    min_edge_length_mm: float = 1.5
    min_angle_deg: float = 12.0
    target_size_mm: float = 150.0
    use_curves: bool = True
    max_objects: int = 12


class EditOpType(str, Enum):
    delete_edge = "delete_edge"
    merge_nodes = "merge_nodes"
    add_bridge = "add_bridge"
    move_node = "move_node"
    thicken_edge = "thicken_edge"
    add_connection = "add_connection"


class EditOp(BaseModel):
    type: EditOpType
    edge_id: Optional[int] = None
    node_id: Optional[int] = None
    node_a: Optional[int] = None
    node_b: Optional[int] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width_mm: Optional[float] = None


class UploadResponse(BaseModel):
    session_id: str
    width: int
    height: int


class ProcessResponse(BaseModel):
    session_id: str
    graph: LineGraph


class ErrorResponse(BaseModel):
    detail: str
