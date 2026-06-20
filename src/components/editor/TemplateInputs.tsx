"use client";

import type { FabricEditor } from "./useFabricEditor";
import type { EditorObject } from "./types";

// The at-a-glance contract: every dynamic field this template exposes via the
// form & API. Click a row to jump to that layer.
export function TemplateInputs({ editor }: { editor: FabricEditor }) {
  const seen = new Set<string>();
  const fields: EditorObject[] = [];
  for (const l of editor.layers) {
    if (l.bnzPlaceholder && l.bnzName && !seen.has(l.bnzName)) {
      seen.add(l.bnzName);
      fields.push(l);
    }
  }

  return (
    <section className="bnz-section">
      <h3 className="bnz-section-title">Template inputs · API</h3>
      {fields.length === 0 ? (
        <p className="bnz-empty">
          No dynamic fields yet. Select a layer and turn on “Dynamic field” to
          expose it via the form &amp; API.
        </p>
      ) : (
        <ul className="bnz-inputs">
          {fields.map((f) => {
            const ph = f.bnzPlaceholder!;
            return (
              <li key={f.bnzName} className="bnz-input-row" onClick={() => editor.selectObject(f)}>
                <span className={`bnz-type-badge bnz-type-${ph.kind}`}>{ph.kind}</span>
                <code className="bnz-input-key">{f.bnzName}</code>
                {ph.label && <span className="bnz-input-label">{ph.label}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
