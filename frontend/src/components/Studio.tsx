"use client";

import { useMemo, useState } from "react";
import { DEFAULT_PROCESS_OPTIONS, type LineGraph, type ProcessOptions } from "@shared/types";
import { exportUrl, processImage, setThickness, sourceImageUrl, uploadImage } from "@/lib/api";
import UploadPanel from "./UploadPanel";
import OptionsPanel from "./OptionsPanel";
import GraphEditor from "./GraphEditor";
import StatsPanel from "./StatsPanel";
import ExportPanel from "./ExportPanel";
import StlPreview from "./StlPreview";
import { THICKNESS_PRESETS_MM } from "@shared/types";

type Step = "upload" | "configure" | "editor";

export default function Studio() {
  const [step, setStep] = useState<Step>("upload");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<ProcessOptions>(DEFAULT_PROCESS_OPTIONS);
  const [graph, setGraph] = useState<LineGraph | null>(null);
  const [version, setVersion] = useState(0);

  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processLoading, setProcessLoading] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setUploadLoading(true);
    setUploadError(null);
    try {
      const res = await uploadImage(file);
      setSessionId(res.session_id);
      setPreviewUrl(URL.createObjectURL(file));
      setStep("configure");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleGenerate() {
    if (!sessionId) return;
    setProcessLoading(true);
    setProcessError(null);
    try {
      const res = await processImage(sessionId, options);
      setGraph(res.graph);
      setVersion((v) => v + 1);
      setStep("editor");
    } catch (e) {
      setProcessError(e instanceof Error ? e.message : "Échec du traitement");
    } finally {
      setProcessLoading(false);
    }
  }

  function handleGraphChange(g: LineGraph) {
    setGraph(g);
    setVersion((v) => v + 1);
  }

  async function handleThicknessPreset(mm: number) {
    if (!sessionId) return;
    const res = await setThickness(sessionId, mm, options.depth_mm);
    setOptions((o) => ({ ...o, thickness_mm: mm }));
    handleGraphChange(res.graph);
  }

  const stlUrl = useMemo(
    () => (sessionId ? `${exportUrl(sessionId, "stl")}?v=${version}` : ""),
    [sessionId, version]
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="font-semibold">OneLine Studio</span>
          {step !== "upload" && (
            <button
              onClick={() => {
                setStep("upload");
                setSessionId(null);
                setGraph(null);
              }}
              className="text-sm text-neutral-500 hover:underline"
            >
              Nouvelle image
            </button>
          )}
        </div>
      </header>

      {step === "upload" && (
        <UploadPanel onUpload={handleUpload} loading={uploadLoading} error={uploadError} />
      )}

      {step === "configure" && previewUrl && (
        <OptionsPanel
          imageUrl={previewUrl}
          options={options}
          onChange={setOptions}
          onGenerate={handleGenerate}
          loading={processLoading}
          error={processError}
        />
      )}

      {step === "editor" && graph && sessionId && (
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
          <GraphEditor
            sessionId={sessionId}
            imageUrl={sourceImageUrl(sessionId)}
            graph={graph}
            onGraphChange={handleGraphChange}
          />

          <div className="flex flex-col gap-4">
            <StatsPanel stats={graph.stats} />

            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Épaisseur ({graph.width_mm} mm)
              </h3>
              <div className="flex flex-wrap gap-1">
                {THICKNESS_PRESETS_MM.map((mm) => (
                  <button
                    key={mm}
                    onClick={() => handleThicknessPreset(mm)}
                    className={`rounded-full border px-2 py-1 text-xs ${
                      graph.width_mm === mm
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-neutral-300 dark:border-neutral-700"
                    }`}
                  >
                    {mm}mm
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Aperçu STL
              </h3>
              <StlPreview stlUrl={stlUrl} reloadToken={version} />
            </div>

            <ExportPanel sessionId={sessionId} />
          </div>
        </div>
      )}
    </div>
  );
}
