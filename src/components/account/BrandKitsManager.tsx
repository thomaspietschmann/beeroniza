"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { useBrandKits } from "@/components/editor/useBrandKits";
import { useBrandKit, type Palette } from "@/components/editor/useBrandKit";

// ── Single kit editor ─────────────────────────────────────────────────────────

function KitEditor({ kitId }: { kitId: string }) {
  const { addPalette, removePalette, renamePalette, addColorToPalette, removeColorFromPalette, palettes } =
    useBrandKit(kitId);

  const [newPaletteName, setNewPaletteName] = useState("");
  const [editingPaletteId, setEditingPaletteId] = useState<string | null>(null);
  const [editingPaletteName, setEditingPaletteName] = useState("");
  const [addingColor, setAddingColor] = useState<{ paletteId: string; value: string } | null>(null);

  function handleCreatePalette(e: React.FormEvent) {
    e.preventDefault();
    const name = newPaletteName.trim();
    if (!name) return;
    addPalette(name);
    setNewPaletteName("");
  }

  function startRenamePalette(p: Palette) {
    setEditingPaletteId(p.id);
    setEditingPaletteName(p.name);
  }

  function commitRenamePalette(id: string) {
    const name = editingPaletteName.trim();
    if (name) renamePalette(id, name);
    setEditingPaletteId(null);
  }

  function handleAddColor(e: React.FormEvent) {
    e.preventDefault();
    if (!addingColor) return;
    addColorToPalette(addingColor.paletteId, addingColor.value);
    setAddingColor(null);
  }

  return (
    <div className="d-flex flex-column gap-3 mt-3">
      {palettes.map((p) => (
        <div key={p.id} className="border rounded p-3">
          <div className="d-flex align-items-center justify-content-between mb-2">
            {editingPaletteId === p.id ? (
              <Form
                className="d-flex gap-2 flex-grow-1 me-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  commitRenamePalette(p.id);
                }}
              >
                <Form.Control
                  size="sm"
                  value={editingPaletteName}
                  onChange={(e) => setEditingPaletteName(e.target.value)}
                  autoFocus
                  onBlur={() => commitRenamePalette(p.id)}
                  style={{ maxWidth: "16rem" }}
                />
              </Form>
            ) : (
              <button
                type="button"
                className="btn btn-link p-0 text-start fw-semibold text-body text-decoration-none"
                title="Umbenennen"
                onClick={() => startRenamePalette(p)}
              >
                {p.name}
              </button>
            )}
            <Button
              variant="link"
              size="sm"
              className="text-danger p-0"
              onClick={() => removePalette(p.id)}
            >
              Löschen
            </Button>
          </div>

          <div className="d-flex flex-wrap gap-2 align-items-center">
            {p.colors.map((c) => (
              <div key={c} className="position-relative" style={{ width: "2rem", height: "2rem" }}>
                <div
                  title={c}
                  style={{
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "0.35rem",
                    border: "1px solid var(--bs-border-color)",
                    background: c,
                  }}
                />
                <button
                  type="button"
                  aria-label={`${c} entfernen`}
                  title={`${c} entfernen`}
                  onClick={() => removeColorFromPalette(p.id, c)}
                  style={{
                    position: "absolute",
                    top: "-0.4rem",
                    right: "-0.4rem",
                    width: "1rem",
                    height: "1rem",
                    borderRadius: "50%",
                    background: "var(--bs-body-bg)",
                    border: "1px solid var(--bs-border-color)",
                    fontSize: "0.6rem",
                    lineHeight: 1,
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            {addingColor?.paletteId === p.id ? (
              <Form className="d-flex gap-1 align-items-center" onSubmit={handleAddColor}>
                <input
                  type="color"
                  value={addingColor.value}
                  onChange={(e) => setAddingColor({ paletteId: p.id, value: e.target.value })}
                  style={{
                    width: "2rem",
                    height: "2rem",
                    padding: 0,
                    border: "1px solid var(--bs-border-color)",
                    borderRadius: "0.35rem",
                    cursor: "pointer",
                  }}
                />
                <Button type="submit" size="sm" variant="primary">
                  Hinzufügen
                </Button>
                <Button size="sm" variant="link" className="p-0 text-secondary" onClick={() => setAddingColor(null)}>
                  Abbrechen
                </Button>
              </Form>
            ) : (
              <button
                type="button"
                title="Farbe hinzufügen"
                onClick={() => setAddingColor({ paletteId: p.id, value: "#000000" })}
                style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "0.35rem",
                  border: "1px dashed var(--bs-border-color)",
                  background: "transparent",
                  fontSize: "1.2rem",
                  lineHeight: 1,
                  cursor: "pointer",
                  color: "var(--bs-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                +
              </button>
            )}
          </div>
        </div>
      ))}

      <Form className="d-flex gap-2" onSubmit={handleCreatePalette}>
        <Form.Control
          placeholder="Neue Palette …"
          value={newPaletteName}
          onChange={(e) => setNewPaletteName(e.target.value)}
          style={{ maxWidth: "16rem" }}
          size="sm"
        />
        <Button type="submit" variant="outline-secondary" size="sm" disabled={!newPaletteName.trim()}>
          Palette anlegen
        </Button>
      </Form>
    </div>
  );
}

// ── Brand kit list + management ────────────────────────────────────────────────

export function BrandKitsManager() {
  const { kits, createKit, deleteKit, setDefault, renameKit } = useBrandKits();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newKitName, setNewKitName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleCreateKit(e: React.FormEvent) {
    e.preventDefault();
    const name = newKitName.trim();
    if (!name) return;
    const kit = await createKit(name);
    setNewKitName("");
    setExpandedId(kit.id);
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    try {
      await deleteKit(id);
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  function startRenameKit(id: string, name: string) {
    setEditingId(id);
    setEditingName(name);
  }

  async function commitRenameKit(id: string) {
    const name = editingName.trim();
    if (name) await renameKit(id, name);
    setEditingId(null);
  }

  return (
    <div className="bnz-card p-3 p-lg-4">
      <h2 className="h5 mb-1">Brand Kits</h2>
      <p className="text-secondary mb-3" style={{ fontSize: "0.875rem" }}>
        Jedes Kit enthält Farbpaletten, die im Editor und beim Ausfüllen von Usages erscheinen.
        Das Standard-Kit wird beim Erstellen einer neuen Usage vorausgewählt.
      </p>

      {deleteError && (
        <div className="alert alert-danger py-2 small mb-3">{deleteError}</div>
      )}

      <div className="d-flex flex-column gap-2">
        {kits.map((k) => (
          <div key={k.id} className="border rounded">
            <div className="d-flex align-items-center gap-2 p-3">
              {editingId === k.id ? (
                <Form
                  className="flex-grow-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitRenameKit(k.id);
                  }}
                >
                  <Form.Control
                    size="sm"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                    onBlur={() => commitRenameKit(k.id)}
                    style={{ maxWidth: "16rem" }}
                  />
                </Form>
              ) : (
                <button
                  type="button"
                  className="btn btn-link p-0 text-start fw-semibold text-body text-decoration-none flex-grow-1"
                  onClick={() => setExpandedId(expandedId === k.id ? null : k.id)}
                >
                  {k.name}
                  {k.isDefault && (
                    <span className="badge bg-primary ms-2" style={{ fontSize: "0.65rem", verticalAlign: "middle" }}>
                      Standard
                    </span>
                  )}
                </button>
              )}

              <div className="d-flex gap-2 flex-shrink-0">
                {!k.isDefault && (
                  <Button variant="link" size="sm" className="p-0 text-secondary" onClick={() => setDefault(k.id)}>
                    Als Standard
                  </Button>
                )}
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 text-secondary"
                  onClick={() => startRenameKit(k.id, k.name)}
                >
                  Umbenennen
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 text-danger"
                  onClick={() => handleDelete(k.id)}
                >
                  Löschen
                </Button>
              </div>
            </div>

            {expandedId === k.id && (
              <div className="border-top px-3 pb-3">
                <KitEditor kitId={k.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      <Form className="d-flex gap-2 mt-3" onSubmit={handleCreateKit}>
        <Form.Control
          placeholder="Neues Brand Kit …"
          value={newKitName}
          onChange={(e) => setNewKitName(e.target.value)}
          style={{ maxWidth: "16rem" }}
        />
        <Button type="submit" variant="outline-primary" disabled={!newKitName.trim()}>
          Anlegen
        </Button>
      </Form>
    </div>
  );
}
