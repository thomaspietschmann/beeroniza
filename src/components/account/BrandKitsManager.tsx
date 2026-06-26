"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { useBrandKits } from "@/components/editor/useBrandKits";
import { useBrandKit } from "@/components/editor/useBrandKit";

// ── Per-kit card ──────────────────────────────────────────────────────────────

function KitCard({
  kitId,
  kitName,
  isDefault,
  onSetDefault,
  onRename,
  onDelete,
}: {
  kitId: string;
  kitName: string;
  isDefault: boolean;
  onSetDefault: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const { colors, addColor, removeColor } = useBrandKit(kitId);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(kitName);
  const [pickingColor, setPickingColor] = useState(false);
  const [newColor, setNewColor] = useState("#000000");

  function commitName() {
    const n = nameVal.trim();
    if (n && n !== kitName) onRename(n);
    setEditingName(false);
  }

  function handleAddColor(e: React.FormEvent) {
    e.preventDefault();
    addColor(newColor);
    setPickingColor(false);
  }

  return (
    <div className="bnz-card p-3">
      {/* Kit header: name + Default badge + actions */}
      <div className="d-flex align-items-center gap-2 mb-3">
        {editingName ? (
          <Form className="flex-grow-1" onSubmit={(e) => { e.preventDefault(); commitName(); }}>
            <Form.Control
              size="sm"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              autoFocus
              onBlur={commitName}
              style={{ maxWidth: "16rem" }}
            />
          </Form>
        ) : (
          <button
            type="button"
            className="btn btn-link p-0 fw-semibold text-body text-decoration-none"
            title="Rename kit"
            onClick={() => { setEditingName(true); setNameVal(kitName); }}
          >
            {kitName}
          </button>
        )}

        {isDefault && (
          <span className="badge text-bg-primary fw-normal" style={{ fontSize: "0.7rem" }}>
            Default
          </span>
        )}

        <div className="d-flex gap-2 ms-auto">
          {!isDefault && (
            <Button variant="outline-secondary" size="sm" onClick={onSetDefault}>
              Set as default
            </Button>
          )}
          <Button variant="outline-danger" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      {/* Colour swatches */}
      <div className="d-flex flex-wrap gap-2 align-items-center">
        {colors.map((c) => (
          <div key={c} className="position-relative" style={{ width: "2rem", height: "2rem" }}>
            <div
              title={c}
              style={{
                width: "2rem", height: "2rem",
                borderRadius: "0.35rem",
                border: "1px solid var(--bs-border-color)",
                background: c,
              }}
            />
            <button
              type="button"
              aria-label={`Remove ${c}`}
              onClick={() => removeColor(c)}
              style={{
                position: "absolute", top: "-0.3rem", right: "-0.3rem",
                width: "0.9rem", height: "0.9rem", borderRadius: "50%",
                background: "var(--bs-body-bg)", border: "1px solid var(--bs-border-color)",
                fontSize: "0.55rem", lineHeight: 1, padding: 0, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>
        ))}

        {/* Add colour button / inline picker */}
        {pickingColor ? (
          <Form className="d-flex gap-1 align-items-center" onSubmit={handleAddColor}>
            <input
              type="color"
              aria-label="New colour"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              style={{
                width: "2rem", height: "2rem", padding: 0,
                border: "1px solid var(--bs-border-color)",
                borderRadius: "0.35rem", cursor: "pointer",
              }}
            />
            <Button type="submit" size="sm" variant="primary">Add</Button>
            <Button size="sm" variant="link" className="p-0 text-secondary" onClick={() => setPickingColor(false)}>
              Cancel
            </Button>
          </Form>
        ) : (
          <button
            type="button"
            title="Add colour"
            onClick={() => setPickingColor(true)}
            style={{
              width: "2rem", height: "2rem",
              borderRadius: "0.35rem",
              border: "1px dashed var(--bs-border-color)",
              background: "transparent",
              fontSize: "1.1rem", cursor: "pointer",
              color: "var(--bs-secondary-color)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >+</button>
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function BrandKitsManager() {
  const { kits, createKit, deleteKit, setDefault, renameKit } = useBrandKits();
  const [newKitName, setNewKitName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleCreateKit(e: React.FormEvent) {
    e.preventDefault();
    const name = newKitName.trim();
    if (!name) return;
    await createKit(name);
    setNewKitName("");
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    try {
      await deleteKit(id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div>
      {deleteError && (
        <div className="alert alert-danger py-2 small mb-3">{deleteError}</div>
      )}

      <div className="d-flex flex-column gap-3">
        {kits.map((k) => (
          <KitCard
            key={k.id}
            kitId={k.id}
            kitName={k.name}
            isDefault={k.isDefault}
            onSetDefault={() => setDefault(k.id)}
            onRename={(name) => renameKit(k.id, name)}
            onDelete={() => handleDelete(k.id)}
          />
        ))}
      </div>

      <Form className="d-flex gap-2 mt-4" onSubmit={handleCreateKit}>
        <Form.Control
          placeholder="New brand kit name…"
          aria-label="New brand kit name"
          value={newKitName}
          onChange={(e) => setNewKitName(e.target.value)}
          style={{ maxWidth: "18rem" }}
        />
        <Button type="submit" variant="outline-primary" disabled={!newKitName.trim()}>
          Create kit
        </Button>
      </Form>
    </div>
  );
}
