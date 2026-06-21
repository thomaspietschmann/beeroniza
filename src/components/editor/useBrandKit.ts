"use client";

import { useCallback, useEffect, useState } from "react";

export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

export interface Kit {
  id: string | null;
  name: string | null;
  isDefault: boolean;
  palettes: Palette[];
  fonts: string[];
}

// ── Per-kit cache keyed by kit ID or "default" ────────────────────────────────

const kitCaches = new Map<string, Kit | null>();
const kitListeners = new Map<string, Set<() => void>>();

function kitNotify(key: string) {
  for (const l of kitListeners.get(key) ?? []) l();
}

async function kitPersist(key: string, next: Kit) {
  kitCaches.set(key, next);
  kitNotify(key);
  if (!next.id) return; // no id yet — nothing to persist
  await fetch(`/api/brand-kit/${next.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ palettes: next.palettes, fonts: next.fonts }),
  }).catch(() => undefined);
}

function newId() {
  return crypto.randomUUID();
}

// Returns the full kit by ID (or the default kit when no id is given).
// All palette operations apply to this kit.
export function useBrandKit(kitId?: string | null) {
  const cacheKey = kitId ?? "default";
  const [, force] = useState(0);

  useEffect(() => {
    if (!kitListeners.has(cacheKey)) kitListeners.set(cacheKey, new Set());
    const l = () => force((x) => x + 1);
    kitListeners.get(cacheKey)!.add(l);

    if (!kitCaches.has(cacheKey)) {
      kitCaches.set(cacheKey, null);
      const url = kitId ? `/api/brand-kit/${kitId}` : "/api/brand-kit/default";
      fetch(url)
        .then((r) => r.json())
        .then((d: Partial<Kit>) => {
          kitCaches.set(cacheKey, {
            id: d.id ?? null,
            name: d.name ?? null,
            isDefault: d.isDefault ?? false,
            palettes: d.palettes ?? [],
            fonts: d.fonts ?? [],
          });
          kitNotify(cacheKey);
        })
        .catch(() => undefined);
    }
    return () => {
      kitListeners.get(cacheKey)?.delete(l);
    };
  }, [cacheKey, kitId]);

  const kit = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, palettes: [], fonts: [] };
  const palettes = kit.palettes;
  const fonts = kit.fonts;
  const colors = palettes.flatMap((p) => p.colors);

  const addColor = useCallback(
    (c: string) => {
      const cur = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, palettes: [], fonts: [] };
      if (cur.palettes.some((p) => p.colors.includes(c))) return;
      let newPalettes: Palette[];
      if (cur.palettes.length === 0) {
        newPalettes = [{ id: newId(), name: "Meine Farben", colors: [c] }];
      } else {
        const [first, ...rest] = cur.palettes;
        newPalettes = [{ ...first, colors: [c, ...first.colors].slice(0, 48) }, ...rest];
      }
      kitPersist(cacheKey, { ...cur, palettes: newPalettes });
    },
    [cacheKey],
  );

  const removeColor = useCallback(
    (c: string) => {
      const cur = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, palettes: [], fonts: [] };
      kitPersist(cacheKey, { ...cur, palettes: cur.palettes.map((p) => ({ ...p, colors: p.colors.filter((x) => x !== c) })) });
    },
    [cacheKey],
  );

  const toggleFont = useCallback(
    (f: string) => {
      const cur = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, palettes: [], fonts: [] };
      const has = cur.fonts.includes(f);
      kitPersist(cacheKey, { ...cur, fonts: has ? cur.fonts.filter((x) => x !== f) : [f, ...cur.fonts].slice(0, 48) });
    },
    [cacheKey],
  );

  const addPalette = useCallback(
    (name: string) => {
      const cur = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, palettes: [], fonts: [] };
      kitPersist(cacheKey, { ...cur, palettes: [...cur.palettes, { id: newId(), name, colors: [] }] });
    },
    [cacheKey],
  );

  const removePalette = useCallback(
    (id: string) => {
      const cur = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, palettes: [], fonts: [] };
      kitPersist(cacheKey, { ...cur, palettes: cur.palettes.filter((p) => p.id !== id) });
    },
    [cacheKey],
  );

  const renamePalette = useCallback(
    (id: string, name: string) => {
      const cur = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, palettes: [], fonts: [] };
      kitPersist(cacheKey, { ...cur, palettes: cur.palettes.map((p) => (p.id === id ? { ...p, name } : p)) });
    },
    [cacheKey],
  );

  const addColorToPalette = useCallback(
    (paletteId: string, c: string) => {
      const cur = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, palettes: [], fonts: [] };
      kitPersist(cacheKey, {
        ...cur,
        palettes: cur.palettes.map((p) =>
          p.id === paletteId && !p.colors.includes(c) ? { ...p, colors: [...p.colors, c].slice(0, 48) } : p,
        ),
      });
    },
    [cacheKey],
  );

  const removeColorFromPalette = useCallback(
    (paletteId: string, c: string) => {
      const cur = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, palettes: [], fonts: [] };
      kitPersist(cacheKey, {
        ...cur,
        palettes: cur.palettes.map((p) => (p.id === paletteId ? { ...p, colors: p.colors.filter((x) => x !== c) } : p)),
      });
    },
    [cacheKey],
  );

  return {
    kit,
    palettes,
    fonts,
    colors,
    addColor,
    removeColor,
    toggleFont,
    addPalette,
    removePalette,
    renamePalette,
    addColorToPalette,
    removeColorFromPalette,
  };
}
