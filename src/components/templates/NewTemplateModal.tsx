"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import { SIZE_PRESETS, presetById, presetsByPlatform, PLATFORM_ORDER } from "@/lib/presets";

const CUSTOM = "__custom__";

export function NewTemplateModal({ show, onHide }: { show: boolean; onHide: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState(SIZE_PRESETS[0]?.id ?? CUSTOM);
  const [width, setWidth] = useState(SIZE_PRESETS[0]?.width ?? 1200);
  const [height, setHeight] = useState(SIZE_PRESETS[0]?.height ?? 630);
  const [customPlatform, setCustomPlatform] = useState("");
  const [bg, setBg] = useState("#ffffff");
  const [useBg, setUseBg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = presetId === CUSTOM;
  const platformGroups = presetsByPlatform();

  function selectPreset(id: string) {
    setPresetId(id);
    const p = presetById(id);
    if (p) {
      setWidth(p.width);
      setHeight(p.height);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter a template name.");
      return;
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
      setError("Width and height must be positive numbers.");
      return;
    }

    const preset = presetById(presetId);
    const platform = isCustom ? customPlatform || undefined : preset?.platform;
    const formatLabel = isCustom
      ? `Custom ${Math.round(width)}×${Math.round(height)}`
      : preset?.label;

    setSubmitting(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          width: Math.round(width),
          height: Math.round(height),
          ...(platform ? { platform } : {}),
          ...(formatLabel ? { formatLabel } : {}),
          ...(useBg ? { backgroundColor: bg } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create template.");
      }
      const data = await res.json();
      const id = data?.template?.id as string | undefined;
      if (!id) throw new Error("Unexpected response from server.");
      router.push(`/editor/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title className="h5">New template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3" controlId="tpl-name">
            <Form.Label>Name</Form.Label>
            <Form.Control
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blog post OpenGraph"
              maxLength={200}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="tpl-size">
            <Form.Label>Platform &amp; format</Form.Label>
            <Form.Select value={presetId} onChange={(e) => selectPreset(e.target.value)}>
              {platformGroups.map((g) => (
                <optgroup key={g.platform} label={g.platform}>
                  {g.presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value={CUSTOM}>Custom size…</option>
            </Form.Select>
          </Form.Group>

          {isCustom && (
            <Form.Group className="mb-3" controlId="tpl-platform">
              <Form.Label>File under platform</Form.Label>
              <Form.Select value={customPlatform} onChange={(e) => setCustomPlatform(e.target.value)}>
                <option value="">Individuell (no platform)</option>
                {PLATFORM_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          )}

          {isCustom && (
            <Row className="g-2 mb-3">
              <Col xs={6}>
                <Form.Group controlId="tpl-width">
                  <Form.Label>Width (px)</Form.Label>
                  <Form.Control
                    type="number"
                    min={1}
                    max={8000}
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                  />
                </Form.Group>
              </Col>
              <Col xs={6}>
                <Form.Group controlId="tpl-height">
                  <Form.Label>Height (px)</Form.Label>
                  <Form.Control
                    type="number"
                    min={1}
                    max={8000}
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                  />
                </Form.Group>
              </Col>
            </Row>
          )}

          <Form.Group controlId="tpl-bg">
            <Form.Check
              type="checkbox"
              id="tpl-use-bg"
              label="Set a background color"
              checked={useBg}
              onChange={(e) => setUseBg(e.target.checked)}
              className="mb-2"
            />
            {useBg && (
              <div className="d-flex align-items-center gap-2">
                <Form.Control
                  type="color"
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                  title="Background color"
                  style={{ width: "3rem" }}
                />
                <Form.Control
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                  className="bnz-mono"
                  style={{ maxWidth: "8rem" }}
                />
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create & open editor"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
