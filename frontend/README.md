# OneLine Studio — frontend

Next.js + React + Tailwind app: upload an image, choose a mode/thickness,
edit the reconstructed line-art graph with a KonvaJS canvas, preview the
extruded model with Three.js, and export SVG/DXF/STL/OBJ.

See the [root README](../README.md) for the full architecture, pipeline
explanation, and run instructions (local + Docker Compose).

## Quick start

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Requires the backend running at the URL in `NEXT_PUBLIC_API_URL`
(defaults to `http://localhost:8000`).
