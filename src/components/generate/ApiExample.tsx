"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { PlaceholderDef } from "@/lib/template/schema";
import { placeholderToMod } from "@/lib/api-snippets";
import { ApiSnippet } from "./ApiSnippet";

// A complete, copy-pasteable API example for this specific template, built from
// its placeholders. Switchable across languages and image-input modes.
export function ApiExample({
  templateId,
  placeholders,
}: {
  templateId: string;
  placeholders: PlaceholderDef[];
}) {
  const [origin, setOrigin] = useState("https://your-instance");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  return (
    <div className="bnz-card p-3 p-lg-4 mt-4">
      <h2 className="h6 mb-2">Use via API</h2>
      <p className="text-secondary small mb-3">
        Submit this request to queue a render, then poll{" "}
        <code>GET /api/v1/images/&lt;id&gt;</code> until <code>status</code> is{" "}
        <code>completed</code>. Create a key under{" "}
        <Link href="/api-keys">API Keys</Link>; full reference at{" "}
        <Link href="/api-docs">/api-docs</Link>.
      </p>
      <ApiSnippet
        spec={{
          kind: "createImage",
          origin,
          templateId,
          mods: placeholders.map(placeholderToMod),
          format: "png",
        }}
      />
      {placeholders.length === 0 && (
        <p className="text-secondary small mb-0 mt-2">
          This template has no dynamic fields yet — open the editor and mark
          layers as “Dynamic field”.
        </p>
      )}
    </div>
  );
}
