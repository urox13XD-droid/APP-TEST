"use client";

import type { GraphStats } from "@shared/types";

export default function StatsPanel({ stats }: { stats: GraphStats | null }) {
  if (!stats) return null;

  const rows: [string, string][] = [
    ["Composantes", String(stats.num_components)],
    ["Ponts ajoutés", String(stats.num_bridges)],
    ["Longueur totale", `${stats.total_length_mm.toFixed(1)} mm`],
    ["Temps d'impression estimé", `${stats.estimated_print_time_min.toFixed(1)} min`],
    ["Filament estimé", `${stats.estimated_filament_g.toFixed(1)} g`],
    ["Nœuds / Arêtes", `${stats.num_nodes} / ${stats.num_edges}`],
  ];

  return (
    <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            stats.is_fully_connected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="font-medium">
          {stats.is_fully_connected ? "Entièrement connecté" : "Non connecté"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-500">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {stats.warnings.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-neutral-500">
            {stats.warnings.length} note(s) de vérification
          </summary>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-neutral-500">
            {stats.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
