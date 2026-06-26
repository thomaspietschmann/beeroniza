"use client";

import { useEffect, useState } from "react";
import type { FontInfo } from "./types";

// The available font list never changes during an editing session, yet the
// properties panel remounts on every object mutation (key={revision}). A
// module-level cache + listener set fetches /api/fonts once and shares it across
// all mounts, instead of re-fetching on each remount. Mirrors useBrandKit.

let cache: FontInfo[] | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  if (inFlight) return inFlight;
  inFlight = fetch("/api/fonts")
    .then((r) => r.json())
    .then((d: { fonts: FontInfo[] }) => {
      cache = (d.fonts ?? []).slice().sort((a, b) => a.family.localeCompare(b.family));
      for (const l of listeners) l();
    })
    .catch(() => {
      inFlight = null; // allow a retry on the next mount
    });
  return inFlight;
}

export function useFonts(): FontInfo[] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    if (cache === null) void load();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return cache ?? [];
}
