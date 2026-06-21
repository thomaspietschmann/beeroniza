"use client";

import { useCallback, useEffect, useState } from "react";

export interface KitSummary {
  id: string;
  name: string;
  isDefault: boolean;
}

let listCache: KitSummary[] | null = null;
const listListeners = new Set<() => void>();

function notifyList() {
  for (const l of listListeners) l();
}

async function refreshList() {
  const data = await fetch("/api/brand-kit").then((r) => r.json()).catch(() => ({ kits: [] }));
  listCache = data.kits ?? [];
  notifyList();
}

// Returns the list of all brand kits and operations to create / delete / set
// the default kit. Changes are reflected immediately via the shared cache.
export function useBrandKits() {
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((x) => x + 1);
    listListeners.add(l);
    if (listCache === null) {
      listCache = [];
      refreshList();
    }
    return () => {
      listListeners.delete(l);
    };
  }, []);

  const kits = listCache ?? [];
  const defaultKit = kits.find((k) => k.isDefault) ?? null;

  const createKit = useCallback(async (name: string) => {
    const res = await fetch("/api/brand-kit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to create brand kit");
    await refreshList();
    return (await res.json()).kit as KitSummary;
  }, []);

  const deleteKit = useCallback(async (id: string) => {
    const res = await fetch(`/api/brand-kit/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const msg = await res.json().catch(() => null);
      throw new Error(msg?.error ?? "Failed to delete brand kit");
    }
    // Evict the list cache so the next render re-fetches.
    listCache = null;
    await refreshList();
  }, []);

  const setDefault = useCallback(async (id: string) => {
    await fetch(`/api/brand-kit/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    listCache = null;
    await refreshList();
  }, []);

  const renameKit = useCallback(async (id: string, name: string) => {
    await fetch(`/api/brand-kit/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (listCache) {
      listCache = listCache.map((k) => (k.id === id ? { ...k, name } : k));
      notifyList();
    }
  }, []);

  return { kits, defaultKit, createKit, deleteKit, setDefault, renameKit };
}
