"use client";

import { useEffect, useRef, useState } from "react";
import type * as fabric from "fabric";
import type { FabricEditor } from "./useFabricEditor";
import {
  isImage,
  isShapeKind,
  isText,
  objectKind,
  type EditorObject,
  type FontInfo,
  type ImageAlign,
  type ImageFit,
  type TextFit,
} from "./types";
import type { ClipShape, PlaceholderType } from "@/lib/template/schema";
import { useBrandKit } from "./useBrandKit";
import { useBrandKits } from "./useBrandKits";

const WEIGHTS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extrabold" },
];

const ALIGN = ["left", "center", "right"] as const;
const CLIPS: ClipShape[] = ["rect", "rounded", "circle"];

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  const data = (await res.json()) as { url: string };
  return data.url;
}

const silent = { silent: true } as const;

export function PropertiesPanel({ editor }: { editor: FabricEditor }) {
  const { selected, revision } = editor;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [selected]);

  if (!selected) {
    return (
      <div className="bnz-props bnz-props-empty">
        <span className="bnz-props-hint">
          Select a layer on the canvas to edit its properties, or add an element
          from the toolbar above.
        </span>
        <span className="bnz-props-hint">
          <strong>Tip:</strong> drag a box over empty canvas — or <kbd>Shift</kbd>-click
          several layers — to select multiple at once, then use the align &amp; distribute
          tools in the toolbar to position them relative to each other.
        </span>
      </div>
    );
  }

  const kind = objectKind(selected);

  return (
    <div className="bnz-props">
      <div className="bnz-props-id">
        <span className={`bnz-kind-pill bnz-kind-${kind}`}>{kind}</span>
        <span className="bnz-props-name">{selected.bnzName ?? kind}</span>
      </div>

      <div className="bnz-props-scroll" ref={scrollRef}>
        <div key={revision}>
          {isText(selected) && <TextProps editor={editor} obj={selected} />}
          {isShapeKind(kind) && <ShapeProps editor={editor} obj={selected} />}
          {isImage(selected) && <ImageProps editor={editor} obj={selected} />}

          <ImageFitControl editor={editor} obj={selected} />

          <CommonProps editor={editor} obj={selected} />

          <span className="bnz-props-vsep" aria-hidden />

          <DynamicControl editor={editor} obj={selected} />
        </div>
      </div>

      <button
        type="button"
        className="bnz-props-del"
        onClick={editor.deleteSelected}
        title="Delete layer (Del)"
      >
        🗑 Delete
      </button>
    </div>
  );
}

