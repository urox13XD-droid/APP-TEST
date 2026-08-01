import numpy as np
import pytest


def make_two_shapes_image(size: int = 300) -> np.ndarray:
    """A synthetic BGR image with two disjoint black shapes on a white
    background -- exercises multi-component detection + bridging."""
    img = np.full((size, size, 3), 255, dtype=np.uint8)
    import cv2
    cv2.circle(img, (size // 4, size // 4), size // 8, (0, 0, 0), -1)
    cv2.rectangle(img, (size * 2 // 3 - 20, size * 2 // 3 - 20), (size * 2 // 3 + 20, size * 2 // 3 + 20), (0, 0, 0), -1)
    return img


def make_ring_image(size: int = 300) -> np.ndarray:
    """A single shape with a hole -- exercises hole-ring connectivity."""
    import cv2
    img = np.full((size, size, 3), 255, dtype=np.uint8)
    cv2.circle(img, (size // 2, size // 2), size // 3, (0, 0, 0), -1)
    cv2.circle(img, (size // 2, size // 2), size // 6, (255, 255, 255), -1)
    return img


@pytest.fixture
def two_shapes_image():
    return make_two_shapes_image()


@pytest.fixture
def ring_image():
    return make_ring_image()
