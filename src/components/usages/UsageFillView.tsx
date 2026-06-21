"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Spinner from "react-bootstrap/Spinner";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  templateDocSchema,
  placeholdersOf,
  type Modification,
  type PlaceholderDef,
  type TemplateDoc,
} from "@/lib/template/schema";
import { renderTemplateToDataURL } from "@/lib/template/fabric-render";
import { MediaPickerModal } from "@/components/media/MediaPickerModal";
import { uploadWithDetection } from "@/lib/face/detect-client";
import type { MediaFile } from "@/lib/media/client";
import { useGeneration, type GenerationResult } from "@/lib/useGeneration";
import { slugifyFilename, namedDownloadUrl } from "@/lib/download";
import { useBrandKit } from "@/components/editor/useBrandKit";
import styles from "./usages.module.scss";

type OutputFormat = "png" | "jpg";

// Per-placeholder value as stored in the usage. Mirrors usageValueSchema.
interface UsageValue {
  text?: string;
  fileId?: string;
  color?: string;
  faceGravity?: boolean;
  focalX?: number;
  focalY?: number;
}

interface FieldState {
  text: string;
  color: string;
  fileId: string;
  // Resolved file URL for preview/thumbnail (derived from fileId).
  fileUrl: string;
  uploading: boolean;
  // Face gravity: focal point (0..1) of the image and whether to crop toward it.
  faceGravity: boolean;
  focalX: number | null;
  focalY: number | null;
}

interface UsageResponse {
  usage: { id: string; name: string; values: Record<string, UsageValue>; templateId: string; brandKitId: string | null };
  template: { id: string; name: string; width: number; height: number; data: unknown };
}

const PREVIEW_DEBOUNCE = 350;
// Longest preview side rendered (display-only, so a large template doesn't pay
// full-resolution canvas encode cost on every debounced keystroke).
const PREVIEW_MAX = 700;

function fileUrlFor(fileId: string): string {
  return fileId ? `/api/files/${fileId}` : "";
}

function buildFields(
  placeholders: PlaceholderDef[],
  values: Record<string, UsageValue>,
): Record<string, FieldState> {
  const out: Record<string, FieldState> = {};
  for (const p of placeholders) {
    const v = values[p.key] ?? {};
    out[p.key] = {
      text: v.text ?? "",
      color: v.color ?? p.defaultValue ?? "#000000",
      fileId: v.fileId ?? "",
      fileUrl: v.fileId ? fileUrlFor(v.fileId) : "",
      uploading: false,
      faceGravity: v.faceGravity ?? false,
      focalX: typeof v.focalX === "number" ? v.focalX : null,
      focalY: typeof v.focalY === "number" ? v.focalY : null,
    };
  }
  return out;
}

// Build the persisted values payload from the current field state.
function fieldsToValues(
  placeholders: PlaceholderDef[],
  fields: Record<string, FieldState>,
): Record<string, UsageValue> {
  const out: Record<string, UsageValue> = {};
  for (const p of placeholders) {
    const f = fields[p.key];
    if (!f) continue;
    if (p.type === "text") {
      if (f.text) out[p.key] = { text: f.text };
    } else if (p.type === "color") {
      if (f.color) out[p.key] = { color: f.color };
    } else if (p.type === "image") {
      if (f.fileId) {
        const v: UsageValue = { fileId: f.fileId };
        if (f.faceGravity) {
          v.faceGravity = true;
          if (f.focalX != null && f.focalY != null) {
            v.focalX = f.focalX;
            v.focalY = f.focalY;
          }
        }
        out[p.key] = v;
      }
    }
  }
  return out;
}

// Build live-preview modifications from field state (image -> resolved file URL).
function fieldsToModifications(
  placeholders: PlaceholderDef[],
  fields: Record<string, FieldState>,
): Modification[] {
  const mods: Modification[] = [];
  for (const p of placeholders) {
    const f = fields[p.key];
    if (!f) continue;
    if (p.type === "text") {
      if (f.text) mods.push({ name: p.key, text: f.text });
    } else if (p.type === "color") {
      if (f.color) mods.push({ name: p.key, color: f.color });
    } else if (p.type === "image") {
      if (f.fileUrl) {
        const mod: Modification = { name: p.key, image_url: f.fileUrl };
        if (f.faceGravity && f.focalX != null && f.focalY != null) {
          mod.focal_point = { x: f.focalX, y: f.focalY };
        }
        mods.push(mod);
      }
    }
  }
  return mods;
}

