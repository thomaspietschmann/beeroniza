"use client";

import type { FabricEditor } from "./useFabricEditor";
import { displayName, objectKind, type EditorObject } from "./types";

const KIND_ICON: Record<string, string> = {
  text: "T",
  image: "🖼",
  rect: "▭",
  circle: "●",
  other: "◇",
};

export function LayerPanel({ editor }: { editor: FabricEditor }) {
  const { layers, selected } = editor;

  return (
    <section className="bnz-section">
      <h3 className="bnz-section-title">Layers</h3>
      <p className="bnz-section-legend">
        <span className="bnz-dot bnz-dot-dyn" /> Dynamic
        <span className="bnz-dot bnz-dot-static" /> Static
      </p>
      {layers.length === 0 ? (
        <p className="bnz-empty">No layers yet. Add one from the toolbar.</p>
      ) : (
        <ul className="bnz-layers">
          {layers.map((layer, idx) => {
            const obj = layer as EditorObject;
            const active = obj === selected;
            const kind = objectKind(obj);
            const ph = obj.bnzPlaceholder;
            return (
              <li
                key={`${obj.bnzName ?? "obj"}-${idx}`}
                className={`bnz-layer${active ? " is-active" : ""}${ph ? " is-dynamic" : ""}`}
              >
                <button
                  type="button"
                  className="bnz-layer-main"
                  onClick={() => editor.selectObject(obj)}
                >
                  <span className="bnz-layer-icon" aria-hidden>
                    {KIND_ICON[kind] ?? "◇"}
                  </span>
                  <span className="bnz-layer-name">{displayName(obj)}</span>
                  {ph ? (
                    <span className={`bnz-badge bnz-badge-sm bnz-type-${ph.type}`}>
                      {ph.type}
                    </span>
                  ) : (
                    <span className="bnz-badge bnz-badge-sm bnz-badge-static">
                      static
                    </span>
                  )}
                </button>
                <div className="bnz-layer-actions">
                  <button
                    type="button"
                    title={obj.visible ? "Hide" : "Show"}
                    onClick={() => editor.toggleVisibility(obj)}
                  >
                    {obj.visible ? "👁" : "🚫"}
                  </button>
                  <button
                    type="button"
                    title="Bring forward"
                    onClick={() => editor.bringForward(obj)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    title="Send backward"
                    onClick={() => editor.sendBackwards(obj)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => {
                      editor.selectObject(obj);
                      editor.deleteSelected();
                    }}
                  >
                    🗑
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
