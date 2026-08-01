import type {
  EditOp,
  ProcessOptions,
  ProcessResponse,
  UploadResponse,
} from "@shared/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: formData });
  return handle<UploadResponse>(res);
}

export async function processImage(
  sessionId: string,
  options: ProcessOptions
): Promise<ProcessResponse> {
  const res = await fetch(`${API_BASE}/api/process/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  return handle<ProcessResponse>(res);
}

export async function applyEdit(sessionId: string, op: EditOp): Promise<ProcessResponse> {
  const res = await fetch(`${API_BASE}/api/session/${sessionId}/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(op),
  });
  return handle<ProcessResponse>(res);
}

export async function setThickness(
  sessionId: string,
  widthMm: number,
  depthMm?: number
): Promise<ProcessResponse> {
  const params = new URLSearchParams({ width_mm: String(widthMm) });
  if (depthMm !== undefined) params.set("depth_mm", String(depthMm));
  const res = await fetch(`${API_BASE}/api/session/${sessionId}/thickness?${params}`, {
    method: "PUT",
  });
  return handle<ProcessResponse>(res);
}

export function exportUrl(sessionId: string, format: "svg" | "dxf" | "stl" | "obj"): string {
  return `${API_BASE}/api/session/${sessionId}/export/${format}`;
}

export function sourceImageUrl(sessionId: string): string {
  return `${API_BASE}/api/session/${sessionId}/image`;
}

export { ApiError, API_BASE };
