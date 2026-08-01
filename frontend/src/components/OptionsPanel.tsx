"use client";

import { MODES, THICKNESS_PRESETS_MM, type ProcessOptions } from "@shared/types";

interface Props {
  imageUrl: string;
  options: ProcessOptions;
  onChange: (options: ProcessOptions) => void;
  onGenerate: () => void;
  loading: boolean;
  error: string | null;
}

export default function OptionsPanel({ imageUrl, options, onChange, onGenerate, loading, error }: Props) {
  const set = <K extends keyof ProcessOptions>(key: K, value: ProcessOptions[K]) =>
    onChange({ ...options, [key]: value });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="uploaded"
          className="max-h-[420px] w-full rounded-lg border border-neutral-200 object-contain dark:border-neutral-800"
        />
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Mode</h2>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => set("mode", m.value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  options.mode === m.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                    : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800"
                }`}
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-xs text-neutral-500">{m.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Épaisseur des lignes ({options.thickness_mm} mm)
          </h2>
          <div className="flex flex-wrap gap-2">
            {THICKNESS_PRESETS_MM.map((mm) => (
              <button
                key={mm}
                onClick={() => set("thickness_mm", mm)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  options.thickness_mm === mm
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                {mm}mm
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Hauteur d&apos;extrusion (mm)
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={options.depth_mm}
              onChange={(e) => set("depth_mm", Number(e.target.value))}
              className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Taille cible (mm, plus grand côté)
            <input
              type="number"
              min={10}
              step={10}
              value={options.target_size_mm}
              onChange={(e) => set("target_size_mm", Number(e.target.value))}
              className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={options.use_curves}
            onChange={(e) => set("use_curves", e.target.checked)}
          />
          Courbes lissées (Bézier) quand le mode le permet
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={onGenerate}
          disabled={loading}
          className="mt-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Génération…" : "Générer le Line Art"}
        </button>
      </div>
    </div>
  );
}
