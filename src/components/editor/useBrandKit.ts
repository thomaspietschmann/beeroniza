"use client";

import { useCallback, useEffect, useState } from "react";

export interface Kit {
  id: string | null;
  name: string | null;
  isDefault: boolean;
  colors: string[];
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
  if (!next.id) return;
  await fetch(`/api/brand-kit/${next.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ colors: next.colors, fonts: next.fonts }),
  }).catch(() => undefined);
}

// Returns the full kit by ID (or the default kit when no id is given).
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
            colors: d.colors ?? [],
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

  const kit = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, colors: [], fonts: [] };

  const addColor = useCallback(
    (c: string) => {
      const cur = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, colors: [], fonts: [] };
      if (cur.colors.includes(c)) return;
      kitPersist(cacheKey, { ...cur, colors: [c, ...cur.colors].slice(0, 48) });
    },
    [cacheKey],
  );

  const removeColor = useCallback(
    (c: string) => {
      const cur = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, colors: [], fonts: [] };
      kitPersist(cacheKey, { ...cur, colors: cur.colors.filter((x) => x !== c) });
    },
    [cacheKey],
  );

  const toggleFont = useCallback(
    (f: string) => {
      const cur = kitCaches.get(cacheKey) ?? { id: null, name: null, isDefault: false, colors: [], fonts: [] };
      const has = cur.fonts.includes(f);
      kitPersist(cacheKey, { ...cur, fonts: has ? cur.fonts.filter((x) => x !== f) : [f, ...cur.fonts].slice(0, 48) });
    },
    [cacheKey],
  );

  return { kit, colors: kit.colors, fonts: kit.fonts, addColor, removeColor, toggleFont };
}
