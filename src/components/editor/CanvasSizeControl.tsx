"use client";

import { useState } from "react";
import { SIZE_PRESETS, presetById } from "@/lib/presets";
import type { FabricEditor } from "./useFabricEditor";

const CUSTOM = "__custom__";

export function CanvasSizeControl({ editor }: { editor: FabricEditor }) {
  const { width, height } = editor.canvasSize;
  const matched = SIZE_PRESETS.find((p) => p.width === width && p.height === height);
  const [presetId, setPresetId] = useState<string>(matched?.id ?? CUSTOM);
  const [w, setW] = useState(width);
  const [h, setH] = useState(height);

  function onPreset(id: string) {
    setPresetId(id);
    const p = presetById(id);
    if (p) {
      setW(p.width);
      setH(p.height);
      editor.setCanvasSize(p.width, p.height);
    }
  }

  function applyCustom() {
    if (w > 0 && h > 0) editor.setCanvasSize(Math.round(w), Math.round(h));
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
        value={w}
        aria-label="Width"
        onChange={(e) => {
          setPresetId(CUSTOM);
          setW(Number(e.target.value));
        }}
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
        value={h}
        aria-label="Height"
        onChange={(e) => {
          setPresetId(CUSTOM);
          setH(Number(e.target.value));
        }}
        onBlur={applyCustom}
      />
    </div>
  );
}
