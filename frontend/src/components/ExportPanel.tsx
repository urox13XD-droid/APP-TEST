"use client";

import { exportUrl } from "@/lib/api";

const FORMATS = [
  { key: "svg" as const, label: "SVG", hint: "vecteur 2D" },
  { key: "dxf" as const, label: "DXF", hint: "CAO / laser" },
  { key: "stl" as const, label: "STL", hint: "impression 3D" },
  { key: "obj" as const, label: "OBJ", hint: "mesh 3D" },
];

export default function ExportPanel({ sessionId }: { sessionId: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Export</h3>
      <div className="grid grid-cols-2 gap-2">
        {FORMATS.map((f) => (
          <a
            key={f.key}
            href={exportUrl(sessionId, f.key)}
            className="rounded border border-neutral-300 px-3 py-2 text-center text-sm hover:border-blue-500 dark:border-neutral-700"
          >
            <div className="font-medium">{f.label}</div>
            <div className="text-xs text-neutral-500">{f.hint}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
