"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";

// Prompts for a name, creates a usage (a named set of input values for this
// template) and navigates straight into the fill view.
export function NewUsageModal({
  templateId,
  show,
  onHide,
}: {
  templateId: string;
  show: boolean;
  onHide: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter a name for this usage.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/templates/${templateId}/usages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create usage.");
      }
      const data = await res.json();
      const id = data?.usage?.id as string | undefined;
      if (!id) throw new Error("Unexpected response from server.");
      router.push(`/templates/${templateId}/usages/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title className="h5">New usage</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="text-secondary small">
            A usage is a saved, named set of input values for this template. You can fill it
            in, save it, and re-generate anytime — it always uses the latest template layout.
          </p>
          <Form.Group controlId="usage-name">
            <Form.Label>Name</Form.Label>
            <Form.Control
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Launch announcement — March"
              maxLength={200}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create & fill in"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
