"""Mask -> vector polygons (with holes), the last step that still touches
raw pixels. Everything downstream operates on Shapely geometry only."""
from __future__ import annotations

import cv2
import numpy as np
from shapely.geometry import Polygon
from shapely.validation import make_valid


def mask_to_polygons(mask: np.ndarray, min_area: float = 16.0) -> list[Polygon]:
    """Convert a binary mask into a list of Shapely polygons, correctly
    nesting holes using the OpenCV contour hierarchy (RETR_CCOMP: every
    contour is either a top-level outer boundary or a direct hole of one)."""
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        return []
    hierarchy = hierarchy[0]  # (N, [next, prev, first_child, parent])

    polygons: list[Polygon] = []
    for i, contour in enumerate(contours):
        parent = hierarchy[i][3]
        if parent != -1:
            continue  # holes are handled from their parent, below
        if cv2.contourArea(contour) < min_area:
            continue
        exterior = contour.reshape(-1, 2)
        if len(exterior) < 3:
            continue

        holes = []
        child = hierarchy[i][2]
        while child != -1:
            hole_contour = contours[child]
            if cv2.contourArea(hole_contour) >= min_area and len(hole_contour) >= 3:
                holes.append(hole_contour.reshape(-1, 2))
            child = hierarchy[child][0]

        try:
            poly = Polygon(exterior, holes=holes)
            if not poly.is_valid:
                poly = make_valid(poly)
            if poly.is_empty:
                continue
            if poly.geom_type == "Polygon":
                polygons.append(poly)
            elif poly.geom_type == "MultiPolygon":
                polygons.extend(list(poly.geoms))
        except Exception:
            continue
    return polygons
