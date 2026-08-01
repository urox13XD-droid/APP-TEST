/**
 * Shared types between the FastAPI backend (app/models/schemas.py) and the
 * Next.js frontend. Keep these two definitions in sync by hand -- there is
 * no codegen step in this project, so any field added on one side must be
 * mirrored here (or there).
 */

export type Mode = "minimal" | "artistic" | "cartoon" | "poster" | "metal" | "print3d";

export type EdgeType = "line" | "quad" | "cubic";

export interface GraphNode {
  id: number;
  x: number;
  y: number;
  locked: boolean;
}

export interface GraphEdge {
  id: number;
  source: number;
  target: number;
  type: EdgeType;
  control_points: [number, number][];
  is_bridge: boolean;
  width_mm: number | null;
}

export interface GraphStats {
  num_nodes: number;
  num_edges: number;
  num_components: number;
  num_bridges: number;
  total_length_mm: number;
  is_fully_connected: boolean;
  warnings: string[];
  estimated_print_time_min: number;
  estimated_filament_g: number;
}

export interface LineGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width_mm: number;
  depth_mm: number;
  image_width: number;
  image_height: number;
  scale_px_per_mm: number;
  stats: GraphStats | null;
}

export interface ProcessOptions {
  mode: Mode;
  thickness_mm: number;
  depth_mm: number;
  simplify_tolerance: number | null;
  min_hole_area_ratio: number;
  min_island_area_ratio: number;
  snap_distance_px: number;
  min_edge_length_mm: number;
  min_angle_deg: number;
  target_size_mm: number;
  use_curves: boolean;
  max_objects: number;
}

export const DEFAULT_PROCESS_OPTIONS: ProcessOptions = {
  mode: "artistic",
  thickness_mm: 4.0,
  depth_mm: 3.0,
  simplify_tolerance: null,
  min_hole_area_ratio: 0.001,
  min_island_area_ratio: 0.0015,
  snap_distance_px: 4.0,
  min_edge_length_mm: 1.5,
  min_angle_deg: 12.0,
  target_size_mm: 150.0,
  use_curves: true,
  max_objects: 12,
};

export type EditOpType =
  | "delete_edge"
  | "merge_nodes"
  | "add_bridge"
  | "move_node"
  | "thicken_edge"
  | "add_connection";

export interface EditOp {
  type: EditOpType;
  edge_id?: number;
  node_id?: number;
  node_a?: number;
  node_b?: number;
  x?: number;
  y?: number;
  width_mm?: number;
}

export interface UploadResponse {
  session_id: string;
  width: number;
  height: number;
}

export interface ProcessResponse {
  session_id: string;
  graph: LineGraph;
}

export const THICKNESS_PRESETS_MM = [2, 3, 4, 5, 6, 8, 10] as const;

export const MODES: { value: Mode; label: string; description: string }[] = [
  { value: "minimal", label: "Minimal", description: "Fewest lines, only the main silhouette" },
  { value: "artistic", label: "Artistique", description: "Smooth curves, balanced detail" },
  { value: "cartoon", label: "Cartoon", description: "Bold, rounded, stylised" },
  { value: "poster", label: "Poster", description: "Bold flat shapes, high contrast" },
  { value: "metal", label: "Métal découpé", description: "Laser/plasma-cut friendly, wide struts" },
  { value: "print3d", label: "Impression 3D", description: "Strict connectivity, no floating parts" },
];
