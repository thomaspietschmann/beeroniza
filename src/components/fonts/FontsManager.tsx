"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";

interface FontFamilyInfo {
  family: string;
  category: string;
  bundled: boolean;
  source: string;
  faceCount: number;
  createdAt: string | null;
}

type SortKey = "family" | "source" | "category" | "date";

const PREVIEW_TEXT = "The quick brown fox jumps over 1,234 lazy dogs";

export function FontsManager() {
  const [fonts, setFonts] = useState<FontFamilyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("family");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [error, setError] = useState<string | null>(null);
  const previewStyleRef = useRef<HTMLStyleElement | null>(null);

  // Keep an up-to-date @font-face block so newly added fonts preview without a
  // full page reload (the layout's stylesheet link is cached / set at load).
  const refreshFontCss = useCallback(async () => {
    try {
      const res = await fetch("/api/fonts/css", { cache: "no-store" });
      const css = await res.text();
      let style = previewStyleRef.current;
      if (!style) {
        style = document.createElement("style");
        style.id = "bnz-fonts-preview";
        document.head.appendChild(style);
        previewStyleRef.current = style;
      }
      style.textContent = css;
    } catch {
      /* preview-only; ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fonts", { cache: "no-store" });
      const data = (await res.json()) as { fonts: FontFamilyInfo[] };
      setFonts(data.fonts ?? []);
      await refreshFontCss();
    } finally {
      setLoading(false);
    }
  }, [refreshFontCss]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = [...fonts].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "source":
        return (a.source.localeCompare(b.source) || a.family.localeCompare(b.family)) * dir;
      case "category":
        return (a.category.localeCompare(b.category) || a.family.localeCompare(b.family)) * dir;
      case "date":
        // Bundled fonts have no date; keep them at the end regardless of dir.
        if (!a.createdAt && !b.createdAt) return a.family.localeCompare(b.family);
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return (a.createdAt.localeCompare(b.createdAt) || a.family.localeCompare(b.family)) * dir;
      case "family":
      default:
        return a.family.localeCompare(b.family) * dir;
    }
  });

  async function onDelete(family: string) {
    if (!confirm(`Remove the font "${family}" from this instance?`)) return;
    setError(null);
    const res = await fetch(`/api/fonts?family=${encodeURIComponent(family)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError("Could not delete the font.");
      return;
    }
    await load();
  }

  return (
    <div>
      <div className="d-flex flex-wrap gap-3 mb-4">
        <UploadForm onDone={load} onError={setError} />
        <GoogleImportForm onDone={load} onError={setError} />
      </div>

      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      <div className="d-flex align-items-center gap-2 mb-3">
        <label className="small text-secondary mb-0">Sort by</label>
        <Form.Select
          size="sm"
          className="w-auto"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="family">Name</option>
          <option value="source">Source</option>
          <option value="category">Category</option>
          <option value="date">Date added</option>
        </Form.Select>
        <Button
          type="button"
          variant="outline-secondary"
          size="sm"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          title="Toggle sort direction"
        >
          {sortDir === "asc" ? "↑ A–Z" : "↓ Z–A"}
        </Button>
        <span className="small text-secondary ms-auto">{fonts.length} families</span>
      </div>

      {loading ? (
        <p className="text-secondary">Loading…</p>
      ) : (
        <ul className="list-unstyled m-0">
          {sorted.map((f) => (
            <li
              key={`${f.source}-${f.family}`}
              className="d-flex align-items-center gap-3 py-3 border-bottom"
            >
              <div className="flex-grow-1 min-w-0">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <strong>{f.family}</strong>
                  <SourceBadge source={f.source} category={f.category} />
                  {f.faceCount > 1 && (
                    <span className="small text-secondary">{f.faceCount} faces</span>
                  )}
                </div>
                <div
                  className="text-body"
                  style={{ fontFamily: `"${f.family}"`, fontSize: "1.4rem", lineHeight: 1.2 }}
                >
                  {PREVIEW_TEXT}
                </div>
              </div>
              {!f.bundled && (
                <Button
                  type="button"
                  variant="outline-danger"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => onDelete(f.family)}
                >
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceBadge({ source, category }: { source: string; category: string }) {
  const map: Record<string, string> = {
    bundled: "secondary",
    upload: "primary",
    google: "success",
  };
  const label = source === "bundled" ? category : source;
  return <Badge bg={map[source] ?? "secondary"}>{label}</Badge>;
}

function UploadForm({
  onDone,
  onError,
}: {
  onDone: () => Promise<void>;
  onError: (m: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [family, setFamily] = useState("");
  const [weight, setWeight] = useState(400);
  const [style, setStyle] = useState("normal");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return onError("Choose a font file first.");
    if (!family.trim()) return onError("Enter a family name.");
    onError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("family", family.trim());
      form.append("weight", String(weight));
      form.append("style", style);
      const res = await fetch("/api/fonts", { method: "POST", body: form });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        onError(d?.error ?? "Upload failed.");
        return;
      }
      setFamily("");
      if (fileRef.current) fileRef.current.value = "";
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form className="bnz-card p-3 flex-grow-1" style={{ minWidth: 280 }} onSubmit={submit}>
      <h2 className="h6 mb-3">Upload a font</h2>
      <Form.Control
        ref={fileRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/*"
        size="sm"
        className="mb-2"
        onChange={(e) => {
          // Prefill the family from the filename for convenience.
          if (!family) {
            const input = e.target as HTMLInputElement;
            const base = input.files?.[0]?.name?.replace(/\.[^.]+$/, "") ?? "";
            if (base) setFamily(base.replace(/[-_]+/g, " "));
          }
        }}
      />
      <Form.Control
        type="text"
        size="sm"
        className="mb-2"
        placeholder="Family name (used in the editor)"
        value={family}
        onChange={(e) => setFamily(e.target.value)}
      />
      <div className="d-flex gap-2 mb-2">
        <Form.Select
          size="sm"
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
        >
          {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </Form.Select>
        <Form.Select
          size="sm"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
        >
          <option value="normal">Normal</option>
          <option value="italic">Italic</option>
        </Form.Select>
      </div>
      <Button type="submit" variant="primary" size="sm" disabled={busy}>
        {busy ? "Uploading…" : "Upload font"}
      </Button>
    </Form>
  );
}

function GoogleImportForm({
  onDone,
  onError,
}: {
  onDone: () => Promise<void>;
  onError: (m: string | null) => void;
}) {
  const [family, setFamily] = useState("");
  const [weights, setWeights] = useState("400,700");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!family.trim()) return onError("Enter a Google Fonts family name.");
    onError(null);
    setBusy(true);
    try {
      const parsed = weights
        .split(",")
        .map((w) => Number.parseInt(w.trim(), 10))
        .filter((w) => Number.isFinite(w));
      const res = await fetch("/api/fonts/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family: family.trim(), weights: parsed }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        onError(d?.error ?? "Import failed.");
        return;
      }
      setFamily("");
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Form className="bnz-card p-3 flex-grow-1" style={{ minWidth: 280 }} onSubmit={submit}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h6 mb-0">Import from Google Fonts</h2>
        <a
          href="https://fonts.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="small text-secondary text-decoration-none"
          style={{ fontSize: "0.78rem" }}
        >
          Browse Google Fonts ↗
        </a>
      </div>
      <Form.Control
        type="text"
        size="sm"
        className="mb-2"
        placeholder='Exact family name, e.g. "Playfair Display"'
        value={family}
        onChange={(e) => setFamily(e.target.value)}
        list="bnz-google-suggestions"
      />
      <datalist id="bnz-google-suggestions">
        {["Roboto Slab", "Source Sans 3", "DM Sans", "Space Grotesk", "Caveat", "Pacifico", "Archivo", "Manrope"].map(
          (s) => (
            <option key={s} value={s} />
          ),
        )}
      </datalist>
      <Form.Control
        type="text"
        size="sm"
        className="mb-2"
        placeholder="Weights (e.g. 400,700)"
        value={weights}
        onChange={(e) => setWeights(e.target.value)}
      />
      <Button type="submit" variant="primary" size="sm" disabled={busy}>
        {busy ? "Importing…" : "Import font"}
      </Button>
    </Form>
  );
}