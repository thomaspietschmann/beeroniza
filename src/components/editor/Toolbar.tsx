"use client";

import { useRef, useState } from "react";
import type { FabricEditor } from "./useFabricEditor";

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  const data = (await res.json()) as { url: string };
  return data.url;
}

export function Toolbar({ editor }: { editor: FabricEditor }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "image" | "bg">(null);

  async function onImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("image");
    try {
      const url = await uploadFile(file);
      await editor.addImageFromUrl(url);
    } finally {
      setBusy(null);
    }
  }

  async function onBgPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("bg");
    try {
      const url = await uploadFile(file);
      await editor.setBackgroundImage(url);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bnz-toolbar" role="toolbar" aria-label="Add elements">
      <ToolButton
        label="Undo"
        onClick={editor.undo}
        icon="↺"
        disabled={!editor.canUndo}
      />
      <ToolButton
        label="Redo"
        onClick={editor.redo}
        icon="↻"
        disabled={!editor.canRedo}
      />
      <span className="bnz-toolbar-sep" aria-hidden />
      <ToolButton label="Text" onClick={editor.addText} icon="T" />
      <ToolButton label="Rect" onClick={editor.addRect} icon="▭" />
      <ToolButton label="Rounded" onClick={editor.addRoundedRect} icon="▢" />
      <ToolButton label="Circle" onClick={editor.addCircle} icon="●" />
      <ToolButton label="Triangle" onClick={editor.addTriangle} icon="▲" />
      <ToolButton label="Polygon" onClick={editor.addPolygon} icon="⬡" />
      <ToolButton label="Star" onClick={editor.addStar} icon="★" />
      <ToolButton label="Line" onClick={editor.addLine} icon="―" />
      <ToolButton
        label={busy === "image" ? "Uploading…" : "Image"}
        onClick={() => imageInputRef.current?.click()}
        icon="🖼"
        disabled={busy !== null}
      />
      <span className="bnz-toolbar-sep" aria-hidden />
      <ToolButton label="Align left" onClick={() => editor.alignObjects("left")} icon="⇤" />
      <ToolButton label="Align center" onClick={() => editor.alignObjects("centerH")} icon="↔" />
      <ToolButton label="Align right" onClick={() => editor.alignObjects("right")} icon="⇥" />
      <ToolButton label="Align top" onClick={() => editor.alignObjects("top")} icon="⤒" />
      <ToolButton label="Align middle" onClick={() => editor.alignObjects("middle")} icon="↕" />
      <ToolButton label="Align bottom" onClick={() => editor.alignObjects("bottom")} icon="⤓" />
      <ToolButton label="Distribute H" onClick={() => editor.distributeObjects("h")} icon="⇿" />
      <ToolButton label="Distribute V" onClick={() => editor.distributeObjects("v")} icon="⇳" />
      <span className="bnz-toolbar-sep" aria-hidden />
      <ToolButton
        label={busy === "bg" ? "Uploading…" : "Background"}
        onClick={() => bgInputRef.current?.click()}
        icon="▥"
        disabled={busy !== null}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onImagePicked}
      />
      <input
        ref={bgInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onBgPicked}
      />
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  icon,
  disabled,
}: {
  label: string;
  onClick: () => void;
  icon: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="bnz-tool"
      onClick={onClick}
      title={label}
      disabled={disabled}
    >
      <span className="bnz-tool-icon" aria-hidden>
        {icon}
      </span>
      <span className="bnz-tool-label">{label}</span>
    </button>
  );
}
