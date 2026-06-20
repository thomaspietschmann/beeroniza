// Client-side face detection + upload. Runs entirely in the browser using a
// tiny pure-JS detector (pico.js, MIT) with a bundled cascade served from
// /face/facefinder — no model weights fetched from a CDN and no native image
// dependencies on the server.
//
// The detected face's center becomes a normalized focal point (0..1) stored on
// the upload, which "face gravity" cover-cropping uses to keep the face in view.

import { unpack_cascade, run_cascade, cluster_detections } from "@/lib/face/pico";
import { uploadImage, type UploadResult } from "@/lib/media/client";
import { clamp01 } from "@/lib/math";

export interface DetectedFocal {
  hasFace: boolean;
  focalX: number;
  focalY: number;
}

// Longest side the image is downscaled to before detection (speed vs. accuracy).
const DETECT_MAX_SIDE = 640;
// Minimum clustered detection score to accept a face. Lower = more faces caught
// (incl. stylized art) at the cost of occasional false positives; the manual
// focal picker is the fallback when detection misses or misfires.
const QUALITY_THRESHOLD = 9.0;

type ClassifyFn = (r: number, c: number, s: number, pixels: Uint8Array, ldim: number) => number;

let cascadePromise: Promise<ClassifyFn> | null = null;

// Loads + unpacks the face cascade once, then caches the classifier.
function loadCascade(): Promise<ClassifyFn> {
  if (!cascadePromise) {
    cascadePromise = fetch("/face/facefinder")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load face cascade");
        return res.arrayBuffer();
      })
      .then((buf) => unpack_cascade(new Int8Array(buf)) as ClassifyFn)
      .catch((err) => {
        cascadePromise = null; // allow a later retry
        throw err;
      });
  }
  return cascadePromise;
}

// Decodes a File into a downscaled grayscale buffer suitable for pico.
async function toGrayscale(file: File): Promise<{ pixels: Uint8Array; nrows: number; ncols: number } | null> {
  if (typeof document === "undefined") return null;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  try {
    const scale = Math.min(1, DETECT_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const ncols = Math.max(1, Math.round(bitmap.width * scale));
    const nrows = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = ncols;
    canvas.height = nrows;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, ncols, nrows);
    const { data } = ctx.getImageData(0, 0, ncols, nrows);

    const pixels = new Uint8Array(nrows * ncols);
    for (let i = 0; i < nrows * ncols; ++i) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      // Rec. 601 luma
      pixels[i] = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
    }
    return { pixels, nrows, ncols };
  } finally {
    bitmap.close?.();
  }
}

// Returns the normalized focal point of the most prominent frontal face, or
// null when no confident face is found. Never throws — failures yield null.
export async function detectFaceFocal(file: File): Promise<DetectedFocal | null> {
  try {
    if (!file.type.startsWith("image/")) return null;
    const [classify, gray] = await Promise.all([loadCascade(), toGrayscale(file)]);
    if (!gray) return null;

    const { pixels, nrows, ncols } = gray;
    const minDim = Math.min(nrows, ncols);
    const detections = run_cascade(
      { pixels, nrows, ncols, ldim: ncols },
      classify,
      {
        shiftfactor: 0.1,
        minsize: Math.max(20, Math.round(minDim * 0.12)),
        maxsize: minDim,
        scalefactor: 1.1,
      },
    );

    const clusters = cluster_detections(detections, 0.2) as number[][];
    let best: number[] | null = null;
    for (const cl of clusters) {
      if (cl[3] >= QUALITY_THRESHOLD && (!best || cl[3] > best[3])) best = cl;
    }
    if (!best) return null;

    // pico returns [row(y), col(x), scale, quality] in pixel coords.
    return {
      hasFace: true,
      focalX: clamp01(best[1] / ncols),
      focalY: clamp01(best[0] / nrows),
    };
  } catch {
    return null;
  }
}

// Uploads an image, attaching a detected face focal point when one is found.
export async function uploadWithDetection(file: File): Promise<UploadResult> {
  const focal = await detectFaceFocal(file).catch(() => null);
  return uploadImage(file, focal);
}
