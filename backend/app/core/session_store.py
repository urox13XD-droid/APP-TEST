"""In-memory session store.

An MVP-scoped choice: sessions live in process memory, keyed by uuid, and
are lost on restart. That's fine for a single-container deployment; a
production build would swap this for Redis/Postgres without touching any
pipeline code, since everything downstream only depends on this interface.
"""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field

import networkx as nx
import numpy as np

from app.models.schemas import GraphStats, Mode, ProcessOptions


@dataclass
class Session:
    id: str
    image_bgr: np.ndarray
    width: int
    height: int
    graph: nx.Graph | None = None
    scale_px_per_mm: float = 1.0
    options: ProcessOptions = field(default_factory=ProcessOptions)
    stats: GraphStats | None = None
    mode: Mode = Mode.artistic


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._lock = threading.Lock()

    def create(self, image_bgr: np.ndarray) -> Session:
        session_id = uuid.uuid4().hex
        h, w = image_bgr.shape[:2]
        session = Session(id=session_id, image_bgr=image_bgr, width=w, height=h)
        with self._lock:
            self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> Session | None:
        with self._lock:
            return self._sessions.get(session_id)

    def delete(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)


store = SessionStore()