export function UsageFillView({ usageId }: { usageId: string }) {
  const [brandKitId, setBrandKitId] = useState<string | null>(null);
  const { palettes } = useBrandKit(brandKitId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [doc, setDoc] = useState<TemplateDoc | null>(null);
  const [templateMeta, setTemplateMeta] = useState<UsageResponse["template"] | null>(null);
  const [placeholders, setPlaceholders] = useState<PlaceholderDef[]>([]);

  const [name, setName] = useState("");
  const [fields, setFields] = useState<Record<string, FieldState>>({});
  // Which image placeholder's media picker is currently open (by key).
  const [pickerKey, setPickerKey] = useState<string | null>(null);

  // Saving
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Live preview
  const [preview, setPreview] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderToken = useRef(0);

  // Generation (shared generate-then-poll machine).
  const [format, setFormat] = useState<OutputFormat>("png");
  const [downloads, setDownloads] = useState<GenerationResult[]>([]);
  const gen = useGeneration({
    onCompleted: (data) =>
      setDownloads((prev) => [data, ...prev.filter((d) => d.id !== data.id)]),
  });
  const { current, generating, error: genError } = gen;

  // ── Load the usage + current template ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/usages/${usageId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Failed to load usage.");
        }
        const data = (await res.json()) as UsageResponse;
        const parsed = templateDocSchema.safeParse(data.template.data);
        if (!parsed.success) throw new Error("This template's data is invalid.");
        const ph = placeholdersOf(parsed.data);
        if (cancelled) return;
        setDoc(parsed.data);
        setTemplateMeta(data.template);
        setPlaceholders(ph);
        setName(data.usage.name);
        setBrandKitId(data.usage.brandKitId ?? null);
        setFields(buildFields(ph, data.usage.values ?? {}));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [usageId]);

  // Cleanup the preview timer on unmount (the generation hook owns its own).
  useEffect(() => {
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  function patchField(key: string, patch: Partial<FieldState>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setDirty(true);
    setSavedAt(null);
  }

  // ── Live preview (debounced; always against the current template doc) ───
  useEffect(() => {
    if (!doc) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    const token = ++renderToken.current;
    setRendering(true);
    previewTimer.current = setTimeout(async () => {
      try {
        const mods = fieldsToModifications(placeholders, fields);
        const multiplier = Math.min(1, PREVIEW_MAX / Math.max(doc.canvas.width, doc.canvas.height));
        const url = await renderTemplateToDataURL(doc, mods, { format: "png", multiplier });
        if (token !== renderToken.current) return; // a newer render superseded this one
        setPreview(url);
        setPreviewError(null);
      } catch (err) {
        if (token !== renderToken.current) return;
        setPreviewError(err instanceof Error ? err.message : "Preview failed.");
      } finally {
        if (token === renderToken.current) setRendering(false);
      }
    }, PREVIEW_DEBOUNCE);
  }, [doc, placeholders, fields]);

  async function handleUpload(key: string, file: File) {
    patchField(key, { uploading: true });
    setSaveError(null);
    try {
      const data = await uploadWithDetection(file);
      patchField(key, {
        fileId: data.id,
        fileUrl: data.url || fileUrlFor(data.id),
        uploading: false,
        focalX: data.focalX,
        focalY: data.focalY,
        // Enable gravity by default when a face was detected.
        faceGravity: data.hasFace,
      });
    } catch (err) {
      patchField(key, { uploading: false });
      setSaveError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  function pickFromLibrary(key: string, file: MediaFile) {
    patchField(key, {
      fileId: file.id,
      fileUrl: file.url,
      focalX: file.focalX,
      focalY: file.focalY,
      faceGravity: file.hasFace,
    });
  }

  // Manual focal point: click on the thumbnail to set where the crop should
  // gravitate (the fallback when no face was detected). Also turns gravity on.
  function setFocal(key: string, e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    patchField(key, { focalX: x, focalY: y, faceGravity: true });
  }

  function clearImage(key: string) {
    patchField(key, { fileId: "", fileUrl: "", faceGravity: false, focalX: null, focalY: null });
  }

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/usages/${usageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Untitled usage",
          values: fieldsToValues(placeholders, fields),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save.");
      }
      setSavedAt(Date.now());
      setDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }, [saving, usageId, name, placeholders, fields]);

  // ── Generate + poll ─────────────────────────────────────────────────────
  async function handleGenerate() {
    gen.begin();
    // Persist current inputs first so the server renders exactly what's shown.
    await handleSave();
    await gen.start(`/api/usages/${usageId}/generate`, { format }, format);
  }

  const safeFileBase = useMemo(() => slugifyFilename(name || "usage", "usage"), [name]);

  // Append the usage name (and optionally a download flag) so the file route
  // serves a meaningful filename + extension for right-click "Save image as…"
  // and direct opens — not the bare cuid.
  function namedUrl(result: GenerationResult, dl = false): string | null {
    return result.image_url ? namedDownloadUrl(result.image_url, safeFileBase, { dl }) : null;
  }

  // Explicit filename for the <a download="…"> attribute. Must be non-empty: an
  // empty download attribute makes the browser fall back to the URL's last path
  // segment (the bare cuid, no extension), which is exactly the broken name.
  function downloadName(result: GenerationResult): string {
    return `${safeFileBase}.${result.format || "png"}`;
  }

  const aspect = useMemo(() => {
    if (!templateMeta || !templateMeta.height) return undefined;
    return `${templateMeta.width} / ${templateMeta.height}`;
  }, [templateMeta]);

  const currentPending =
    current != null && current.status !== "completed" && current.status !== "failed";

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2 text-secondary py-5">
        <Spinner animation="border" size="sm" />
        <span>Loading usage…</span>
      </div>
    );
  }

  if (loadError || !doc || !templateMeta) {
    return (
      <Alert variant="danger">
        {loadError ?? "Could not load this usage."}
      </Alert>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/templates/${templateMeta.id}`}
          className="small text-decoration-none"
        >
          ← All usages of {templateMeta.name}
        </Link>
        <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mt-2">
          <div className="flex-grow-1" style={{ maxWidth: "32rem" }}>
            <Form.Label className="small text-secondary mb-1">Usage name</Form.Label>
            <Form.Control
              className={styles.nameInput}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
                setSavedAt(null);
              }}
              placeholder="Usage name"
              maxLength={200}
            />
          </div>
          <p className="text-secondary mb-1 small">
            Template {templateMeta.width}×{templateMeta.height} ·{" "}
            <Link href={`/editor/${templateMeta.id}`} className="text-decoration-none">
              Edit template
            </Link>
          </p>
        </div>
      </div>

      <Alert variant="light" className="border small mb-4">
        Filling and saving stores your <strong>inputs</strong> — not a baked image. The preview
        and every generation always use the <strong>latest template layout</strong>, so edits to
        the template show up here automatically.
      </Alert>

      <Row className="g-4">
        {/* ── Inputs ─────────────────────────────────────────────────────── */}
        <Col xs={12} lg={6}>
          <div className="bnz-card p-3 p-lg-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="h6 mb-0">Inputs</h2>
              <span className="small text-secondary">
                {saving
                  ? "Saving…"
                  : dirty
                    ? "Unsaved changes"
                    : savedAt
                      ? "Saved"
                      : " "}
              </span>
            </div>

            {saveError && <Alert variant="danger">{saveError}</Alert>}

            {placeholders.length === 0 && (
              <Alert variant="secondary" className="mb-3">
                This template has no fillable fields yet. Open the editor and mark layers as
                “Dynamic field”. You can still generate it as-is.
              </Alert>
            )}

            {placeholders.map((p) => {
              const f = fields[p.key];
              const label = p.label || p.key;
              if (p.type === "text") {
                const long = (f?.text?.length ?? 0) > 60;
                const ph = p.defaultValue ? `e.g. ${p.defaultValue}` : `Enter ${label}…`;
                return (
                  <Form.Group className="mb-3" controlId={`f-${p.key}`} key={p.key}>
                    <Form.Label className="fw-semibold">{label}</Form.Label>
                    {long ? (
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={f?.text ?? ""}
                        onChange={(e) => patchField(p.key, { text: e.target.value })}
                        placeholder={ph}
                      />
                    ) : (
                      <Form.Control
                        value={f?.text ?? ""}
                        onChange={(e) => patchField(p.key, { text: e.target.value })}
                        placeholder={ph}
                      />
                    )}
                  </Form.Group>
                );
              }
              if (p.type === "color") {
                const activePalettes = palettes.filter((pal) => pal.colors.length > 0);
                return (
                  <Form.Group className="mb-3" controlId={`f-${p.key}`} key={p.key}>
                    <Form.Label className="fw-semibold">{label}</Form.Label>
                    <div className="d-flex align-items-center gap-2">
                      <Form.Control
                        type="color"
                        value={f?.color || "#000000"}
                        onChange={(e) => patchField(p.key, { color: e.target.value })}
                        title={label}
                        style={{ width: "3rem" }}
                      />
                      <Form.Control
                        value={f?.color ?? ""}
                        onChange={(e) => patchField(p.key, { color: e.target.value })}
                        className="bnz-mono"
                        style={{ maxWidth: "9rem" }}
                      />
                    </div>
                    {activePalettes.length > 0 && (
                      <div className="mt-2 d-flex flex-column gap-1">
                        {activePalettes.map((pal) => (
                          <div key={pal.id}>
                            <div className="text-secondary mb-1" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              {pal.name}
                            </div>
                            <div className="d-flex flex-wrap gap-1">
                              {pal.colors.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  title={c}
                                  aria-label={`Farbe ${c} verwenden`}
                                  onClick={() => patchField(p.key, { color: c })}
                                  style={{
                                    width: "1.5rem",
                                    height: "1.5rem",
                                    borderRadius: "0.3rem",
                                    border: f?.color === c ? "2px solid var(--bs-primary)" : "1px solid var(--bs-border-color)",
                                    background: c,
                                    padding: 0,
                                    cursor: "pointer",
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Form.Group>
                );
              }
              // image
              return (
                <Form.Group className="mb-3" controlId={`f-${p.key}`} key={p.key}>
                  <Form.Label className="fw-semibold">{label}</Form.Label>
                  {f?.fileUrl && (
                    <div className="mb-2">
                      <div className="d-flex align-items-start gap-2">
                        <div className={styles.focalWrap}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={f.fileUrl}
                            alt=""
                            className={styles.fieldThumb}
                            style={f.faceGravity ? { cursor: "crosshair" } : undefined}
                            onClick={f.faceGravity ? (e) => setFocal(p.key, e) : undefined}
                            title={f.faceGravity ? "Click to set the focal point" : undefined}
                          />
                          {f.faceGravity && (
                            <span
                              className={styles.focalMarker}
                              style={{
                                left: `${(f.focalX ?? 0.5) * 100}%`,
                                top: `${(f.focalY ?? 0.5) * 100}%`,
                              }}
                            />
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline-secondary"
                          onClick={() => clearImage(p.key)}
                        >
                          Clear
                        </Button>
                      </div>
                      <Form.Check
                        type="switch"
                        id={`grav-${p.key}`}
                        className="mt-2 small"
                        label={
                          f.focalX != null
                            ? "Face gravity — crop toward the marked point"
                            : "Face gravity — click the image to set the point"
                        }
                        checked={f.faceGravity}
                        onChange={(e) => patchField(p.key, { faceGravity: e.target.checked })}
                      />
                    </div>
                  )}
                  <div className="d-flex align-items-center gap-2">
                    <Form.Control
                      type="file"
                      accept="image/*"
                      size="sm"
                      disabled={f?.uploading}
                      onChange={(e) => {
                        const input = e.target as HTMLInputElement;
                        const file = input.files?.[0];
                        if (file) handleUpload(p.key, file);
                        input.value = "";
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline-dark"
                      className="flex-shrink-0"
                      disabled={f?.uploading}
                      onClick={() => setPickerKey(p.key)}
                    >
                      Library
                    </Button>
                    {f?.uploading && <Spinner size="sm" animation="border" />}
                  </div>
                </Form.Group>
              );
            })}

            <div className="d-flex flex-wrap align-items-center gap-2 mt-4">
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Form.Select
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
                style={{ maxWidth: "7rem" }}
                aria-label="Output format"
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="webp">WebP</option>
              </Form.Select>
              <Button variant="dark" onClick={handleGenerate} disabled={generating}>
                {generating ? "Generating…" : "Generate"}
              </Button>
            </div>
          </div>
        </Col>

        {/* ── Preview + result ───────────────────────────────────────────── */}
        <Col xs={12} lg={6}>
          <div className={styles.previewWrap}>
            <div className="bnz-card p-3 p-lg-4 mb-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h2 className="h6 mb-0">Live preview</h2>
                {rendering && <Spinner animation="border" size="sm" />}
              </div>
              <p className="text-secondary small mb-2">
                Rendered from the current template — updates as you type.
              </p>
              {previewError && (
                <Alert variant="warning" className="py-2 small">
                  {previewError}
                </Alert>
              )}
              <div className={styles.previewFrame} style={aspect ? { aspectRatio: aspect } : undefined}>
                {preview ? (
                   
                  <img src={preview} alt="Live preview" className={styles.previewImg} />
                ) : (
                  <span className="text-secondary small p-3">Preparing preview…</span>
                )}
                {rendering && preview && (
                  <div className={styles.previewLoading}>
                    <Spinner animation="border" size="sm" />
                  </div>
                )}
              </div>
            </div>

            <div className="bnz-card p-3 p-lg-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h2 className="h6 mb-0">Generated</h2>
                {current && <StatusBadge status={current.status} />}
              </div>

              {genError && <Alert variant="danger">{genError}</Alert>}

              {!current && !downloads.length && (
                <p className="text-secondary small mb-0">
                  Click <strong>Generate</strong> to render a downloadable image on the server.
                </p>
              )}

              {currentPending && (
                <div className="d-flex align-items-center gap-2 text-secondary">
                  <Spinner size="sm" animation="border" />
                  <span>Rendering your image…</span>
                </div>
              )}

              {current?.status === "failed" && (
                <Alert variant="danger" className="mb-0">
                  {current.error || "Generation failed."}
                </Alert>
              )}

              {current?.status === "completed" && current.image_url && (
                <div className="mb-3">
                  { }
                  <img src={namedUrl(current) ?? current.image_url} alt="Generated result" className={styles.result} />
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <Link className="btn btn-primary btn-lg" href={namedUrl(current, true)!} download={downloadName(current)}>
                      Download
                    </Link>
                  </div>
                  <Card body className="mt-3 bnz-mono small text-break">
                    {current.image_url}
                  </Card>
                </div>
              )}

              {downloads.length > 0 && (
                <>
                  <h3 className="small text-uppercase text-secondary fw-semibold mt-3 mb-2">
                    Generated images
                  </h3>
                  <div className={styles.downloads}>
                    {downloads.map((d) => (
                      <div key={d.id} className={`bnz-card ${styles.downloadRow}`}>
                        {d.image_url && (
                           
                          <img src={namedUrl(d) ?? d.image_url} alt="" className={styles.downloadThumb} />
                        )}
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div className="small fw-semibold text-uppercase">{d.format}</div>
                          <div className="bnz-mono small text-break text-secondary">
                            {d.image_url}
                          </div>
                        </div>
                        <Link className="btn btn-sm btn-outline-dark" href={namedUrl(d, true)!} download={downloadName(d)}>
                          Download
                        </Link>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </Col>
      </Row>

      <MediaPickerModal
        show={pickerKey !== null}
        onHide={() => setPickerKey(null)}
        selectedId={pickerKey ? fields[pickerKey]?.fileId || null : null}
        onSelect={(file) => {
          if (pickerKey) pickFromLibrary(pickerKey, file);
        }}
      />
    </div>
  );
}
