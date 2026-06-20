"use client";

import { useCallback, useEffect, useState } from "react";

// Shared per-user brand kit (saved colors + favourite fonts). Loaded once and
// cached at module scope so every colour/font control in the editor sees the
// same list and updates are reflected everywhere instantly.
interface Kit {
  colors: string[];
  fonts: string[];
}

let cache: Kit | null = null;
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

async function persist(next: Kit) {
  cache = next;
  notify();
  await fetch("/api/brand-kit", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  }).catch(() => undefined);
}

export function useBrandKit() {
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    if (cache === null) {
      cache = { colors: [], fonts: [] };
      fetch("/api/brand-kit")
        .then((r) => r.json())
        .then((d: Partial<Kit>) => {
          cache = { colors: d.colors ?? [], fonts: d.fonts ?? [] };
          notify();
        })
        .catch(() => undefined);
    }
    return () => {
      listeners.delete(l);
    };
  }, []);

  const colors = cache?.colors ?? [];
  const fonts = cache?.fonts ?? [];

  const addColor = useCallback((c: string) => {
    const cur = cache ?? { colors: [], fonts: [] };
    if (cur.colors.includes(c)) return;
    persist({ ...cur, colors: [c, ...cur.colors].slice(0, 48) });
  }, []);
  const removeColor = useCallback((c: string) => {
    const cur = cache ?? { colors: [], fonts: [] };
    persist({ ...cur, colors: cur.colors.filter((x) => x !== c) });
  }, []);
  const toggleFont = useCallback((f: string) => {
    const cur = cache ?? { colors: [], fonts: [] };
    const has = cur.fonts.includes(f);
    persist({ ...cur, fonts: has ? cur.fonts.filter((x) => x !== f) : [f, ...cur.fonts].slice(0, 48) });
  }, []);

  return { colors, fonts, addColor, removeColor, toggleFont };
}
