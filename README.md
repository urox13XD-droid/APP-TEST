# OneLine Studio

Turn any image into a **Line Art** drawing that is:

- entirely connected (never a disconnected/floating piece)
- free of dangling or dead lines
- printable as a single piece on an FDM 3D printer
- exportable as SVG, DXF, STL and OBJ

The result is not a simple vectorization/trace. The pipeline detects shapes,
simplifies them, and **reconstructs** the artwork from lines, arcs and Bézier
curves — never by following raw pixels — then guarantees single-component
connectivity by automatically bridging any disjoint pieces.

## Live demo of the pipeline

1. Upload an image with two separate shapes (e.g. a circle and a square that
   don't touch).
2. OneLine Studio detects both shapes, simplifies their outlines, and
   reconstructs each as a closed loop of lines/curves.
3. Because the two loops are disconnected, the connectivity engine computes
   the shortest bridge between them and adds it automatically (shown as a
   dashed red line in the editor).
4. The result — one silhouette, one bridge, one connected graph — is
   buffered to the chosen stroke width and extruded into a single
   watertight 3D mesh, ready to export and print in one piece.

## Architecture

```
/frontend   Next.js + React + Tailwind + KonvaJS (editor) + Three.js (STL preview)
/backend    FastAPI + OpenCV + NetworkX + Shapely + Trimesh (+ optional SAM2)
/shared     TypeScript types mirrored 1:1 by the backend's Pydantic schemas
```

### Pipeline (backend/app/pipeline)

| Stage | Module | What it does |
|---|---|---|
| 1-2. Detection | `segmentation.py` | Finds objects/shapes in the image. Default backend is pure OpenCV (Otsu + Canny + connected components) — no model download required. A `SAM2Segmenter` adapter is wired in behind the same interface for higher-quality detection when the optional `sam2` package + checkpoint are available (see below). |
| 3. Analysis | `contours.py` | Converts masks to Shapely polygons, correctly nesting holes via the OpenCV contour hierarchy. |
| 4. Simplification | `simplify.py` | Douglas-Peucker vertex reduction + removal of small holes/islands (screws, engravings, texture noise), tuned per creative **mode**. |
| 5. Reconstruction | `reconstruct.py` | Converts simplified polygon rings into a graph of `Node`s joined by straight or cubic-Bézier `Edge`s (Catmull-Rom fit) — never a raw pixel path. |
| 6. Connectivity | `connect.py` | Detects connected components (NetworkX) and bridges them with the minimum-spanning-tree of nearest-point distances: the smallest possible number of bridges, always resulting in exactly one component. |
| 7. Verification | `verify.py` | Auto-fixes short edges / isolated nodes, re-bridges if anything is still disconnected, and reports sharp-angle warnings. |
| 8-9. Thickness & preview | `thickness.py` | Buffers every edge to the chosen stroke width (mm) with Shapely, unions the ribbons into a single polygon, and extrudes it to a solid mesh with Trimesh. |
| 10. Export | `export.py` | SVG / DXF (from the graph) and STL / OBJ (from the extruded mesh). |

The **single-connected-component invariant is enforced continuously**: every
interactive edit (`edit_ops.py`) is followed by a fresh verification pass, so
deleting an edge that would disconnect the graph is immediately healed with a
new bridge rather than left broken.

### Frontend (frontend/src)

- `components/UploadPanel.tsx` — drag & drop upload
- `components/OptionsPanel.tsx` — mode selector (Minimal / Artistique /
  Cartoon / Poster / Métal découpé / Impression 3D) + thickness presets
  (2/3/4/5/6/8/10 mm)
- `components/GraphEditor.tsx` — KonvaJS canvas: select/delete a line,
  drag nodes, draw a bridge, add a connection, merge two nodes, thicken a
  branch — every action calls the backend and re-renders the live-updated
  graph
- `components/StlPreview.tsx` — Three.js viewer (STLLoader + OrbitControls)
- `components/StatsPanel.tsx` — components / bridges / total length /
  estimated print time / estimated filament weight
- `components/ExportPanel.tsx` — SVG / DXF / STL / OBJ downloads

## Running locally (without Docker)

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

Run the test suite (27 tests covering connectivity/bridging, verification,
the end-to-end pipeline, export, and the API):

```bash
pytest
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000.

## Running with Docker Compose

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000 (docs at `/docs`)

> **Note:** the Dockerfiles were written and reviewed against the same
> dependency versions verified locally (see `backend/requirements.txt` /
> `frontend/package.json`), but pulling base images was blocked by this
> development sandbox's network policy, so the actual `docker build` could
> not be executed here. Please run `docker compose up --build` in an
> environment with normal Docker Hub access to verify before deploying.

## Options

### Modes

| Mode | Behaviour |
|---|---|
| Minimal | Fewest lines, only the main silhouette |
| Artistique | Smooth Bézier curves, balanced detail |
| Cartoon | Bold, rounded, stylised |
| Poster | Bold flat shapes, high contrast |
| Métal découpé | Laser/plasma-cut friendly, wider struts, straight segments |
| Impression 3D | Tuned for FDM printing; strict connectivity is enforced in every mode, but this preset biases simplification/curve settings toward a printable result |

### Thickness

2 / 3 / 4 / 5 / 6 / 8 / 10 mm, adjustable live after generation (re-buffers
and re-extrudes without re-running detection).

### Editing tools

- **Sélectionner** — click a line to delete it or set a per-branch width override
- **Déplacer** — drag a node
- **Pont** — click two nodes to force-connect them with a bridge (counted in stats)
- **Connexion** — click two nodes to add a plain line between them
- **Fusionner** — click two nodes to merge them into one

Every edit immediately re-verifies the graph; if a deletion disconnects
anything, a new minimal bridge is added automatically so the artwork always
stays printable in one piece.

## API overview

Full interactive docs at `/docs` (OpenAPI). Key endpoints:

- `POST /api/upload` — multipart image upload → `session_id`
- `POST /api/process/{session_id}` — run the full pipeline with `ProcessOptions`
- `GET /api/session/{session_id}/graph` — current graph + stats
- `POST /api/session/{session_id}/edit` — apply one `EditOp`
- `PUT /api/session/{session_id}/thickness` — change stroke width/depth without re-detecting
- `GET /api/session/{session_id}/export/{svg|dxf|stl|obj}`
- `GET /api/session/{session_id}/image` — original uploaded image (used as the editor background)

## Choosing a segmentation backend

The default `opencv` segmenter needs no setup and works well on clean line
art, logos and scanned drawings. It has no notion of "subject" though — on
a busy photo or illustration it just reacts to local contrast, which can
latch onto an irrelevant background detail instead of the character/object
you actually wanted. Two better options:

### `rembg` (recommended for photos/character art, CPU-only)

A lightweight U^2-Net background-removal model. Actually recognises "there
is a subject here", isolates it, and needs no GPU — the ~176MB model
auto-downloads on first use.

```bash
pip install rembg onnxruntime
export ONELINE_SEGMENTER=rembg
```

Note this still produces a **silhouette/outline** of the subject (its
outer boundary + any holes), not a fully-detailed sketch with internal
lines (face, clothing folds, etc.) — tracing internal detail lines would be
a separate future feature.

### `sam2` (best quality, needs a GPU)

Meta's Segment Anything 2 gives the best multi-object detection quality.

```bash
pip install sam2  # + follow its instructions to download a checkpoint
export ONELINE_SEGMENTER=sam2
export ONELINE_SAM2_CHECKPOINT=/path/to/sam2_hiera_large.pt
export ONELINE_SAM2_MODEL_CFG=sam2_hiera_l.yaml
```

SAM2 needs a GPU for reasonable latency and a multi-hundred-MB checkpoint
download, so it's kept optional. For both `rembg` and `sam2`: if the
package/checkpoint isn't available, the backend logs a warning and
transparently falls back to `opencv` rather than failing the request.

## Known limitations / honest scope notes

- Sessions are stored in-memory (see `backend/app/core/session_store.py`);
  restarting the backend loses in-progress work. Swapping in Redis/Postgres
  would not require touching any pipeline code.
- Print time / filament estimates (`thickness.py::estimate_print_stats`) are
  a simple geometric heuristic (length × width × depth, plus a flat
  overhead factor) — not a real slicer simulation.
- DXF export flattens curves to polylines (standard practice for laser/CNC
  workflows) rather than emitting true DXF splines.
- The "Métal découpé" and "Impression 3D" modes currently differ from the
  others only in their simplification/curve tuning; they do not yet run a
  distinct manufacturability solver (e.g. minimum kerf width enforcement for
  laser cutting).
