"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Alert from "react-bootstrap/Alert";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import {
  templateDocSchema,
  SCHEMA_VERSION,
  type TemplateDoc,
} from "@/lib/template/schema";
import { LOCK_HEARTBEAT_MS, type LockInfo } from "@/lib/template-lock";
import type { TemplateResponse } from "./types";
import { useFabricEditor } from "./useFabricEditor";
import { Toolbar } from "./Toolbar";
import { LayerPanel } from "./LayerPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { CanvasSizeControl } from "./CanvasSizeControl";
import { TemplateInputs } from "./TemplateInputs";
import { NewUsageModal } from "@/components/usages/NewUsageModal";

type SaveState = "idle" | "saving" | "saved" | "error";
type LockState = "pending" | "editing" | "readonly";

function coerceDoc(raw: unknown, width: number, height: number): TemplateDoc {
  const parsed = templateDocSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Fallback: empty document at the template's stored dimensions.
  return {
    schemaVersion: SCHEMA_VERSION,
    canvas: { width, height },
    fabric: { version: "7.0.0", objects: [] },
    placeholders: [],
  };
}

export function EditorApp({ id }: { id: string }) {
  const [doc, setDoc] = useState<TemplateDoc | null>(null);
  const [name, setName] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Concurrent-edit lock state.
  const [lockState, setLockState] = useState<LockState>("pending");
  const [lockInfo, setLockInfo] = useState<LockInfo | null>(null);
  const [showTakeoverModal, setShowTakeoverModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const baseUpdatedAt = useRef<string | null>(null);

  // Floating panel visibility (Layers / Template inputs). Off-canvas chrome so
  // the stage stays full-width.
  const [showLayers, setShowLayers] = useState(false);
  const [showInputs, setShowInputs] = useState(false);

  const editor = useFabricEditor(doc);
  const router = useRouter();

  // Unsaved-changes tracking + leave guard.
  const [dirty, setDirty] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [showUse, setShowUse] = useState(false);
  const baselineRevision = useRef<number | null>(null);

  // Inject fresh per-user @font-face CSS on mount so recently-imported fonts are
  // available even if the layout's stylesheet link was served from cache.
  useEffect(() => {
    fetch("/api/fonts/css", { cache: "no-store" })
      .then((r) => r.text())
      .then((css) => {
        let el = document.getElementById("bnz-editor-fonts") as HTMLStyleElement | null;
        if (!el) {
          el = document.createElement("style");
          el.id = "bnz-editor-fonts";
          document.head.appendChild(el);
        }
        el.textContent = css;
      })
      .catch(() => { /* ignore; bundled fonts from the layout link still work */ });
  }, []);

  // Load the template once, then acquire the edit lock.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/templates/${id}`);
        if (!res.ok) throw new Error("Failed to load template");
        const data = (await res.json()) as TemplateResponse;
        if (cancelled) return;
        baseUpdatedAt.current = data.template.updatedAt;
        setName(data.template.name);
        setDoc(
          coerceDoc(data.template.data, data.template.width, data.template.height),
        );

        const lockRes = await fetch(`/api/templates/${id}/lock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "acquire" }),
        });
        if (cancelled) return;
        if (lockRes.ok) {
          setLockState("editing");
        } else if (lockRes.status === 409) {
          const lockData = (await lockRes.json()) as { lock: LockInfo | null };
          setLockInfo(lockData.lock);
          setShowTakeoverModal(true);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Heartbeat: refresh the lock every LOCK_HEARTBEAT_MS while we hold it.
  useEffect(() => {
    if (lockState !== "editing") return;
    let cancelled = false;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/templates/${id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat" }),
      });
      if (cancelled) return;
      if (res.status === 409) {
        const resData = (await res.json()) as { lock: LockInfo | null };
        setLockState("readonly");
        setLockInfo(resData.lock ?? null);
      }
    }, LOCK_HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, lockState]);

  // Release the lock when navigating away within the SPA (component unmounts).
  useEffect(() => {
    return () => {
      fetch(`/api/templates/${id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release" }),
      }).catch(() => {});
    };
  }, [id]);

  const save = useCallback(async (force = false): Promise<boolean> => {
    if (!editor.ready || lockState !== "editing") return false;
    setSaveState("saving");
    try {
      const data = editor.serialize();
      const res = await fetch(`/api/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          width: data.canvas.width,
          height: data.canvas.height,
          data,
          ...(!force && baseUpdatedAt.current
            ? { expectedUpdatedAt: baseUpdatedAt.current }
            : {}),
        }),
      });
      if (res.status === 409) {
        setSaveState("error");
        setShowConflictModal(true);
        return false;
      }
      if (!res.ok) throw new Error("Save failed");
      const saved = (await res.json()) as TemplateResponse;
      baseUpdatedAt.current = saved.template.updatedAt;
      setSaveState("saved");
      setDirty(false);
      baselineRevision.current = editor.revision;
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }, [editor, id, name, lockState]);

  const takeLock = useCallback(async () => {
    setShowTakeoverModal(false);
    const res = await fetch(`/api/templates/${id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acquire", force: true }),
    });
    if (res.ok) {
      setLockState("editing");
      setLockInfo(null);
    }
  }, [id]);

  const viewOnly = useCallback(() => {
    setShowTakeoverModal(false);
    setLockState("readonly");
  }, []);

  const forceSave = useCallback(() => {
    setShowConflictModal(false);
    void save(true);
  }, [save]);

  // Cmd/Ctrl+S saves; Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z or Ctrl+Y redoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        void save();
        return;
      }
      // Don't hijack undo/redo while editing text (let the input/textbox handle
      // its own caret-level undo).
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (editor.isEditingText()) return;
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        editor.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, editor]);

  // Capture a baseline once the editor is ready; any later mutation = dirty.
  useEffect(() => {
    if (editor.ready && baselineRevision.current === null) {
      baselineRevision.current = editor.revision;
    }
  }, [editor.ready, editor.revision]);
  useEffect(() => {
    if (
      baselineRevision.current !== null &&
      editor.revision !== baselineRevision.current
    ) {
      setDirty(true);
    }
  }, [editor.revision]);

  // Native guard for tab close / hard navigation. Also releases the lock via
  // sendBeacon (works even as the page is closing, unlike fetch).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      navigator.sendBeacon(
        `/api/templates/${id}/lock`,
        new Blob([JSON.stringify({ action: "release" })], { type: "application/json" }),
      );
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [id, dirty]);

  const requestUse = useCallback(async () => {
    if (dirty) {
      const ok = await save();
      if (!ok) return;
    }
    setShowUse(true);
  }, [dirty, save]);

  const requestLeave = useCallback(() => {
    if (dirty) setShowLeave(true);
    else router.push("/templates");
  }, [dirty, router]);
  const saveAndLeave = useCallback(async () => {
    const ok = await save();
    if (ok) router.push("/templates");
  }, [save, router]);
  const leaveWithoutSaving = useCallback(() => {
    setDirty(false);
    router.push("/templates");
  }, [router]);

  const dynamicCount = (() => {
    const seen = new Set<string>();
    for (const l of editor.layers) {
      if (l.bnzPlaceholder && l.bnzName) seen.add(l.bnzName);
    }
    return seen.size;
  })();

  if (loadError) {
    return (
      <div className="bnz-editor-error">
        <p>{loadError}</p>
        <Link href="/templates" className="bnz-btn">
          Back to templates
        </Link>
      </div>
    );
  }

  return (
    <div className="editor-root bnz-editor">
      {/* ── Top chrome: identity + global actions ──────────────────────── */}
      <Topbar
        name={name}
        onName={(v) => {
          setName(v);
          setDirty(true);
        }}
        onSave={save}
        onBack={requestLeave}
        onUse={requestUse}
        saveState={saveState}
        ready={editor.ready}
        readOnly={lockState !== "editing"}
        editor={editor}
      />

      {/* ── Read-only lock banner ───────────────────────────────────────── */}
      {lockState === "readonly" && (
        <Alert variant="warning" className="mb-0 py-2 text-center small rounded-0">
          <strong>{lockInfo?.lockedByName ?? "Someone"}</strong> is editing this template — you are in read-only mode.
        </Alert>
      )}

      {/* ── Tool strip: add elements + canvas size + panel toggles ─────── */}
      <div className="bnz-toolstrip">
        <Toolbar editor={editor} />
        <div className="bnz-toolstrip-spacer" />
        <CanvasSizeControl editor={editor} />
        <div className="bnz-toolstrip-sep" />
        <div className="bnz-panel-toggles">
          <button
            type="button"
            className={`bnz-chip${showLayers ? " is-active" : ""}`}
            onClick={() => setShowLayers((v) => !v)}
            title="Toggle layers panel"
          >
            <span aria-hidden>▤</span> Layers
            <span className="bnz-chip-count">{editor.layers.length}</span>
          </button>
          <button
            type="button"
            className={`bnz-chip${showInputs ? " is-active" : ""}`}
            onClick={() => setShowInputs((v) => !v)}
            title="Toggle template inputs (API) panel"
          >
            <span aria-hidden>⚡</span> Inputs
            <span className="bnz-chip-count">{dynamicCount}</span>
          </button>
        </div>
      </div>

      {/* ── Body: canvas stage (left) + properties sidebar (right) ─────── */}
      <div className="bnz-body">
        {/* Canvas stage fills the remaining width. */}
        <main className="bnz-canvas-area" ref={editor.containerRef}>
          {!editor.ready && <div className="bnz-loading">Loading editor…</div>}
          <div className="bnz-canvas-shadow">
            <canvas ref={editor.canvasElRef} />
          </div>
          {editor.ready && (
            <div className="bnz-zoom-badge">{Math.round(editor.zoom * 100)}%</div>
          )}

          {showLayers && (
            <FloatingPanel
              className="bnz-float bnz-float-left"
              onClose={() => setShowLayers(false)}
            >
              <LayerPanel editor={editor} />
            </FloatingPanel>
          )}

          {showInputs && (
            <FloatingPanel
              className="bnz-float bnz-float-right"
              onClose={() => setShowInputs(false)}
            >
              <TemplateInputs editor={editor} />
            </FloatingPanel>
          )}
        </main>

        {/* Fixed-width sidebar holding per-selection properties. */}
        <aside className="bnz-sidebar">
          <PropertiesPanel editor={editor} />
        </aside>
      </div>

      <NewUsageModal
        templateId={id}
        show={showUse}
        onHide={() => setShowUse(false)}
      />

      <Modal show={showLeave} onHide={() => setShowLeave(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h6">Unsaved changes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          You have unsaved changes to this template. Do you want to save them
          before leaving?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-danger" onClick={leaveWithoutSaving}>
            Leave without saving
          </Button>
          <Button variant="outline-secondary" onClick={() => setShowLeave(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveAndLeave}>
            Save &amp; leave
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Takeover modal: another user already holds the lock ─────────── */}
      <Modal show={showTakeoverModal} onHide={() => {}} backdrop="static" centered>
        <Modal.Header>
          <Modal.Title className="h6">Template is being edited</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <strong>{lockInfo?.lockedByName ?? "Another user"}</strong> is currently
          editing this template
          {lockInfo?.lockedAt
            ? ` (since ${new Date(lockInfo.lockedAt).toLocaleTimeString()})`
            : ""}
          . You can view it in read-only mode or take over editing (they will be
          notified on their next save attempt).
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={viewOnly}>
            View only
          </Button>
          <Button variant="primary" onClick={takeLock}>
            Take over
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Conflict modal: template was modified while we were editing ─── */}
      <Modal show={showConflictModal} onHide={() => setShowConflictModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h6">Conflicting changes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          This template was saved by someone else while you were editing. You can
          reload to see their version (your local changes will be lost) or
          overwrite with your version.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-danger" onClick={() => window.location.reload()}>
            Reload (discard my changes)
          </Button>
          <Button variant="outline-secondary" onClick={() => setShowConflictModal(false)}>
            Cancel
          </Button>
          <Button variant="warning" onClick={forceSave}>
            Overwrite
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function FloatingPanel({
  className,
  onClose,
  children,
}: {
  className: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <button
        type="button"
        className="bnz-float-close"
        onClick={onClose}
        title="Close panel"
        aria-label="Close panel"
      >
        ×
      </button>
      {children}
    </div>
  );
}

function Topbar({
  name,
  onName,
  onSave,
  onBack,
  onUse,
  saveState,
  ready,
  readOnly,
  editor,
}: {
  name: string;
  onName: (v: string) => void;
  onSave: () => void;
  onBack: () => void;
  onUse: () => void;
  saveState: SaveState;
  ready: boolean;
  readOnly: boolean;
  editor: ReturnType<typeof useFabricEditor>;
}) {
  const statusText: Record<SaveState, string> = {
    idle: "",
    saving: "Saving…",
    saved: "All changes saved",
    error: "Save failed",
  };

  return (
    <header className="bnz-topbar">
      <div className="bnz-topbar-left">
        <a href="/dashboard" className="bnz-topbar-logo" title="Dashboard" aria-label="Beeroniza — go to dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bee/beeroniza-bee-mark.png" alt="" width={24} height={24} />
        </a>
        <button
          type="button"
          className="bnz-back"
          onClick={onBack}
          title="Back to templates"
        >
          ‹ Templates
        </button>
        <input
          className="bnz-name-input"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Untitled template"
          aria-label="Template name"
        />
      </div>
      <div className="bnz-topbar-right">
        <div className="bnz-zoom-ctl" role="group" aria-label="Zoom">
          <button
            type="button"
            onClick={editor.zoomOut}
            disabled={!ready}
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="bnz-zoom-ctl-val"
            onClick={editor.zoomToFit}
            disabled={!ready}
            title="Fit to screen"
          >
            {Math.round(editor.zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={editor.zoomIn}
            disabled={!ready}
            title="Zoom in"
          >
            +
          </button>
        </div>
        <span className={`bnz-save-status bnz-save-${saveState}`}>
          {statusText[saveState]}
        </span>
        <button
          type="button"
          className="bnz-btn"
          onClick={onUse}
          disabled={!ready}
          title="Create a usage from this template"
        >
          Use
        </button>
        <button
          type="button"
          className="bnz-btn bnz-btn-primary"
          onClick={onSave}
          disabled={!ready || saveState === "saving" || readOnly}
        >
          Save
        </button>
      </div>
    </header>
  );
}
