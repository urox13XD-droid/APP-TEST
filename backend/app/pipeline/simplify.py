"""Vertex reduction and small-detail removal.

This is where "screws, engravings, wrinkles, small holes, texture noise"
get discarded -- anything geometrically smaller than the mode's detail
floor is dropped *before* reconstruction, so the line-art step never has
to chase pixel-level noise.
"""
from __future__ import annotations

from dataclasses import dataclass

from shapely.geometry import MultiPolygon, Polygon
from shapely.validation import make_valid

from app.models.schemas import Mode


@dataclass(frozen=True)
class ModePreset:
    """Tunables per creative mode. `simplify_tolerance_ratio` and the area
    ratios are relative to image diagonal / image area so they scale with
    resolution."""
    simplify_tolerance_ratio: float
    min_hole_area_ratio: float
    min_island_area_ratio: float
    smooth: bool  # whether to fit bezier curves instead of straight segments


MODE_PRESETS: dict[Mode, ModePreset] = {
    Mode.minimal: ModePreset(0.010, 0.0035, 0.005, smooth=False),
    Mode.artistic: ModePreset(0.004, 0.0012, 0.0018, smooth=True),
    Mode.cartoon: ModePreset(0.006, 0.0020, 0.0028, smooth=True),
    Mode.poster: ModePreset(0.012, 0.0040, 0.006, smooth=False),
    Mode.metal: ModePreset(0.008, 0.0030, 0.0045, smooth=False),
    Mode.print3d: ModePreset(0.007, 0.0025, 0.0040, smooth=True),
}


def simplify_polygon(poly: Polygon, tolerance: float, min_hole_area: float) -> Polygon | None:
    """Douglas-Peucker simplify the exterior + each hole ring, then drop
    holes that became smaller than `min_hole_area` (the "remove small
    holes/screws/engravings" requirement)."""
    simplified = poly.simplify(tolerance, preserve_topology=True)
    if simplified.is_empty:
        return None
    if simplified.geom_type != "Polygon":
        simplified = max(simplified.geoms, key=lambda g: g.area) if hasattr(simplified, "geoms") else simplified
        if simplified.geom_type != "Polygon":
            return None

    kept_holes = [
        interior for interior in simplified.interiors
        if Polygon(interior).area >= min_hole_area
    ]
    result = Polygon(simplified.exterior, holes=[list(h.coords) for h in kept_holes])
    if not result.is_valid:
        result = make_valid(result)
        if result.geom_type == "MultiPolygon":
            result = max(result.geoms, key=lambda g: g.area)
    return result if not result.is_empty else None


def simplify_shapes(
    polygons: list[Polygon],
    mode: Mode,
    image_diagonal: float,
    image_area: float,
    tolerance_override: float | None = None,
) -> list[Polygon]:
    """Full simplification pass: per-polygon vertex reduction + hole
    pruning, then island pruning across the whole set."""
    preset = MODE_PRESETS[mode]
    tolerance = tolerance_override if tolerance_override is not None else preset.simplify_tolerance_ratio * image_diagonal
    min_hole_area = preset.min_hole_area_ratio * image_area
    min_island_area = preset.min_island_area_ratio * image_area

    simplified = []
    for poly in polygons:
        result = simplify_polygon(poly, tolerance, min_hole_area)
        if result is not None and result.area >= min_island_area:
            simplified.append(result)
    return simplified
