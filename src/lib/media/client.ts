// Client-side media helpers shared by the media library and the usage filler.

export interface MediaFile {
  id: string;
  url: string;
  originalName: string | null;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  hasFace: boolean;
  focalX: number | null;
  focalY: number | null;
  createdAt: string;
}

export interface UploadResult {
  id: string;
  url: string;
  originalName: string | null;
  hasFace: boolean;
  focalX: number | null;
  focalY: number | null;
}

// Optional detected face focal point to persist alongside the upload.
export interface FocalInput {
  hasFace: boolean;
  focalX: number;
  focalY: number;
}

// Uploads an image to /api/uploads, optionally with a detected face focal point.
export async function uploadImage(file: File, focal?: FocalInput | null): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  if (focal?.hasFace) {
    body.append("hasFace", "true");
    body.append("focalX", String(focal.focalX));
    body.append("focalY", String(focal.focalY));
  }
  const res = await fetch("/api/uploads", { method: "POST", body });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Upload failed.");
  }
  return (await res.json()) as UploadResult;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
