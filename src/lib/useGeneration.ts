"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shared generate-then-poll machine for async render jobs. The usage filler and
// the template generate form both submit a generation and poll its status until
// it completes or fails; this hook owns that lifecycle (state, polling timer,
// cleanup) so neither component reimplements it.

export interface GenerationResult {
  id: string;
  status: string;
  image_url: string | null;
  error: string | null;
  width: number;
  height: number;
  format: string;
}

const POLL_INTERVAL = 1500;

export function useGeneration(opts: { onCompleted?: (result: GenerationResult) => void } = {}) {
  const [current, setCurrent] = useState<GenerationResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest onCompleted without re-creating the polling callbacks.
  const onCompletedRef = useRef(opts.onCompleted);
  onCompletedRef.current = opts.onCompleted;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const poll = useCallback((id: string) => {
    pollRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/generations/${id}`);
        if (!res.ok) throw new Error("Could not fetch generation status.");
        const data = (await res.json()) as GenerationResult;
        setCurrent(data);
        if (data.status === "completed" || data.status === "failed") {
          setGenerating(false);
          if (data.status === "completed" && data.image_url) {
            onCompletedRef.current?.(data);
          }
          return;
        }
        poll(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Polling failed.");
        setGenerating(false);
      }
    }, POLL_INTERVAL);
  }, []);

  // Mark generation as started (spinner on) without yet having an id — used when
  // a caller must do async work (e.g. save inputs) before submitting.
  const begin = useCallback(() => {
    setError(null);
    setCurrent(null);
    setGenerating(true);
  }, []);

  // Submit a generation to `url` with `body`, then poll. The optimistic `current`
  // is seeded as "queued" so the UI shows progress immediately.
  const start = useCallback(
    async (url: string, body: unknown, format: string) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Failed to start generation.");
        }
        const data = (await res.json()) as { id: string; status?: string };
        setCurrent({
          id: data.id,
          status: data.status ?? "queued",
          image_url: null,
          error: null,
          width: 0,
          height: 0,
          format,
        });
        poll(data.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setGenerating(false);
      }
    },
    [poll],
  );

  return { current, generating, error, setError, begin, start };
}
