"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { uploadWithDetection } from "@/lib/face/detect-client";
import { formatBytes, type MediaFile } from "@/lib/media/client";
import { apiFetch, apiMutate } from "@/lib/api-client";
import styles from "./media.module.scss";

interface Props {
  // Select mode shows a check affordance and calls onSelect when a tile is
  // chosen (used inside the media picker modal).
  selectMode?: boolean;
  selectedId?: string | null;
  onSelect?: (file: MediaFile) => void;
}

const SEARCH_DEBOUNCE = 300;

export function MediaLibrary({ selectMode = false, selectedId = null, onSelect }: Props) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against out-of-order responses: a slow earlier query resolving after
  // a newer one must not overwrite the newer results.
  const loadToken = useRef(0);

  const load = useCallback(async (query: string) => {
    const token = ++loadToken.current;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ files: MediaFile[] }>(
        `/api/uploads?q=${encodeURIComponent(query)}`,
        { fallbackError: "Failed to load media." },
      );
      if (token !== loadToken.current) return;
      setFiles(data.files);
    } catch (err) {
      if (token !== loadToken.current) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (token === loadToken.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(q), SEARCH_DEBOUNCE);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [q, load]);

  const handleFiles = useCallback(
    async (list: FileList | File[]) => {
      const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      setError(null);
      setUploading((n) => n + images.length);
      for (const file of images) {
        try {
          await uploadWithDetection(file);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed.");
        } finally {
          setUploading((n) => n - 1);
        }
      }
      await load(q);
    },
    [load, q],
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  async function rename(file: MediaFile) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === file.originalName) return;
    try {
      await apiMutate(`/api/files/${file.id}`, "PATCH", { originalName: name }, "Rename failed.");
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, originalName: name } : f)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed.");
    }
  }

  async function remove(file: MediaFile) {
    if (!window.confirm(`Delete “${file.originalName || "image"}”? This cannot be undone.`)) return;
    try {
      let res = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      if (res.status === 409) {
        const data = (await res.json()) as { references?: { name: string }[] };
        const names = (data.references ?? []).map((r) => r.name).join(", ");
        const ok = window.confirm(
          `This image is still used by: ${names}.\nDelete anyway and remove it from those usages?`,
        );
        if (!ok) return;
        res = await fetch(`/api/files/${file.id}?force=1`, { method: "DELETE" });
      }
      if (!res.ok) throw new Error("Delete failed.");
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Form.Control
          className={styles.search}
          placeholder="Search media…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search media"
        />
        <div className="flex-grow-1" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
          Upload images
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div
        className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""} p-2`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {uploading > 0 && (
          <div className="d-flex align-items-center gap-2 text-secondary small mb-2">
            <Spinner size="sm" animation="border" /> Uploading {uploading}…
          </div>
        )}

        {loading ? (
          <div className="d-flex align-items-center gap-2 text-secondary py-4">
            <Spinner size="sm" animation="border" /> Loading media…
          </div>
        ) : files.length === 0 ? (
          <div className={styles.empty}>
            <p className="h6 mb-1">No images yet</p>
            <p className="small mb-0">
              Drag &amp; drop images here, or use <strong>Upload images</strong>.
            </p>
          </div>
        ) : (
          <div className={styles.grid}>
            {files.map((f) => {
              const selected = selectMode && selectedId === f.id;
              return (
                <div
                  key={f.id}
                  className={`${styles.tile} ${selected ? styles.tileSelected : ""}`}
                  data-testid="media-tile"
                >
                  <div
                    className={styles.thumbWrap}
                    role={selectMode ? "button" : undefined}
                    onClick={selectMode ? () => onSelect?.(f) : undefined}
                    title={selectMode ? "Select this image" : f.originalName ?? ""}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.originalName ?? ""} className={styles.thumb} />
                    {f.hasFace && <span className={styles.faceBadge}>😊 face</span>}
                    {selected && <span className={styles.checkMark}>✓</span>}
                  </div>
                  <div className={styles.meta}>
                    {renamingId === f.id ? (
                      <Form.Control
                        size="sm"
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => rename(f)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") rename(f);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                      />
                    ) : (
                      <>
                        <div className={styles.name}>{f.originalName || "Untitled"}</div>
                        <div className={styles.sub}>{formatBytes(f.byteSize)}</div>
                      </>
                    )}
                  </div>
                  <div className={styles.actions}>
                    {selectMode && (
                      <Button size="sm" variant="primary" className="flex-grow-1" onClick={() => onSelect?.(f)}>
                        Select
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => {
                        setRenamingId(f.id);
                        setRenameValue(f.originalName ?? "");
                      }}
                      aria-label="Rename"
                    >
                      ✎
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => remove(f)}
                      aria-label="Delete"
                    >
                      🗑
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
