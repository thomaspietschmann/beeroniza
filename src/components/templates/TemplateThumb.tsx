"use client";

import { useEffect, useRef, useState } from "react";
import { templateDocSchema } from "@/lib/template/schema";
import { renderTemplatePreview } from "@/lib/template/fabric-render";

// Module-level cache so re-mounts / filter changes don't re-render the same
// template. Keyed by id+updatedAt so an edited template re-renders.
const cache = new Map<string, string>();
const THUMB_MAX = 420; // longest rendered side (px) before CSS scaling

// Lazily renders a real preview of a template (as designed) once the card
// scrolls into view, replacing the bare "W×H" placeholder.
export function TemplateThumb({
  id,
  updatedAt,
  width,
  height,
}: {
  id: string;
  updatedAt: string;
  width: number;
  height: number;
}) {
  const key = `${id}:${updatedAt}`;
  const [src, setSrc] = useState<string | null>(() => cache.get(key) ?? null);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (src) return;
    const node = ref.current;
    if (!node) return;
    let cancelled = false;

    async function render() {
      try {
        const res = await fetch(`/api/templates/${id}/doc`);
        if (!res.ok) throw new Error("load failed");
        const doc = (await res.json()) as { data: unknown };
        const parsed = templateDocSchema.safeParse(doc.data);
        if (!parsed.success) throw new Error("invalid doc");
        const multiplier = Math.min(1, THUMB_MAX / Math.max(width, height));
        const url = await renderTemplatePreview(parsed.data, { multiplier });
        if (cancelled) return;
        cache.set(key, url);
        setSrc(url);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          render();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(node);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [id, key, src, width, height]);

  if (src) {
    // Absolutely fill the (fixed-aspect) preview box and contain the image, so
    // portrait/landscape/square templates all scale to fit and letterbox on the
    // matching axis instead of overflowing the box.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  }
  return (
    <span ref={ref} className="text-secondary small">
      {failed ? `${width}×${height}` : "…"}
    </span>
  );
}