// ── Text ──────────────────────────────────────────────────────────────────
function TextProps({ editor, obj }: { editor: FabricEditor; obj: EditorObject }) {
  const t = obj as unknown as fabric.Textbox;
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const { fonts: brandFonts, toggleFont } = useBrandKit();
  const currentFont = t.fontFamily ?? "Inter";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/fonts")
      .then((r) => r.json())
      .then((d: { fonts: FontInfo[] }) => {
        if (!cancelled) setFonts((d.fonts ?? []).slice().sort((a, b) => a.family.localeCompare(b.family)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bnz-props-group">
      <Field label="Content" wide>
        <input
          className="bnz-input"
          defaultValue={t.text ?? ""}
          onChange={(e) => editor.updateSelectedProp({ text: e.target.value }, silent)}
        />
      </Field>

      <Field label="Font">
        <div className="bnz-color-row">
          <select
            className="bnz-input"
            value={currentFont}
            onChange={(e) => editor.updateSelectedProp({ fontFamily: e.target.value })}
          >
            {brandFonts.length > 0 && (
              <optgroup label="★ Brand">
                {brandFonts.map((f) => (
                  <option key={`brand-${f}`} value={f}>
                    {f}
                  </option>
                ))}
              </optgroup>
            )}
            {fonts.length === 0 && <option>{currentFont}</option>}
            {fonts.map((f) => (
              <option key={f.family} value={f.family}>
                {f.family}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="bnz-swatch-save"
            aria-label={brandFonts.includes(currentFont) ? "Remove font from brand kit" : "Save font to brand kit"}
            title={brandFonts.includes(currentFont) ? "Saved in brand kit — click to remove" : "Save font to brand kit"}
            onClick={() => toggleFont(currentFont)}
          >
            {brandFonts.includes(currentFont) ? "★" : "☆"}
          </button>
        </div>
      </Field>

      <Field label="Size" narrow>
        <input
          className="bnz-input"
          type="number"
          min={1}
          defaultValue={Math.round(t.fontSize ?? 32)}
          onChange={(e) => editor.updateSelectedProp({ fontSize: Number(e.target.value) }, silent)}
        />
      </Field>

      <Field label="Weight">
        <select
          className="bnz-input"
          defaultValue={String(t.fontWeight ?? "400")}
          onChange={(e) => editor.updateSelectedProp({ fontWeight: e.target.value })}
        >
          {WEIGHTS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Color" narrow>
        <ColorInput
          value={String(t.fill ?? "#111111")}
          onChange={(v) => editor.updateSelectedProp({ fill: v }, silent)}
        />
      </Field>

      <Field label="Align">
        <div className="bnz-segmented">
          {ALIGN.map((a) => (
            <button
              key={a}
              type="button"
              className={t.textAlign === a ? "is-active" : ""}
              onClick={() => editor.updateSelectedProp({ textAlign: a })}
              title={a}
            >
              {a === "left" ? "⬅" : a === "center" ? "⬌" : "➡"}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

// ── Shapes ────────────────────────────────────────────────────────────────
function ShapeProps({ editor, obj }: { editor: FabricEditor; obj: EditorObject }) {
  const s = obj as fabric.FabricObject;
  // When a shape is a dynamic image, its fill is replaced at render time, so the
  // editor colour picker is irrelevant — hide it to avoid confusion.
  const isDynamicImage = obj.bnzPlaceholder?.kind === "image";

  return (
    <div className="bnz-props-group">
      {isDynamicImage ? (
        <span className="bnz-imgframe-note" title="This shape is filled with an image at render time">
          🖼 Image-filled at render
        </span>
      ) : (
        <Field label="Fill" narrow>
          <ColorInput
            value={String(s.fill ?? "#6c5ce7")}
            onChange={(v) => editor.updateSelectedProp({ fill: v }, silent)}
          />
        </Field>
      )}
      <Field label="Stroke" narrow>
        <ColorInput
          value={String(s.stroke ?? "#000000")}
          onChange={(v) => editor.updateSelectedProp({ stroke: v, strokeDashArray: null }, silent)}
        />
      </Field>
      <Field label="Stroke W" narrow>
        <input
          className="bnz-input"
          type="number"
          min={0}
          defaultValue={s.strokeWidth ?? 0}
          onChange={(e) => editor.updateSelectedProp({ strokeWidth: Number(e.target.value), strokeDashArray: null }, silent)}
        />
      </Field>
    </div>
  );
}

// ── Image ─────────────────────────────────────────────────────────────────
function ImageProps({ editor, obj }: { editor: FabricEditor; obj: EditorObject }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const current = obj.bnzClip;

  async function onReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadFile(file);
    const img = obj as fabric.FabricImage;
    const targetW = (img.width ?? 0) * (img.scaleX ?? 1);
    const targetH = (img.height ?? 0) * (img.scaleY ?? 1);
    await img.setSrc(url, { crossOrigin: "anonymous" });
    const natW = img.width ?? targetW;
    const natH = img.height ?? targetH;
    if (natW > 0 && natH > 0 && targetW > 0 && targetH > 0) {
      const scale = Math.max(targetW / natW, targetH / natH);
      editor.updateSelectedProp({ scaleX: scale, scaleY: scale });
    } else {
      editor.updateSelectedProp({});
    }
  }

  return (
    <div className="bnz-props-group">
      <Field label="Source">
        <button type="button" className="bnz-btn" onClick={() => fileRef.current?.click()}>
          Replace image…
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onReplace} />
      </Field>
      <Field label="Crop shape">
        <div className="bnz-segmented bnz-segmented-wide">
          {CLIPS.map((c) => (
            <button key={c} type="button" className={current === c ? "is-active" : ""} onClick={() => editor.setClip(c)}>
              {c}
            </button>
          ))}
          <button type="button" className={!current ? "is-active" : ""} onClick={() => editor.clearClip()}>
            none
          </button>
        </div>
      </Field>
    </div>
  );
}

// ── Image fit & alignment (cover/contain) ───────────────────────────────────
const FIT_OPTIONS: { value: ImageFit; label: string }[] = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
];

const ALIGN_OPTIONS: { value: ImageAlign; label: string; glyph: string }[] = [
  { value: "left", label: "Left", glyph: "⬅" },
  { value: "center", label: "Center", glyph: "⬌" },
  { value: "right", label: "Right", glyph: "➡" },
];

// Shown for image objects and for shapes that are dynamically filled with an
// image. Reads/writes obj.bnzImageFit / obj.bnzImageAlign via updateSelectedProp.
function ImageFitControl({ editor, obj }: { editor: FabricEditor; obj: EditorObject }) {
  const fit: ImageFit = obj.bnzImageFit ?? "cover";
  const align: ImageAlign = obj.bnzImageAlign ?? "center";

  const fillsWithImage = isImage(obj) || obj.bnzPlaceholder?.kind === "image";
  if (!fillsWithImage) return null;

  return (
    <>
      <span className="bnz-props-vsep" aria-hidden />
      <div className="bnz-props-group">
        <Field label="Image fit">
          <div className="bnz-segmented bnz-segmented-wide">
            {FIT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={fit === o.value ? "is-active" : ""}
                onClick={() => editor.updateSelectedProp({ bnzImageFit: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>

        {fit === "contain" && (
          <Field label="Align">
            <div className="bnz-segmented">
              {ALIGN_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  title={o.label}
                  className={align === o.value ? "is-active" : ""}
                  onClick={() => editor.updateSelectedProp({ bnzImageAlign: o.value })}
                >
                  {o.glyph}
                </button>
              ))}
            </div>
          </Field>
        )}

        <p className="bnz-field-hint">
          Contain keeps the whole image (good for transparent logos).
        </p>
      </div>
    </>
  );
}

// ── Common position / size ──────────────────────────────────────────────────
function CommonProps({ editor, obj }: { editor: FabricEditor; obj: EditorObject }) {
  const w = Math.round((obj.width ?? 0) * (obj.scaleX ?? 1));
  const h = Math.round((obj.height ?? 0) * (obj.scaleY ?? 1));

  function setWidth(value: number) {
    const natW = obj.width ?? 1;
    if (natW > 0) editor.updateSelectedProp({ scaleX: value / natW }, silent);
  }
  function setHeight(value: number) {
    const natH = obj.height ?? 1;
    if (natH > 0) editor.updateSelectedProp({ scaleY: value / natH }, silent);
  }

  return (
    <>
      <span className="bnz-props-vsep" aria-hidden />
      <div className="bnz-props-group">
        <Field label="X" narrow>
          <input className="bnz-input" type="number" defaultValue={Math.round(obj.left ?? 0)} onChange={(e) => editor.updateSelectedProp({ left: Number(e.target.value) }, silent)} />
        </Field>
        <Field label="Y" narrow>
          <input className="bnz-input" type="number" defaultValue={Math.round(obj.top ?? 0)} onChange={(e) => editor.updateSelectedProp({ top: Number(e.target.value) }, silent)} />
        </Field>
        <Field label="W" narrow>
          <input className="bnz-input" type="number" min={1} defaultValue={w} onChange={(e) => setWidth(Number(e.target.value))} />
        </Field>
        <Field label="H" narrow>
          <input className="bnz-input" type="number" min={1} defaultValue={h} onChange={(e) => setHeight(Number(e.target.value))} />
        </Field>
        <Field label="Rotation" narrow>
          <input className="bnz-input" type="number" defaultValue={Math.round(obj.angle ?? 0)} onChange={(e) => editor.updateSelectedProp({ angle: Number(e.target.value) }, silent)} />
        </Field>
        <Field label="Opacity" narrow>
          <input className="bnz-input" type="number" min={0} max={1} step={0.05} defaultValue={obj.opacity ?? 1} onChange={(e) => editor.updateSelectedProp({ opacity: Number(e.target.value) }, silent)} />
        </Field>
      </div>
    </>
  );
}

// ── Dynamic content (fillable via form & API) ────────────────────────────────
const FIT_MODES: { value: TextFit; label: string; hint: string }[] = [
  { value: "shrink", label: "Shrink", hint: "Shrink font to fit, then trim with …" },
  { value: "truncate", label: "Trim", hint: "Keep size, trim with … if too long" },
  { value: "wrap", label: "Wrap", hint: "Let it grow (may overflow)" },
];

function typeOptionsFor(kind: string): { value: PlaceholderType; label: string }[] {
  if (kind === "text") return [{ value: "text", label: "Text" }];
  if (kind === "image") return [{ value: "image", label: "Image" }];
  if (kind === "rect" || kind === "circle")
    return [
      { value: "image", label: "Image" },
      { value: "color", label: "Color" },
    ];
  if (kind === "triangle" || kind === "line") return [{ value: "color", label: "Color" }];
  return [{ value: "text", label: "Text" }];
}

function defaultTypeFor(kind: string): PlaceholderType {
  if (kind === "image") return "image";
  if (kind === "rect" || kind === "circle") return "image";
  if (kind === "triangle" || kind === "line") return "color";
  return "text";
}

function DynamicControl({ editor, obj }: { editor: FabricEditor; obj: EditorObject }) {
  const kind = objectKind(obj);
  const existing = obj.bnzPlaceholder;
  const isDynamic = Boolean(existing);
  const typeOptions = typeOptionsFor(kind);
  const type = existing?.kind ?? defaultTypeFor(kind);

  const [key, setKey] = useState(obj.bnzName ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");

  // Suggest a unique key when enabling.
  function suggestKey(): string {
    const base = kind === "text" ? "text" : kind === "image" ? "image" : kind === "circle" || kind === "rect" ? "image" : "field";
    const used = new Set(editor.layers.map((l) => l.bnzName).filter(Boolean) as string[]);
    if (obj.bnzName && !used.has(obj.bnzName)) return obj.bnzName;
    let i = 1;
    let candidate = base;
    while (used.has(candidate)) {
      i += 1;
      candidate = `${base}_${i}`;
    }
    return candidate;
  }

  function enable() {
    const k = (key.trim() || suggestKey());
    setKey(k);
    editor.markPlaceholder(k, defaultTypeFor(kind), label.trim() || undefined);
  }
  function disable() {
    editor.clearPlaceholder();
  }
  function saveKey() {
    const k = key.trim();
    if (!k || !isDynamic) return;
    editor.markPlaceholder(k, type, label.trim() || undefined);
  }
  function saveLabel() {
    if (!isDynamic) return;
    editor.markPlaceholder(key.trim() || suggestKey(), type, label.trim() || undefined);
  }
  function setType(newType: PlaceholderType) {
    editor.markPlaceholder(key.trim() || suggestKey(), newType, label.trim() || undefined);
  }

  // Duplicate-key detection (excluding self).
  const duplicate =
    isDynamic &&
    editor.layers.filter((l) => l !== obj && l.bnzName === obj.bnzName).length > 0;

  return (
    <div className={`bnz-dyn${isDynamic ? " is-on" : ""}`}>
      <label className="bnz-dyn-toggle" title="Fill this layer via the form & API">
        <input
          type="checkbox"
          checked={isDynamic}
          onChange={(e) => (e.target.checked ? enable() : disable())}
        />
        <span className="bnz-dyn-toggle-text">
          <strong>{isDynamic ? "Dynamic" : "Static"}</strong>
          <span className="bnz-dyn-sub">
            {isDynamic ? "fillable via API" : "rendered as designed"}
          </span>
        </span>
      </label>

      {isDynamic && (
        <div className="bnz-dyn-body">
          <Field label="Field name (API key)">
            <input
              className="bnz-input bnz-mono"
              value={key}
              placeholder="e.g. title"
              onChange={(e) => setKey(e.target.value)}
              onBlur={saveKey}
            />
          </Field>

          {typeOptions.length > 1 && (
            <Field label="Fill with">
              <div className="bnz-segmented bnz-segmented-wide">
                {typeOptions.map((o) => (
                  <button key={o.value} type="button" className={type === o.value ? "is-active" : ""} onClick={() => setType(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="Label (optional)">
            <input
              className="bnz-input"
              value={label}
              placeholder="Form label"
              onChange={(e) => setLabel(e.target.value)}
              onBlur={saveLabel}
            />
          </Field>

          {kind === "text" && (
            <Field label="If too long">
              <div className="bnz-segmented bnz-segmented-wide">
                {FIT_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    title={m.hint}
                    className={(obj.bnzFit ?? "shrink") === m.value ? "is-active" : ""}
                    onClick={() => editor.updateSelectedProp({ bnzFit: m.value })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {duplicate && <p className="bnz-warn">⚠ Duplicate key — must be unique.</p>}
        </div>
      )}
    </div>
  );
}

// ── Small primitives ────────────────────────────────────────────────────────
function Field({
  label,
  children,
  narrow,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  narrow?: boolean;
  wide?: boolean;
}) {
  const cls = `bnz-field${narrow ? " bnz-field-narrow" : ""}${wide ? " bnz-field-wide" : ""}`;
  return (
    <label className={cls}>
      <span className="bnz-field-label">{label}</span>
      {children}
    </label>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const normalized = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : "#000000";
  // Default kit: used for the +/− save action.
  const { kit: defaultKit, addColor, removeColor } = useBrandKit();
  // All kits: shown as grouped swatches so all brand colours are reachable.
  const { kits } = useBrandKits();

  const inDefaultKit = defaultKit.palettes.some((p) => p.colors.includes(normalized));
  const kitLabel = defaultKit.name ? `"${defaultKit.name}"` : "default brand kit";
  const hasAnyColor = kits.length > 0; // swatches section shown as soon as kits exist

  return (
    <div className="bnz-color">
      <div className="bnz-color-row">
        <input type="color" value={normalized} onChange={(e) => onChange(e.target.value)} />
        <button
          type="button"
          className="bnz-swatch-save"
          aria-label={inDefaultKit ? `Remove from brand kit ${kitLabel}` : `Save to brand kit ${kitLabel}`}
          title={inDefaultKit ? `Remove from brand kit ${kitLabel}` : `Save to brand kit ${kitLabel}`}
          onClick={() => (inDefaultKit ? removeColor(normalized) : addColor(normalized))}
        >
          {inDefaultKit ? "−" : "+"}
        </button>
      </div>
      {hasAnyColor &&
        kits.map((k) => {
          // Load each kit's palettes inline via the per-kit hook.
          return <KitSwatches key={k.id} kitId={k.id} kitName={k.name} isDefault={k.isDefault} onPick={onChange} />;
        })}
    </div>
  );
}

function KitSwatches({
  kitId,
  kitName,
  isDefault,
  onPick,
}: {
  kitId: string;
  kitName: string;
  isDefault: boolean;
  onPick: (c: string) => void;
}) {
  const { palettes } = useBrandKit(kitId);
  const activePalettes = palettes.filter((p) => p.colors.length > 0);
  if (activePalettes.length === 0) return null;
  return (
    <div className="bnz-palette-group">
      <span className="bnz-palette-name">{kitName}{isDefault ? " ·  default" : ""}</span>
      {activePalettes.map((palette) => (
        <div key={palette.id}>
          {activePalettes.length > 1 && (
            <span className="bnz-palette-name" style={{ opacity: 0.6, fontSize: "0.62rem" }}>{palette.name}</span>
          )}
          <div className="bnz-swatches" role="group" aria-label={`${kitName} – ${palette.name}`}>
            {palette.colors.map((c) => (
              <button
                key={c}
                type="button"
                className="bnz-swatch"
                style={{ background: c }}
                title={c}
                aria-label={`Use ${c}`}
                onClick={() => onPick(c)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
