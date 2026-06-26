"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Table from "react-bootstrap/Table";
import Badge from "react-bootstrap/Badge";
import { formatDate, formatRelativeTime } from "@/components/dashboard/format";
import { apiMutate } from "@/lib/api-client";

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  rotatedAt: string | null;
  createdAt: string;
}

type KeyStatus = "active" | "expired" | "revoked";

function statusOf(k: ApiKeyItem): KeyStatus {
  if (k.revokedAt) return "revoked";
  if (k.expiresAt && new Date(k.expiresAt).getTime() < Date.now()) return "expired";
  return "active";
}

function StatusPill({ status }: { status: KeyStatus }) {
  const bg = status === "active" ? "success" : status === "expired" ? "warning" : "secondary";
  return (
    <Badge bg={bg} text={status === "expired" ? "dark" : undefined} className="text-uppercase" style={{ letterSpacing: "0.03em" }}>
      {status}
    </Badge>
  );
}

function maskPrefix(prefix: string): string {
  return `${prefix}…`;
}

function curlSnippet(plaintext: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return [
    `curl -X POST ${origin}/api/v1/images \\`,
    `  -H "Authorization: Bearer ${plaintext}" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '{"template_id":"<id>","modifications":[{"name":"title","text":"Hello"}],"format":"png"}'`,
  ].join("\n");
}

function PlaintextCallout({ plaintext, onCopy }: { plaintext: string; onCopy: () => void }) {
  return (
    <Alert variant="warning" className="mb-0">
      <div className="fw-semibold mb-1">Copy your new key now</div>
      <p className="small mb-2">This is the only time the full key will be shown. Store it somewhere safe.</p>
      <div className="d-flex align-items-center gap-2 mb-3">
        <code className="bnz-mono text-break flex-grow-1 p-2 bg-white rounded border">{plaintext}</code>
        <Button size="sm" variant="dark" onClick={onCopy}>
          Copy
        </Button>
      </div>
      <details>
        <summary className="small fw-semibold mb-2" style={{ cursor: "pointer" }}>
          Example request
        </summary>
        <pre className="bnz-mono small bg-white rounded border p-2 mb-0" style={{ whiteSpace: "pre-wrap" }}>
          {curlSnippet(plaintext)}
        </pre>
      </details>
    </Alert>
  );
}

export function ApiKeysManager({ keys }: { keys: ApiKeyItem[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Rotate modal
  const [rotateTarget, setRotateTarget] = useState<ApiKeyItem | null>(null);
  const [rotateExpiry, setRotateExpiry] = useState("");

  // Shown-once plaintext result (covers both create and rotate)
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function expiryToIso(value: string): string | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  async function copyPlaintext() {
    if (!plaintext) return;
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) {
      setError("Please enter a name for the key.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiMutate<{ plaintext: string }>(
        "/api/api-keys",
        "POST",
        { name: newName.trim(), expiresAt: expiryToIso(newExpiry) },
        "Failed to create key.",
      );
      setShowCreate(false);
      setNewName("");
      setNewExpiry("");
      setPlaintext(data.plaintext);
      setCopied(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRotate(e: React.FormEvent) {
    e.preventDefault();
    if (!rotateTarget) return;
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiMutate<{ plaintext: string }>(
        `/api/api-keys/${rotateTarget.id}/rotate`,
        "POST",
        { expiresAt: expiryToIso(rotateExpiry) },
        "Failed to rotate key.",
      );
      setRotateTarget(null);
      setRotateExpiry("");
      setPlaintext(data.plaintext);
      setCopied(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(k: ApiKeyItem) {
    if (busyId) return;
    const ok = window.confirm(`Revoke “${k.name}”? Applications using this key will stop working immediately.`);
    if (!ok) return;
    setError(null);
    setBusyId(k.id);
    try {
      await apiMutate(`/api/api-keys/${k.id}`, "DELETE", undefined, "Failed to revoke key.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">API keys</h1>
          <p className="text-secondary mb-0">Authenticate requests to the image generation API.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          Create API key
        </Button>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      {plaintext && (
        <div className="mb-4">
          <PlaintextCallout plaintext={plaintext} onCopy={copyPlaintext} />
          <div className="mt-2 d-flex align-items-center gap-2">
            {copied && (
              <span role="status" aria-live="polite" className="small text-success fw-semibold">
                Copied to clipboard.
              </span>
            )}
            <Button size="sm" variant="link" className="ms-auto" onClick={() => setPlaintext(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className="bnz-card">
        {keys.length === 0 ? (
          <div className="text-center text-secondary py-5 px-3">
            <p className="h6 mb-1">No API keys yet</p>
            <p className="small mb-0">Create a key to start generating images programmatically.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const status = statusOf(k);
                  return (
                    <tr key={k.id}>
                      <td className="fw-semibold">{k.name}</td>
                      <td className="bnz-mono small text-secondary">{maskPrefix(k.prefix)}</td>
                      <td className="small text-secondary">{formatDate(k.createdAt)}</td>
                      <td className="small text-secondary">{k.lastUsedAt ? formatRelativeTime(k.lastUsedAt) : "Never"}</td>
                      <td className="small text-secondary">{k.expiresAt ? formatDate(k.expiresAt) : "Never"}</td>
                      <td>
                        <StatusPill status={status} />
                      </td>
                      <td className="text-end">
                        {status === "active" ? (
                          <div className="d-inline-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-dark"
                              disabled={busyId === k.id}
                              onClick={() => {
                                setRotateTarget(k);
                                setRotateExpiry("");
                                setError(null);
                              }}
                            >
                              Rotate
                            </Button>
                            <Button size="sm" variant="outline-danger" disabled={busyId === k.id} onClick={() => handleRevoke(k)}>
                              Revoke
                            </Button>
                          </div>
                        ) : (
                          <span className="small text-secondary">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
        {keys.some((k) => statusOf(k) !== "active") && (
          <div className="px-3 py-2 border-top">
            <p className="small text-secondary mb-0">
              Revoked and expired keys are automatically deleted after 30 days.
            </p>
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered>
        <Form onSubmit={handleCreate}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">Create API key</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="key-name">
              <Form.Label>Name</Form.Label>
              <Form.Control
                autoFocus
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Production server"
                maxLength={200}
              />
            </Form.Group>
            <Form.Group controlId="key-expiry">
              <Form.Label>Expiry date (optional)</Form.Label>
              <Form.Control type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
              <Form.Text className="text-secondary">Leave empty for a key that never expires.</Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowCreate(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create key"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Rotate modal */}
      <Modal show={rotateTarget != null} onHide={() => setRotateTarget(null)} centered>
        <Form onSubmit={handleRotate}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">Rotate “{rotateTarget?.name}”</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="small text-secondary">
              Rotating issues a new secret for this key. The old secret stops working immediately.
            </p>
            <Form.Group controlId="rotate-expiry">
              <Form.Label>New expiry date (optional)</Form.Label>
              <Form.Control type="date" value={rotateExpiry} onChange={(e) => setRotateExpiry(e.target.value)} />
              <Form.Text className="text-secondary">Leave empty for a key that never expires.</Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setRotateTarget(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Rotating…" : "Rotate key"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
