"""Object/foreground detection.

Segmentation is behind a small `Segmenter` interface so the default,
dependency-free OpenCV backend can be swapped for Meta's Segment Anything 2
simply by installing the optional `sam2` extra and setting
`ONELINE_SEGMENTER=sam2` + `ONELINE_SAM2_CHECKPOINT=/path/to/ckpt`.

SAM2 needs a downloaded checkpoint (hundreds of MB) and, for reasonable
speed, a GPU -- neither is available in every deployment, so it is wired up
as an optional adapter rather than a hard dependency.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class Segmenter(ABC):
    """Returns a list of binary uint8 masks (255 = foreground), one per
    detected object, largest first."""

    @abstractmethod
    def segment(self, image_bgr: np.ndarray, max_objects: int = 12) -> list[np.ndarray]:
        ...


class OpenCVSegmenter(Segmenter):
    """Classic-CV fallback: adaptive/Otsu thresholding + morphology +
    connected-component filtering. Works on line art, photos, logos and
    scanned drawings without any model weights."""

    def segment(self, image_bgr: np.ndarray, max_objects: int = 12) -> list[np.ndarray]:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.bilateralFilter(gray, d=7, sigmaColor=50, sigmaSpace=50)

        # Otsu picks the global split point; we then decide polarity so the
        # foreground is always the minority class (typical for a subject on
        # a plain background, and for line art on white paper).
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        if np.count_nonzero(binary) > binary.size // 2:
            binary = cv2.bitwise_not(binary)

        # Also fold in edge information so flat-shaded / low-contrast
        # regions that Otsu misses still get a boundary.
        edges = cv2.Canny(gray, 40, 120)
        combined = cv2.bitwise_or(binary, edges)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)
        combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=1)

        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(combined, connectivity=8)
        min_area = combined.size * 0.0008
        components = [
            (i, stats[i, cv2.CC_STAT_AREA])
            for i in range(1, num_labels)
            if stats[i, cv2.CC_STAT_AREA] >= min_area
        ]
        components.sort(key=lambda t: t[1], reverse=True)
        components = components[:max_objects]

        masks = []
        for label_id, _ in components:
            mask = np.where(labels == label_id, 255, 0).astype(np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
            masks.append(mask)

        if not masks:
            # Degenerate image (near-blank): fall back to "everything is
            # foreground" so downstream steps still produce an outline.
            masks = [np.full(gray.shape, 255, dtype=np.uint8)]
        return masks


class SAM2Segmenter(Segmenter):
    """Adapter around Meta's Segment Anything 2 automatic mask generator.

    Not imported eagerly: `sam2` + `torch` are heavy optional dependencies.
    Raises a clear error if the package or checkpoint is missing so the
    caller can fall back to `OpenCVSegmenter`.
    """

    def __init__(self, checkpoint: str, model_cfg: str, device: str = "cpu"):
        try:
            from sam2.build_sam import build_sam2  # type: ignore
            from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "SAM2 backend requested but the `sam2` package is not installed. "
                "Install it with `pip install sam2` and download a checkpoint, "
                "or set ONELINE_SEGMENTER=opencv to use the built-in fallback."
            ) from exc
        if not checkpoint or not model_cfg:
            raise RuntimeError(
                "ONELINE_SAM2_CHECKPOINT and ONELINE_SAM2_MODEL_CFG must be set "
                "to use the SAM2 backend."
            )
        sam2_model = build_sam2(model_cfg, checkpoint, device=device)
        self._generator = SAM2AutomaticMaskGenerator(sam2_model)

    def segment(self, image_bgr: np.ndarray, max_objects: int = 12) -> list[np.ndarray]:
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        results = self._generator.generate(image_rgb)
        results.sort(key=lambda r: r["area"], reverse=True)
        masks = [
            (r["segmentation"].astype(np.uint8) * 255) for r in results[:max_objects]
        ]
        return masks


def get_segmenter(backend: str, checkpoint: str = "", model_cfg: str = "") -> Segmenter:
    if backend == "sam2":
        try:
            return SAM2Segmenter(checkpoint, model_cfg)
        except RuntimeError as exc:
            logger.warning("Falling back to OpenCV segmenter: %s", exc)
            return OpenCVSegmenter()
    return OpenCVSegmenter()
