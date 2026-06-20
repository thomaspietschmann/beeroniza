"use client";

import { useState } from "react";
import Link from "next/link";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Spinner from "react-bootstrap/Spinner";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { PlaceholderDef } from "@/lib/template/schema";
import { uploadWithDetection } from "@/lib/face/detect-client";
import { useGeneration } from "@/lib/useGeneration";
import { slugifyFilename, namedDownloadUrl } from "@/lib/download";
import styles from "./generate-form.module.scss";

type OutputFormat = "png" | "jpg";

interface Modification {
  name: string;
  text?: string;
  color?: string;
  image_url?: string;
}

interface FieldState {
  // text + color use `value`; image uses `imageUrl` (either uploaded or typed).
  value: string;
  imageUrl: string;
  uploading: boolean;
}

function initialFields(placeholders: PlaceholderDef[]): Record<string, FieldState> {
  const out: Record<string, FieldState> = {};
  for (const p of placeholders) {
    const def = p.defaultValue ?? "";
    out[p.key] = {
      value: p.type === "color" ? def || "#000000" : def,
      imageUrl: p.type === "image" ? def : "",
      uploading: false,
    };
  }
  return out;
}

export function GenerateForm({
  templateId,
  templateName,
  placeholders,
}: {
  templateId: string;
  templateName: string;
  placeholders: PlaceholderDef[];
}) {
  const [fields, setFields] = useState<Record<string, FieldState>>(() => initialFields(placeholders));
  const [format, setFormat] = useState<OutputFormat>("png");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const gen = useGeneration();
  const result = gen.current;
  const error = gen.error ?? uploadError;

  function updateField(key: string, patch: Partial<FieldState>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function handleUpload(key: string, file: File) {
    updateField(key, { uploading: true });
    setUploadError(null);
    try {
      // Shared upload helper (runs face detection for focal-point parity with
      // the usage filler).
      const data = await uploadWithDetection(file);
      updateField(key, { imageUrl: data.url, uploading: false });
    } catch (err) {
      updateField(key, { uploading: false });
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  function buildModifications(): Modification[] {
    return placeholders
      .map((p): Modification | null => {
        const f = fields[p.key];
        if (!f) return null;
        if (p.type === "text") {
          return { name: p.key, text: f.value };
        }
        if (p.type === "color") {
          return f.value ? { name: p.key, color: f.value } : null;
        }
        // image
        return f.imageUrl.trim() ? { name: p.key, image_url: f.imageUrl.trim() } : null;
      })
      .filter((m): m is Modification => m !== null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);
    setCopied(false);
    gen.begin();
    await gen.start(
      `/api/templates/${templateId}/generate`,
      { modifications: buildModifications(), format },
      format,
    );
  }

  const downloadBase = slugifyFilename(templateName, "image");

  // File route with ?dl=1&name=… → the server's Content-Disposition: attachment
  // drives the saved name + extension across all browsers.
  function downloadUrl(): string | null {
    return result?.image_url ? namedDownloadUrl(result.image_url, downloadBase, { dl: true }) : null;
  }

  async function copyUrl() {
    if (!result?.image_url) return;
    try {
      await navigator.clipboard.writeText(result.image_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  const isPending = result != null && result.status !== "completed" && result.status !== "failed";

  return (
    <Row className="g-4">
      <Col xs={12} lg={6}>
        <div className="bnz-card p-3 p-lg-4">
          <Form onSubmit={handleSubmit}>
            {error && <Alert variant="danger">{error}</Alert>}

            {placeholders.length === 0 && (
              <Alert variant="secondary" className="mb-3">
                This template has no editable layers. You can still generate it as-is.
              </Alert>
            )}

            {placeholders.map((p) => {
              const f = fields[p.key];
              const label = p.label || p.key;
              if (p.type === "text") {
                const long = (f?.value?.length ?? 0) > 60;
                return (
                  <Form.Group className="mb-3" controlId={`f-${p.key}`} key={p.key}>
                    <Form.Label className="fw-semibold">{label}</Form.Label>
                    {long ? (
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={f?.value ?? ""}
                        onChange={(e) => updateField(p.key, { value: e.target.value })}
                        placeholder={`Enter ${label}…`}
                      />
                    ) : (
                      <Form.Control
                        value={f?.value ?? ""}
                        onChange={(e) => updateField(p.key, { value: e.target.value })}
                        placeholder={`Enter ${label}…`}
                      />
                    )}
                  </Form.Group>
                );
              }
              if (p.type === "color") {
                return (
                  <Form.Group className="mb-3" controlId={`f-${p.key}`} key={p.key}>
                    <Form.Label className="fw-semibold">{label}</Form.Label>
                    <div className="d-flex align-items-center gap-2">
                      <Form.Control
                        type="color"
                        value={f?.value || "#000000"}
                        onChange={(e) => updateField(p.key, { value: e.target.value })}
                        title={label}
                        style={{ width: "3rem" }}
                      />
                      <Form.Control
                        value={f?.value ?? ""}
                        onChange={(e) => updateField(p.key, { value: e.target.value })}
                        className="bnz-mono"
                        style={{ maxWidth: "9rem" }}
                      />
                    </div>
                  </Form.Group>
                );
              }
              // image
              return (
                <Form.Group className="mb-3" controlId={`f-${p.key}`} key={p.key}>
                  <Form.Label className="fw-semibold">{label}</Form.Label>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <Form.Control
                      type="file"
                      accept="image/*"
                      size="sm"
                      disabled={f?.uploading}
                      onChange={(e) => {
                        const input = e.target as HTMLInputElement;
                        const file = input.files?.[0];
                        if (file) handleUpload(p.key, file);
                        // Reset so re-selecting the same file after a clear fires onChange again.
                        input.value = "";
                      }}
                    />
                    {f?.uploading && <Spinner size="sm" animation="border" />}
                  </div>
                  <Form.Control
                    type="url"
                    value={f?.imageUrl ?? ""}
                    onChange={(e) => updateField(p.key, { imageUrl: e.target.value })}
                    placeholder="…or paste an image URL"
                    className="bnz-mono"
                  />
                  {f?.imageUrl && (
                     
                    <img src={f.imageUrl} alt="" className={styles.fieldThumb} />
                  )}
                </Form.Group>
              );
            })}

            <Form.Group className="mb-4" controlId="f-format">
              <Form.Label className="fw-semibold">Output format</Form.Label>
              <Form.Select
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
                style={{ maxWidth: "10rem" }}
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="webp">WebP</option>
              </Form.Select>
            </Form.Group>

            <Button type="submit" variant="primary" disabled={gen.generating}>
              {gen.generating ? "Generating…" : "Generate image"}
            </Button>
          </Form>
        </div>
      </Col>

      <Col xs={12} lg={6}>
        <div className="bnz-card p-3 p-lg-4 h-100">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h2 className="h6 mb-0">Result</h2>
            {result && <StatusBadge status={result.status} />}
          </div>

          {!result && <p className="text-secondary mb-0">Fill in the fields and generate to see your image here.</p>}

          {isPending && (
            <div className="d-flex align-items-center gap-2 text-secondary">
              <Spinner size="sm" animation="border" />
              <span>Rendering your image…</span>
            </div>
          )}

          {result?.status === "failed" && (
            <Alert variant="danger" className="mb-0">
              {result.error || "Generation failed."}
            </Alert>
          )}

          {result?.status === "completed" && result.image_url && (
            <div>
              { }
              <img src={result.image_url} alt="Generated result" className={styles.result} />
              <div className="d-flex flex-wrap gap-2 mt-3">
                <Link className="btn btn-primary" href={downloadUrl()!} download={`${downloadBase}.${result.format}`}>
                  Download
                </Link>
                <Button variant="outline-dark" onClick={copyUrl}>
                  {copied ? "Copied!" : "Copy URL"}
                </Button>
              </div>
              <Card body className="mt-3 bnz-mono small text-break">
                {result.image_url}
              </Card>
            </div>
          )}
        </div>
      </Col>
    </Row>
  );
}
