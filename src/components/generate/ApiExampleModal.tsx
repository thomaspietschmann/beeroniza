"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import { templateDocSchema, placeholdersOf, type PlaceholderDef } from "@/lib/template/schema";
import { placeholderToMod } from "@/lib/api-snippets";
import { ApiSnippet } from "./ApiSnippet";

export function ApiExampleModal({
  templateId,
  templateName,
  show,
  onHide,
}: {
  templateId: string;
  templateName: string;
  show: boolean;
  onHide: () => void;
}) {
  const [placeholders, setPlaceholders] = useState<PlaceholderDef[] | null>(null);
  const [loading, setLoading] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-instance";

  useEffect(() => {
    if (!show || placeholders !== null) return;
    setLoading(true);
    fetch(`/api/templates/${templateId}`)
      .then((r) => r.json())
      .then((data) => {
        const parsed = templateDocSchema.safeParse(data?.template?.data);
        setPlaceholders(parsed.success ? placeholdersOf(parsed.data) : []);
      })
      .catch(() => setPlaceholders([]))
      .finally(() => setLoading(false));
  }, [show, templateId, placeholders]);

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="h6">API example — {templateName}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" />
          </div>
        )}
        {!loading && placeholders !== null && (
          <>
            <p className="text-secondary small mb-2">
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
                This template has no dynamic fields yet — open the editor and mark layers as &quot;Dynamic field&quot;.
              </p>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" size="sm" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
