"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { apiMutate } from "@/lib/api-client";

interface ResetSummary {
  deletedTemplates: number;
  deletedUsages: number;
  deletedGenerations: number;
  deletedFiles: number;
  deletedFonts: number;
  createdTemplates: number;
}

const PHRASE = "RESET";

// Danger-zone control: wipes the whole application after a typed confirmation.
export function AdminReset() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ResetSummary | null>(null);

  const armed = confirm.trim() === PHRASE;

  async function handleReset() {
    if (!armed || busy) return;
    if (!window.confirm("This permanently deletes ALL media, templates and usages. Continue?")) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const data = await apiMutate<{ summary: ResetSummary }>(
        "/api/admin/reset",
        "POST",
        { confirm: PHRASE },
        "Reset failed.",
      );
      setDone(data.summary);
      setConfirm("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bnz-card p-3 p-lg-4 border border-danger-subtle">
      <h2 className="h5 text-danger mb-1">Reset application</h2>
      <p className="text-secondary mb-3">
        Permanently deletes <strong>all uploaded media, generated images, templates, usages and
        user-uploaded fonts</strong>{" "}
        across every user, then recreates the starter templates. User accounts, API keys and bundled
        fonts are kept. <strong>This cannot be undone.</strong>
      </p>

      {error && <Alert variant="danger">{error}</Alert>}
      {done && (
        <Alert variant="success">
          Done — removed {done.deletedTemplates} templates, {done.deletedUsages} usages,{" "}
          {done.deletedGenerations} generations, {done.deletedFiles} files and{" "}
          {done.deletedFonts} uploaded fonts; recreated {done.createdTemplates} starter templates.
        </Alert>
      )}

      <Form.Group className="mb-3" controlId="reset-confirm" style={{ maxWidth: "22rem" }}>
        <Form.Label className="small">
          Type <code>{PHRASE}</code> to enable the button
        </Form.Label>
        <Form.Control
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={PHRASE}
          autoComplete="off"
          disabled={busy}
        />
      </Form.Group>

      <Button variant="danger" disabled={!armed || busy} onClick={handleReset}>
        {busy ? (
          <>
            <Spinner size="sm" animation="border" className="me-2" />
            Resetting…
          </>
        ) : (
          "Reset application"
        )}
      </Button>
    </div>
  );
}
