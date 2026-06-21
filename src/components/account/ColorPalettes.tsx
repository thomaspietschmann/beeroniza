"use client";

import { useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { useBrandKit, type Palette } from "@/components/editor/useBrandKit";

export function ColorPalettes() {
  const { palettes, addPalette, removePalette, renamePalette, addColorToPalette, removeColorFromPalette } =
    useBrandKit();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [addingColor, setAddingColor] = useState<{ paletteId: string; value: string } | null>(null);

  function handleCreatePalette(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    addPalette(name);
    setNewName("");
  }

  function startRename(p: Palette) {
    setEditingId(p.id);
    setEditingName(p.name);
  }

  function commitRename(id: string) {
    const name = editingName.trim();
    if (name) renamePalette(id, name);
    setEditingId(null);
  }

  function handleAddColor(e: React.FormEvent) {
    e.preventDefault();
    if (!addingColor) return;
    addColorToPalette(addingColor.paletteId, addingColor.value);
    setAddingColor(null);
  }

  return (
    <div className="bnz-card p-3 p-lg-4">
      <h2 className="h5 mb-1">Farbpaletten</h2>
      <p className="text-secondary mb-3" style={{ fontSize: "0.875rem" }}>
        Paletten erscheinen im Farbpicker des Editors und der Usage-Formulare.
      </p>

      <div className="d-flex flex-column gap-3">
        {palettes.map((p) => (
          <div key={p.id} className="border rounded p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              {editingId === p.id ? (
                <Form
                  className="d-flex gap-2 flex-grow-1 me-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitRename(p.id);
                  }}
                >
                  <Form.Control
                    size="sm"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                    onBlur={() => commitRename(p.id)}
                    style={{ maxWidth: "16rem" }}
                  />
                </Form>
              ) : (
                <button
                  type="button"
                  className="btn btn-link p-0 text-start fw-semibold text-body text-decoration-none"
                  title="Umbenennen"
                  onClick={() => startRename(p)}
                >
                  {p.name}
                </button>
              )}
              <Button
                variant="link"
                size="sm"
                className="text-danger p-0"
                title="Palette löschen"
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
                    style={{ width: "2rem", height: "2rem", padding: 0, border: "1px solid var(--bs-border-color)", borderRadius: "0.35rem", cursor: "pointer" }}
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
      </div>

      <Form className="d-flex gap-2 mt-3" onSubmit={handleCreatePalette}>
        <Form.Control
          placeholder="Neue Palette …"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ maxWidth: "16rem" }}
        />
        <Button type="submit" variant="outline-primary" disabled={!newName.trim()}>
          Anlegen
        </Button>
      </Form>
    </div>
  );
}
