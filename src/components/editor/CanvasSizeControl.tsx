"use client";

import { useState } from "react";
import { SIZE_PRESETS, presetById } from "@/lib/presets";
import type { FabricEditor } from "./useFabricEditor";

const CUSTOM = "__custom__";

export function CanvasSizeControl({ editor }: { editor: FabricEditor }) {
  const { width, height } = editor.canvasSize;
  // Draft values for the editable W/H inputs. They re-sync to the editor's
  // canvas size whenever it changes from elsewhere (undo/redo, programmatic
  // resize) via the adjust-state-during-render pattern below, so the control
  // never shows a stale size. See https://react.dev/learn/you-might-not-need-an-effect
  const [draftW, setDraftW] = useState(width);
  const [draftH, setDraftH] = useState(height);
  const [lastSize, setLastSize] = useState({ width, height });
  if (lastSize.width !== width || lastSize.height !== height) {
    setLastSize({ width, height });
    setDraftW(width);
    setDraftH(height);
  }

  const presetId =
    SIZE_PRESETS.find((p) => p.width === draftW && p.height === draftH)?.id ?? CUSTOM;

  function onPreset(id: string) {
    const p = presetById(id);
    if (p) {
      setDraftW(p.width);
      setDraftH(p.height);
      editor.setCanvasSize(p.width, p.height);
    }
  }

  function applyCustom() {
    if (draftW > 0 && draftH > 0) editor.setCanvasSize(Math.round(draftW), Math.round(draftH));
  }

  return (
    <div className="bnz-size-ctl" aria-label="Canvas size">
      <span className="bnz-size-icon" aria-hidden>
        ⬚
      </span>
      <select
        className="bnz-input bnz-size-preset"
        value={presetId}
        onChange={(e) => onPreset(e.target.value)}
        aria-label="Size preset"
      >
        {SIZE_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label} — {p.width}×{p.height}
          </option>
        ))}
        <option value={CUSTOM}>Custom…</option>
      </select>
      <input
        className="bnz-input bnz-size-num"
        type="number"
        min={1}
        max={8000}
        value={draftW}
        aria-label="Width"
        onChange={(e) => setDraftW(Number(e.target.value))}
        onBlur={applyCustom}
      />
      <span className="bnz-size-x" aria-hidden>
        ×
      </span>
      <input
        className="bnz-input bnz-size-num"
        type="number"
        min={1}
        max={8000}
        value={draftH}
        aria-label="Height"
        onChange={(e) => setDraftH(Number(e.target.value))}
        onBlur={applyCustom}
      />
    </div>
  );
}
