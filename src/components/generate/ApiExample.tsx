"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Button from "react-bootstrap/Button";
import type { PlaceholderDef } from "@/lib/template/schema";

function sampleModification(p: PlaceholderDef): Record<string, string> {
  if (p.type === "image") return { name: p.key, image_url: "https://example.com/image.png" };
  if (p.type === "color") return { name: p.key, color: "#6c5ce7" };
  return { name: p.key, text: p.defaultValue ?? p.label ?? "Your text" };
}

// A complete, copy-pasteable API example for this specific template, built from
// its placeholders.
export function ApiExample({
  templateId,
  placeholders,
}: {
  templateId: string;
  placeholders: PlaceholderDef[];
}) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://your-instance");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const body = {
    template_id: templateId,
    modifications: placeholders.map(sampleModification),
    format: "png",
  };
  const json = JSON.stringify(body, null, 2);
  const curl = `curl -X POST ${origin}/api/v1/images \\\n  -H "Authorization: Bearer $BEERONIZA_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${json}'`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="bnz-card p-3 p-lg-4 mt-4">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h2 className="h6 mb-0">Use via API</h2>
        <Button type="button" variant="outline-secondary" size="sm" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <p className="text-secondary small mb-2">
        Submit this request to queue a render, then poll{" "}
        <code>GET /api/v1/images/&lt;id&gt;</code> until <code>status</code> is{" "}
        <code>completed</code>. Create a key under{" "}
        <Link href="/api-keys">API Keys</Link>; full reference at{" "}
        <Link href="/api-docs">/api-docs</Link>.
      </p>
      <pre className="bnz-code-block">
        <code>{curl}</code>
      </pre>
      {placeholders.length === 0 && (
        <p className="text-secondary small mb-0">
          This template has no dynamic fields yet — open the editor and mark
          layers as “Dynamic field”.
        </p>
      )}
    </div>
  );
}
