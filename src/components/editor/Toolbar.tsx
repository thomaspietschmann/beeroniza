"use client";

import { useEffect, useRef, useState } from "react";
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
      <ToolButton
        label={busy === "image" ? "Uploading…" : "Image"}
        onClick={() => imageInputRef.current?.click()}
        icon="🖼"
        disabled={busy !== null}
      />
      <ToolMenu label="Shapes" icon="▭">
        <MenuItem label="Rectangle" icon="▭" onClick={editor.addRect} />
        <MenuItem label="Rounded rectangle" icon="▢" onClick={editor.addRoundedRect} />
        <MenuItem label="Circle" icon="●" onClick={editor.addCircle} />
        <MenuItem label="Triangle" icon="▲" onClick={editor.addTriangle} />
        <MenuItem label="Polygon" icon="⬡" onClick={editor.addPolygon} />
        <MenuItem label="Star" icon="★" onClick={editor.addStar} />
        <MenuItem label="Line" icon="―" onClick={editor.addLine} />
      </ToolMenu>
      <span className="bnz-toolbar-sep" aria-hidden />
      <ToolMenu label="Arrange" icon="↔">
        <MenuItem label="Align left" icon="⇤" onClick={() => editor.alignObjects("left")} />
        <MenuItem label="Align center" icon="↔" onClick={() => editor.alignObjects("centerH")} />
        <MenuItem label="Align right" icon="⇥" onClick={() => editor.alignObjects("right")} />
        <span className="bnz-menu-sep" role="separator" />
        <MenuItem label="Align top" icon="⤒" onClick={() => editor.alignObjects("top")} />
        <MenuItem label="Align middle" icon="↕" onClick={() => editor.alignObjects("middle")} />
        <MenuItem label="Align bottom" icon="⤓" onClick={() => editor.alignObjects("bottom")} />
        <span className="bnz-menu-sep" role="separator" />
        <MenuItem label="Distribute horizontally" icon="⇿" onClick={() => editor.distributeObjects("h")} />
        <MenuItem label="Distribute vertically" icon="⇳" onClick={() => editor.distributeObjects("v")} />
      </ToolMenu>
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

function ToolMenu({
  label,
  icon,
  children,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function place() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
  }

  function toggle() {
    setOpen((v) => {
      if (!v) place();
      return !v;
    });
  }

  // Move focus into the menu when it opens so keyboard users can navigate it.
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [open]);

  // Arrow-key navigation between menu items (WCAG 2.1.1 keyboard support).
  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  }

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    function onReflow() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  return (
    <div className="bnz-tool-menu" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className={`bnz-tool${open ? " is-open" : ""}`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            toggle();
          }
        }}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="bnz-tool-icon" aria-hidden>
          {icon}
        </span>
        <span className="bnz-tool-label">{label}</span>
        <span className="bnz-tool-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div
          className="bnz-menu"
          role="menu"
          style={{ top: pos.top, left: pos.left }}
          onClick={() => setOpen(false)}
          onKeyDown={onMenuKeyDown}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="bnz-menu-item" role="menuitem" onClick={onClick}>
      <span className="bnz-menu-item-icon" aria-hidden>
        {icon}
      </span>
      <span className="bnz-menu-item-label">{label}</span>
    </button>
  );
}
