"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { useBrandKits } from "@/components/editor/useBrandKits";
import { useBrandKit, type Palette } from "@/components/editor/useBrandKit";

// ── Palette editor (inline, always visible) ───────────────────────────────────

function PaletteRow({
  palette,
  onRename,
  onRemove,
  onRemoveColor,
  onAddColor,
}: {
  palette: Palette;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onRemoveColor: (paletteId: string, color: string) => void;
  onAddColor: (paletteId: string, color: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(palette.name);
  const [addingColor, setAddingColor] = useState(false);
  const [newColor, setNewColor] = useState("#000000");

  function commitRename() {
    const n = editName.trim();
    if (n && n !== palette.name) onRename(palette.id, n);
    setEditing(false);
  }

  return (
    <div className="mb-3">
      <div className="d-flex align-items-center gap-2 mb-1">
        {editing ? (
          <Form
            className="d-flex gap-1 flex-grow-1"
            onSubmit={(e) => { e.preventDefault(); commitRename(); }}
          >
            <Form.Control
              size="sm"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              onBlur={commitRename}
              style={{ maxWidth: "14rem" }}
            />
          </Form>
        ) : (
          <button
            type="button"
            className="btn btn-link p-0 text-secondary text-decoration-none"
            style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}
            title="Rename palette"
            onClick={() => { setEditing(true); setEditName(palette.name); }}
          >
            {palette.name}
          </button>
        )}
        <Button
          variant="link"
          size="sm"
          className="p-0 text-danger ms-auto"
          style={{ fontSize: "0.75rem" }}
          onClick={() => onRemove(palette.id)}
        >
          Remove palette
        </Button>
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center">
        {palette.colors.map((c) => (
          <div key={c} className="position-relative" style={{ width: "2rem", height: "2rem" }}>
            <div
              title={c}
              style={{ width: "2rem", height: "2rem", borderRadius: "0.35rem", border: "1px solid var(--bs-border-color)", background: c }}
            />
            <button
              type="button"
              aria-label={`Remove ${c}`}
              onClick={() => onRemoveColor(palette.id, c)}
              style={{
                position: "absolute", top: "-0.35rem", right: "-0.35rem",
                width: "0.95rem", height: "0.95rem", borderRadius: "50%",
                background: "var(--bs-body-bg)", border: "1px solid var(--bs-border-color)",
                fontSize: "0.55rem", lineHeight: 1, padding: 0, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>
        ))}

        {addingColor ? (
          <Form
            className="d-flex gap-1 align-items-center"
            onSubmit={(e) => { e.preventDefault(); onAddColor(palette.id, newColor); setAddingColor(false); }}
          >
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              style={{ width: "2rem", height: "2rem", padding: 0, border: "1px solid var(--bs-border-color)", borderRadius: "0.35rem", cursor: "pointer" }}
            />
            <Button type="submit" size="sm" variant="primary">Add</Button>
            <Button size="sm" variant="link" className="p-0 text-secondary" onClick={() => setAddingColor(false)}>Cancel</Button>
          </Form>
        ) : (
          <button
            type="button"
            title="Add color"
            onClick={() => setAddingColor(true)}
            style={{
              width: "2rem", height: "2rem", borderRadius: "0.35rem",
              border: "1px dashed var(--bs-border-color)", background: "transparent",
              fontSize: "1.1rem", cursor: "pointer", color: "var(--bs-secondary)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >+</button>
        )}
      </div>
    </div>
  );
}

// ── Per-kit editor ────────────────────────────────────────────────────────────

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
  const { palettes, addPalette, removePalette, renamePalette, addColorToPalette, removeColorFromPalette } =
    useBrandKit(kitId);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(kitName);
  const [newPalette, setNewPalette] = useState("");

  function commitName() {
    const n = nameVal.trim();
    if (n && n !== kitName) onRename(n);
    setEditingName(false);
  }

  function handleAddPalette(e: React.FormEvent) {
    e.preventDefault();
    const n = newPalette.trim();
    if (!n) return;
    addPalette(n);
    setNewPalette("");
  }

  return (
    <div className="border rounded p-3">
      {/* Kit header */}
      <div className="d-flex align-items-center gap-2 mb-3">
        {editingName ? (
          <Form
            className="flex-grow-1"
            onSubmit={(e) => { e.preventDefault(); commitName(); }}
          >
            <Form.Control
              size="sm"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              autoFocus
              onBlur={commitName}
              style={{ maxWidth: "18rem" }}
            />
          </Form>
        ) : (
          <button
            type="button"
            className="btn btn-link p-0 text-start fw-semibold text-body text-decoration-none flex-grow-1"
            title="Rename kit"
            onClick={() => { setEditingName(true); setNameVal(kitName); }}
          >
            {kitName}
            {isDefault && (
              <span className="badge bg-primary ms-2" style={{ fontSize: "0.65rem", verticalAlign: "middle" }}>
                Default
              </span>
            )}
          </button>
        )}
        <div className="d-flex gap-2 flex-shrink-0">
          {!isDefault && (
            <Button variant="link" size="sm" className="p-0 text-secondary" onClick={onSetDefault}>
              Set as default
            </Button>
          )}
          <Button variant="link" size="sm" className="p-0 text-danger" onClick={onDelete}>
            Delete kit
          </Button>
        </div>
      </div>

      {/* Palettes */}
      {palettes.length === 0 ? (
        <p className="text-secondary small mb-2">No palettes yet — add one below.</p>
      ) : (
        palettes.map((p) => (
          <PaletteRow
            key={p.id}
            palette={p}
            onRename={renamePalette}
            onRemove={removePalette}
            onRemoveColor={removeColorFromPalette}
            onAddColor={addColorToPalette}
          />
        ))
      )}

      {/* Add palette */}
      <Form className="d-flex gap-2 mt-2" onSubmit={handleAddPalette}>
        <Form.Control
          placeholder="New palette name…"
          value={newPalette}
          onChange={(e) => setNewPalette(e.target.value)}
          size="sm"
          style={{ maxWidth: "14rem" }}
        />
        <Button type="submit" variant="outline-secondary" size="sm" disabled={!newPalette.trim()}>
          Add palette
        </Button>
      </Form>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

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
          placeholder="New brand kit…"
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
