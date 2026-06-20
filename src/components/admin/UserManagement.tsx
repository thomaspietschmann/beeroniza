"use client";

import { useEffect, useRef, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import Table from "react-bootstrap/Table";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
  createdAt: string;
  hasPassword: boolean;
}

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function SetPasswordModal({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/users/${user.id}`, "PATCH", { password: pw });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h6">Set password — {user.email}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={submit}>
        <Modal.Body>
          {done ? (
            <Alert variant="success" className="mb-0">Password updated.</Alert>
          ) : (
            <>
              {error && <Alert variant="danger">{error}</Alert>}
              <Form.Group>
                <Form.Label>New password</Form.Label>
                <Form.Control
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  minLength={8}
                  required
                  autoFocus
                />
                <Form.Text className="text-secondary">At least 8 characters.</Form.Text>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {!done && (
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? <Spinner size="sm" animation="border" /> : "Set password"}
            </Button>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function CreateUserModal({ onCreated, onClose }: { onCreated: (u: UserRow) => void; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await api<UserRow>("/api/admin/users", "POST", { email, name, password: pw, role });
      onCreated(user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h6">Create user</Modal.Title>
      </Modal.Header>
      <Form onSubmit={submit}>
        <Modal.Body className="d-flex flex-column gap-3">
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group>
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Form.Group>
          <Form.Group>
            <Form.Label>Name <span className="text-secondary">(optional)</span></Form.Label>
            <Form.Control type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required />
            <Form.Text className="text-secondary">At least 8 characters.</Form.Text>
          </Form.Group>
          <Form.Group>
            <Form.Label>Role</Form.Label>
            <Form.Select value={role} onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}>
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? <Spinner size="sm" animation="border" /> : "Create"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export function UserManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const deleteConfirm = useRef<string | null>(null);

  useEffect(() => {
    api<UserRow[]>("/api/admin/users")
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggleRole(user: UserRow) {
    const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    setBusyId(user.id);
    try {
      await api(`/api/admin/users/${user.id}`, "PATCH", { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(user: UserRow) {
    if (deleteConfirm.current !== user.id) {
      deleteConfirm.current = user.id;
      setTimeout(() => { deleteConfirm.current = null; }, 3000);
      setError(`Click delete again to confirm removing ${user.email}.`);
      return;
    }
    deleteConfirm.current = null;
    setBusyId(user.id);
    try {
      await api(`/api/admin/users/${user.id}`, "DELETE");
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bnz-card p-3 p-lg-4">
      <div className="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-3">
        <div>
          <h2 className="h5 mb-1">Users</h2>
          <p className="text-secondary mb-0">Manage accounts, roles, and passwords.</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          Create user
        </Button>
      </div>

      {error && <Alert variant="warning" dismissible onClose={() => setError("")}>{error}</Alert>}

      {loading ? (
        <div className="text-secondary"><Spinner size="sm" animation="border" className="me-2" />Loading…</div>
      ) : (
        <Table hover responsive className="mb-0 small">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Auth</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="align-middle">{u.email}</td>
                <td className="align-middle text-secondary">{u.name ?? "—"}</td>
                <td className="align-middle">
                  <Badge bg={u.role === "ADMIN" ? "danger" : "secondary"} className="fw-normal">
                    {u.role}
                  </Badge>
                </td>
                <td className="align-middle text-secondary">
                  {u.hasPassword ? "Password" : "SSO"}
                </td>
                <td className="align-middle text-end" style={{ whiteSpace: "nowrap" }}>
                  {busyId === u.id ? (
                    <Spinner size="sm" animation="border" />
                  ) : (
                    <div className="d-inline-flex gap-2">
                      {u.hasPassword && (
                        <Button variant="outline-secondary" size="sm" onClick={() => setPwTarget(u)}>
                          Set password
                        </Button>
                      )}
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => toggleRole(u)}
                        disabled={u.id === currentUserId && u.role === "ADMIN"}
                        title={u.id === currentUserId ? "Cannot change your own role" : undefined}
                      >
                        {u.role === "ADMIN" ? "Make user" : "Make admin"}
                      </Button>
                      {u.id !== currentUserId && (
                        <Button variant="outline-danger" size="sm" onClick={() => deleteUser(u)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {showCreate && (
        <CreateUserModal
          onCreated={(u) => setUsers((prev) => [...prev, { ...u, hasPassword: true, createdAt: new Date().toISOString() }])}
          onClose={() => setShowCreate(false)}
        />
      )}
      {pwTarget && <SetPasswordModal user={pwTarget} onClose={() => setPwTarget(null)} />}
    </div>
  );
}
