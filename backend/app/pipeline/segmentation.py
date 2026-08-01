"""Object/foreground detection.

Segmentation is behind a small `Segmenter` interface with three backends:

- `OpenCVSegmenter` (default): pure classic-CV thresholding + connected
  components. Zero extra dependencies, but it has no notion of "subject" --
  on a busy photo/illustration it just latches onto whichever region has
  the strongest local contrast (which can be a background detail, not the
  subject you actually want).
- `RembgSegmenter` (`ONELINE_SEGMENTER=rembg`): a lightweight U^2-Net-based
  background-removal model (via the `rembg` package). Runs fine on CPU, has
  no GPU requirement, and auto-downloads its ~176MB model on first use.
  This is the recommended backend for photos/character art/portraits --
  it isolates the actual subject instead of an arbitrary high-contrast
  region.
- `SAM2Segmenter` (`ONELINE_SEGMENTER=sam2`): Meta's Segment Anything 2,
  for the best multi-object detection quality. Needs a downloaded
  checkpoint (hundreds of MB) and, for reasonable speed, a GPU.

Both `rembg` and `sam2` are optional extras -- if the package/checkpoint
isn't available, `get_segmenter` logs a warning and falls back to
`OpenCVSegmenter` rather than failing the request.
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


class RembgSegmenter(Segmenter):
    """Subject-aware foreground extraction via `rembg` (U^2-Net). Unlike
    `OpenCVSegmenter`, this actually recognises "there is a subject here"
    instead of just reacting to local contrast, so it correctly isolates a
    character/animal/object on a busy background (photos, illustrations)
    instead of latching onto an unrelated high-contrast region.
    """

    def __init__(self, model_name: str = "u2net"):
        try:
            from rembg import new_session, remove  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "rembg backend requested but the `rembg` package is not installed. "
                "Install it with `pip install rembg onnxruntime`, "
                "or set ONELINE_SEGMENTER=opencv to use the built-in fallback."
            ) from exc
        self._remove = remove
        # Builds/download the ONNX model on first use (~176MB, cached under
        # ~/.u2net afterwards) -- kept lazy so importing this module never
        # triggers a network call.
        self._session = new_session(model_name)

    def segment(self, image_bgr: np.ndarray, max_objects: int = 12) -> list[np.ndarray]:
        from PIL import Image

        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        cutout = self._remove(Image.fromarray(image_rgb), session=self._session)
        alpha = np.array(cutout)[:, :, 3]
        _, mask = cv2.threshold(alpha, 127, 255, cv2.THRESH_BINARY)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        # Usually one coherent subject, but split into parts if the cutout
        # left disjoint blobs (e.g. two separate objects in frame).
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        min_area = mask.size * 0.0008
        components = [
            (i, stats[i, cv2.CC_STAT_AREA])
            for i in range(1, num_labels)
            if stats[i, cv2.CC_STAT_AREA] >= min_area
        ]
        components.sort(key=lambda t: t[1], reverse=True)
        components = components[:max_objects]

        masks = [np.where(labels == label_id, 255, 0).astype(np.uint8) for label_id, _ in components]
        if not masks:
            masks = [np.full(image_bgr.shape[:2], 255, dtype=np.uint8)]
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


_segmenter_cache: dict[str, Segmenter] = {}


def get_segmenter(backend: str, checkpoint: str = "", model_cfg: str = "") -> Segmenter:
    """Instantiates (and caches) the requested segmenter. Caching matters
    here specifically because rembg/SAM2 load a model file -- without it,
    every single upload would reload the model from disk."""
    cache_key = f"{backend}:{checkpoint}:{model_cfg}"
    if cache_key in _segmenter_cache:
        return _segmenter_cache[cache_key]

    if backend == "sam2":
        try:
            segmenter: Segmenter = SAM2Segmenter(checkpoint, model_cfg)
        except RuntimeError as exc:
            logger.warning("Falling back to OpenCV segmenter: %s", exc)
            segmenter = OpenCVSegmenter()
    elif backend == "rembg":
        try:
            segmenter = RembgSegmenter()
        except RuntimeError as exc:
            logger.warning("Falling back to OpenCV segmenter: %s", exc)
            segmenter = OpenCVSegmenter()
    else:
        segmenter = OpenCVSegmenter()

    _segmenter_cache[cache_key] = segmenter
    return segmenter
