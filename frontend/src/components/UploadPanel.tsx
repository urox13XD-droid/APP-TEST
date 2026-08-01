"use client";

import { useCallback, useRef, useState } from "react";

interface Props {
  onUpload: (file: File) => void;
  loading: boolean;
  error: string | null;
}

export default function UploadPanel({ onUpload, loading, error }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onUpload(file);
    },
    [onUpload]
  );

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">OneLine Studio</h1>
        <p className="mt-2 max-w-md text-sm text-neutral-500">
          Transforme n&apos;importe quelle image en un dessin Line Art entièrement
          connecté, imprimable en une seule pièce.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        {loading ? (
          <p className="text-sm text-neutral-500">Analyse de l&apos;image…</p>
        ) : (
          <>
            <p className="font-medium">Glisser une image ici</p>
            <p className="mt-1 text-sm text-neutral-500">ou cliquer pour parcourir</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
