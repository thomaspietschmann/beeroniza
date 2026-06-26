"use client";

import { useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";

export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) { setError("New passwords do not match."); return; }
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setSuccess(true);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bnz-card p-3 p-lg-4">
      <h2 className="h5 mb-1">Change password</h2>
      <p className="text-secondary mb-3">Enter your current password to set a new one.</p>
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">Password changed successfully.</Alert>}
      <Form onSubmit={submit} style={{ maxWidth: 400 }}>
        <Form.Group className="mb-3" controlId="cp-current">
          <Form.Label>Current password</Form.Label>
          <Form.Control type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
        </Form.Group>
        <Form.Group className="mb-3" controlId="cp-new">
          <Form.Label>New password</Form.Label>
          <Form.Control type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required autoComplete="new-password" />
          <Form.Text className="text-secondary">At least 8 characters.</Form.Text>
        </Form.Group>
        <Form.Group className="mb-3" controlId="cp-confirm">
          <Form.Label>Confirm new password</Form.Label>
          <Form.Control type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
        </Form.Group>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? <Spinner size="sm" animation="border" /> : "Change password"}
        </Button>
      </Form>
    </div>
  );
}
