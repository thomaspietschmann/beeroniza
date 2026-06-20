"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import {
  SCHEMA_VERSION,
  type ClipShape,
  type PlaceholderDef,
  type PlaceholderType,
  type TemplateDoc,
} from "@/lib/template/schema";
import {
  BNZ_PROPS,
  applyClipToImage,
  loadDocIntoCanvas,
} from "@/lib/template/fabric-render";
import { installAligningGuides } from "./aligningGuides";
import {
  type EditorObject,
  isImage,
  isText,
  nextLayerName,
  objectKind,
} from "./types";

const CANVAS_PADDING = 64; // px of breathing room around the canvas in the viewport

export interface FabricEditor {
  canvasElRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  ready: boolean;
  // The currently selected object (single selection only for the panel).
  selected: EditorObject | null;
  // A monotonically increasing token bumped on any object mutation so React
  // panels re-read fresh values from the (mutable) fabric objects.
  revision: number;
  // Ordered list of layers, top-most last in fabric / first in the UI list.
  layers: EditorObject[];
  zoom: number;
  canvasSize: { width: number; height: number };

  // Object operations
  addText: () => void;
  addRect: () => void;
  addCircle: () => void;
  addTriangle: () => void;
  addRoundedRect: () => void;
  addLine: () => void;
  addPolygon: () => void;
  addStar: () => void;
  // Align / distribute the current (multi-)selection. Align with a single
  // object selected snaps it to the canvas; with 2+ it aligns them to each
  // other. Distribute needs 3+ objects.
  alignObjects: (mode: AlignMode) => void;
  distributeObjects: (axis: "h" | "v") => void;
  addImageFromUrl: (url: string) => Promise<void>;
  setBackgroundImage: (url: string) => Promise<void>;
  deleteSelected: () => void;
  bringForward: (obj?: EditorObject) => void;
  sendBackwards: (obj?: EditorObject) => void;
  selectObject: (obj: EditorObject | null) => void;
  toggleVisibility: (obj: EditorObject) => void;
  setClip: (shape: ClipShape) => void;
  clearClip: () => void;
  updateSelectedProp: (
    partial: Record<string, unknown>,
    opts?: { silent?: boolean },
  ) => void;
  markPlaceholder: (key: string, type: PlaceholderType, label?: string) => void;
  clearPlaceholder: () => void;
  setCanvasSize: (width: number, height: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  serialize: () => TemplateDoc;
  // Undo / redo. `undo`/`redo` restore an earlier/later snapshot of the whole
  // document; the booleans drive button enabled-state.
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // True while a text object is in inline (on-canvas) edit mode — callers skip
  // global shortcuts so the text caret keeps its own behaviour.
  isEditingText: () => boolean;
}

// Cap the history so a long editing session can't grow memory unbounded.
const HISTORY_LIMIT = 50;
// Coalesce rapid bursts (e.g. typing into a text box) into a single entry.
const HISTORY_DEBOUNCE_MS = 350;

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 4;

export type AlignMode = "left" | "centerH" | "right" | "top" | "middle" | "bottom";

// Points (centered on origin) for a regular n-gon and an n-pointed star, used by
// the polygon / star tools.
function regularPolygonPoints(sides: number, r: number): { x: number; y: number }[] {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return pts;
}

function starPoints(spikes: number, outer: number, inner: number): { x: number; y: number }[] {
  const pts = [];
  const step = Math.PI / spikes;
  for (let i = 0; i < 2 * spikes; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + i * step;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return pts;
}

// Draw a small, unobtrusive corner chip (e.g. "img" / "txt") anchored to the
// top-left of a layer's bounding box, marking it as a dynamic placeholder. The
// chip is rendered in canvas/object space (the caller has already applied the
// viewport transform), so it scales with zoom and stays tight to the corner.
function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string,
  viewW: number,
  viewH: number,
): void {
  const padX = 5;
  const h = 16;
  const r = 3;
  ctx.save();
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(label).width + padX * 2;
  // Coordinates are screen-space (CSS px). Clamp into the visible canvas with a
  // small inset so the chip is always fully readable and never clings flush to
  // an edge (e.g. a full-canvas background's chip would otherwise sit in the
  // very corner, half-clipped).
  const inset = 3;
  const bx = Math.min(Math.max(x, inset), Math.max(inset, viewW - w - inset));
  const by = Math.min(Math.max(y, inset), Math.max(inset, viewH - h - inset));
  // Rounded-rect background.
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + w - r, by);
  ctx.arcTo(bx + w, by, bx + w, by + r, r);
  ctx.lineTo(bx + w, by + h - r);
  ctx.arcTo(bx + w, by + h, bx + w - r, by + h, r);
  ctx.lineTo(bx + r, by + h);
  ctx.arcTo(bx, by + h, bx, by + h - r, r);
  ctx.lineTo(bx, by + r);
  ctx.arcTo(bx, by, bx + r, by, r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#0b1020";
  ctx.fillText(label, bx + padX, by + h / 2 + 0.5);
  ctx.restore();
}

export function useFabricEditor(doc: TemplateDoc | null): FabricEditor {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);

  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<EditorObject | null>(null);
  const [revision, setRevision] = useState(0);
  const [layers, setLayers] = useState<EditorObject[]>([]);
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSizeState] = useState({ width: 1200, height: 630 });

  // ── Undo/redo history ──────────────────────────────────────────────────────
  // `stack[index]` is the current document; everything before is undo, after is
  // redo. Snapshots are full TemplateDocs (so all BNZ_* custom props round-trip
  // via serialize()'s canvas.toObject(BNZ_PROPS)).
  const historyRef = useRef<{ stack: TemplateDoc[]; index: number }>({
    stack: [],
    index: -1,
  });
  // True while a snapshot is being restored, so the mutations it triggers
  // (object:added/removed + bump) don't record new history entries.
  const isRestoringRef = useRef(false);
  // Only start recording once the initial document has loaded and the baseline
  // snapshot is seeded — otherwise the initial load's object:added events would
  // be captured as edits.
  const armedRef = useRef(false);
  const pendingCaptureRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest scheduleCapture, so the long-lived event handlers / bump can call the
  // current implementation without being re-bound.
  const scheduleCaptureRef = useRef<() => void>(() => {});
  // Bumped whenever the history pointer moves, so consumers re-read canUndo/canRedo.
  const [historyVersion, setHistoryVersion] = useState(0);

  const bump = useCallback(() => {
    setRevision((r) => r + 1);
    if (armedRef.current && !isRestoringRef.current) scheduleCaptureRef.current();
  }, []);

  const refreshLayers = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // UI shows top-most layer first; fabric stores bottom-most first.
    setLayers([...canvas.getObjects()].reverse() as EditorObject[]);
  }, []);

  // Fit-to-screen zoom so the whole canvas is visible inside the container.
  const fitToScreen = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    // Intrinsic (unzoomed) canvas dimensions. getWidth()/getHeight() return the
    // current *displayed* size, so divide out the current zoom to recover them.
    const prevZoom = canvas.getZoom() || 1;
    const w = canvas.getWidth() / prevZoom;
    const h = canvas.getHeight() / prevZoom;
    const availW = container.clientWidth - CANVAS_PADDING * 2;
    const availH = container.clientHeight - CANVAS_PADDING * 2;
    if (availW <= 0 || availH <= 0) return;
    const z = Math.min(availW / w, availH / h, 1);
    canvas.setZoom(z);
    canvas.setDimensions({ width: w * z, height: h * z });
    canvas.requestRenderAll();
    setZoom(z);
  }, []);

  // ── Initialise the fabric canvas once we have a doc and a <canvas> ref. ──
  useEffect(() => {
    if (!doc || !canvasElRef.current || canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      preserveObjectStacking: true,
      backgroundColor: doc.canvas.backgroundColor ?? "#ffffff",
      controlsAboveOverlay: true,
    });
    canvasRef.current = canvas;
    // Test seam: expose the live canvas so e2e tests can drive/assert geometry
    // (e.g. verify multi-select alignment). Harmless in production.
    (window as unknown as { __bnzCanvas?: fabric.Canvas }).__bnzCanvas = canvas;
    setCanvasSizeState({ width: doc.canvas.width, height: doc.canvas.height });

    const uninstallGuides = installAligningGuides(canvas);

    // Editor-only decoration: mark dynamic (fillable) placeholders so it's
    // obvious which layers get filled at render time. Drawn in the after:render
    // pass on the canvas context, so it never serializes and never affects the
    // rendered output.
    //
    // To avoid confusing "guide lines" across the whole artwork (e.g. a
    // full-canvas background-image placeholder used to get a giant dashed frame
    // spanning the entire canvas), the indication is intentionally minimal:
    //   • Every dynamic layer gets a small, unobtrusive corner chip ("img" /
    //     "txt") pinned to its top-left — it never covers the artwork.
    //   • A dashed outline is drawn ONLY for the currently selected layer, and
    //     even then it's suppressed for layers that effectively cover the whole
    //     canvas (backgrounds), where an outline would just trace the edges.
    const IMG_COLOR = "#00d6a4";
    const TXT_COLOR = "#8a7bff";
    const onAfterRender = () => {
      const ctx = canvas.getContext();
      if (!ctx) return;
      const vt = canvas.viewportTransform;
      if (!vt) return;
      // Fabric renders the artwork with `retina × viewportTransform`. The
      // decorations must use the SAME scaling or they'd be mis-placed/sized on
      // HiDPI displays (retina > 1).
      const retina = canvas.getRetinaScaling?.() ?? 1;
      const zoom = canvas.getZoom() || 1;
      // Intrinsic (unzoomed) canvas dimensions, used to detect full-canvas
      // layers that we should NOT outline.
      const canvasW = canvas.getWidth() / zoom;
      const canvasH = canvas.getHeight() / zoom;
      // On-screen (CSS px) size of the visible canvas, used to position the
      // constant-size chips and clamp them inside the viewport.
      const viewW = canvas.getWidth();
      const viewH = canvas.getHeight();
      const active = canvas.getActiveObject() as EditorObject | null;
      for (const o of canvas.getObjects() as EditorObject[]) {
        if (o.visible === false) continue;
        const ph = o.bnzPlaceholder;
        const isImgPh = ph?.kind === "image";
        const isTextPh = ph?.kind === "text";
        if (!isImgPh && !isTextPh) continue;
        const color = isImgPh ? IMG_COLOR : TXT_COLOR;
        const b = o.getBoundingRect();

        // A layer counts as "full-canvas" when its bounding box covers (almost)
        // the entire canvas — outlining it would just paint lines along the
        // edges and across the background, which is exactly the noise we avoid.
        const coversCanvas =
          b.width >= canvasW * 0.92 && b.height >= canvasH * 0.92;

        // Dashed outline only for the selected, non-full-canvas layer. Drawn in
        // object space (retina-aware) so it traces the layer exactly.
        if (active === o && !coversCanvas) {
          ctx.save();
          ctx.setTransform(
            retina * vt[0], retina * vt[1], retina * vt[2],
            retina * vt[3], retina * vt[4], retina * vt[5],
          );
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 1.5 / zoom;
          ctx.strokeStyle = color;
          ctx.strokeRect(b.left + 0.5, b.top + 0.5, b.width - 1, b.height - 1);
          ctx.restore();
        }

        // Small label chip pinned to the layer's top-left so dynamic layers
        // stay identifiable at a glance without covering the artwork. Drawn at a
        // CONSTANT screen size (independent of zoom) so the "img"/"txt" label is
        // always legible — hence screen-space coords + a retina-only transform.
        const sx = vt[0] * b.left + vt[2] * b.top + vt[4];
        const sy = vt[1] * b.left + vt[3] * b.top + vt[5];
        ctx.save();
        ctx.setTransform(retina, 0, 0, retina, 0, 0);
        drawChip(ctx, sx, sy, isImgPh ? "img" : "txt", color, viewW, viewH);
        ctx.restore();
      }
    };
    canvas.on("after:render", onAfterRender);

    const onSelection = () => {
      const active = canvas.getActiveObject();
      // A multi-selection (ActiveSelection) is treated as "no single object".
      if (active && objectKind(active) === "other" && "_objects" in active) {
        setSelected(null);
      } else {
        setSelected((active as EditorObject) ?? null);
      }
    };
    const onCleared = () => setSelected(null);
    const onModified = () => bump();

    canvas.on("selection:created", onSelection);
    canvas.on("selection:updated", onSelection);
    canvas.on("selection:cleared", onCleared);
    canvas.on("object:modified", onModified);
    canvas.on("object:added", refreshLayers);
    canvas.on("object:removed", refreshLayers);

    let cancelled = false;
    (async () => {
      await loadDocIntoCanvas(canvas, doc);
      if (cancelled) return;
      refreshLayers();
      fitToScreen();
      setReady(true);
      // Seed the history baseline, then arm capture so later mutations record.
      historyRef.current = { stack: [serialize()], index: 0 };
      armedRef.current = true;
      setHistoryVersion((v) => v + 1);
    })();

    return () => {
      cancelled = true;
      armedRef.current = false;
      if (pendingCaptureRef.current) {
        clearTimeout(pendingCaptureRef.current);
        pendingCaptureRef.current = null;
      }
      historyRef.current = { stack: [], index: -1 };
      uninstallGuides();
      canvas.off("after:render", onAfterRender);
      canvas.off("selection:created", onSelection);
      canvas.off("selection:updated", onSelection);
      canvas.off("selection:cleared", onCleared);
      canvas.off("object:modified", onModified);
      canvas.off("object:added", refreshLayers);
      canvas.off("object:removed", refreshLayers);
      canvas.dispose();
      canvasRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // Refit when the container resizes.
  useEffect(() => {
    if (!ready) return;
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => fitToScreen());
    ro.observe(container);
    return () => ro.disconnect();
  }, [ready, fitToScreen]);

  // Keyboard: delete / backspace removes the selection (unless editing text).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject() as
        | (fabric.FabricObject & { isEditing?: boolean })
        | null;
      if (active && (active as { isEditing?: boolean }).isEditing) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (active) {
          e.preventDefault();
          deleteSelectedInternal();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const addAndSelect = useCallback(
    (obj: fabric.FabricObject) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.add(obj);
      canvas.setActiveObject(obj);
      setSelected(obj as EditorObject);
      canvas.requestRenderAll();
      refreshLayers();
      bump();
    },
    [bump, refreshLayers],
  );

  const centerPos = useCallback(() => {
    const canvas = canvasRef.current;
    return {
      left: (canvas?.getWidth() ?? 0) / (2 * (canvas?.getZoom() ?? 1)),
      top: (canvas?.getHeight() ?? 0) / (2 * (canvas?.getZoom() ?? 1)),
    };
  }, []);

  // ── Object operations ──────────────────────────────────────────────────────
  const addText = useCallback(() => {
    const { left, top } = centerPos();
    const text = new fabric.Textbox("Your text", {
      left,
      top,
      width: 480,
      fontSize: 64,
      fontFamily: "Inter",
      fill: "#111111",
      originX: "center",
      originY: "center",
      textAlign: "left",
    }) as EditorObject;
    text.bnzName = nextLayerName("text");
    addAndSelect(text);
  }, [addAndSelect, centerPos]);

  const addRect = useCallback(() => {
    const { left, top } = centerPos();
    const rect = new fabric.Rect({
      left,
      top,
      width: 320,
      height: 200,
      fill: "#6c5ce7",
      originX: "center",
      originY: "center",
    }) as EditorObject;
    rect.bnzName = nextLayerName("rect");
    addAndSelect(rect);
  }, [addAndSelect, centerPos]);

  const addCircle = useCallback(() => {
    const { left, top } = centerPos();
    const circle = new fabric.Circle({
      left,
      top,
      radius: 120,
      fill: "#00b894",
      originX: "center",
      originY: "center",
    }) as EditorObject;
    circle.bnzName = nextLayerName("circle");
    addAndSelect(circle);
  }, [addAndSelect, centerPos]);

  const addTriangle = useCallback(() => {
    const { left, top } = centerPos();
    const tri = new fabric.Triangle({
      left,
      top,
      width: 240,
      height: 210,
      fill: "#fdcb6e",
      originX: "center",
      originY: "center",
    }) as EditorObject;
    tri.bnzName = nextLayerName("triangle");
    addAndSelect(tri);
  }, [addAndSelect, centerPos]);

  const addRoundedRect = useCallback(() => {
    const { left, top } = centerPos();
    const rect = new fabric.Rect({
      left,
      top,
      width: 320,
      height: 200,
      rx: 32,
      ry: 32,
      fill: "#6c5ce7",
      originX: "center",
      originY: "center",
    }) as EditorObject;
    rect.bnzName = nextLayerName("rounded");
    addAndSelect(rect);
  }, [addAndSelect, centerPos]);

  const addLine = useCallback(() => {
    const { left, top } = centerPos();
    const line = new fabric.Line([left - 180, top, left + 180, top], {
      stroke: "#ffffff",
      strokeWidth: 6,
    }) as EditorObject;
    line.bnzName = nextLayerName("line");
    addAndSelect(line);
  }, [addAndSelect, centerPos]);

  const addPolygon = useCallback(() => {
    const { left, top } = centerPos();
    const poly = new fabric.Polygon(regularPolygonPoints(6, 140), {
      left,
      top,
      fill: "#0984e3",
      originX: "center",
      originY: "center",
    }) as EditorObject;
    poly.bnzName = nextLayerName("polygon");
    addAndSelect(poly);
  }, [addAndSelect, centerPos]);

  const addStar = useCallback(() => {
    const { left, top } = centerPos();
    const star = new fabric.Polygon(starPoints(5, 150, 62), {
      left,
      top,
      fill: "#e84393",
      originX: "center",
      originY: "center",
    }) as EditorObject;
    star.bnzName = nextLayerName("star");
    addAndSelect(star);
  }, [addAndSelect, centerPos]);

  // Collect the objects to operate on: the members of a multi-selection, or the
  // single active object. Returns them with the active selection discarded so
  // their coordinates are absolute (canvas) space.
  const takeSelection = useCallback((): EditorObject[] => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    const active = canvas.getActiveObject() as fabric.FabricObject | null;
    if (!active) return [];
    const objs =
      active.type === "activeselection"
        ? [...(active as fabric.ActiveSelection).getObjects()]
        : [active];
    canvas.discardActiveObject();
    return objs as EditorObject[];
  }, []);

  const reselect = useCallback((objs: EditorObject[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (objs.length > 1) {
      const sel = new fabric.ActiveSelection(objs, { canvas });
      canvas.setActiveObject(sel);
    } else if (objs.length === 1) {
      canvas.setActiveObject(objs[0]);
    }
    canvas.requestRenderAll();
    refreshLayers();
    bump();
  }, [bump, refreshLayers]);

  const alignObjects = useCallback(
    (mode: AlignMode) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const objs = takeSelection();
      if (objs.length === 0) return;

      const rects = objs.map((o) => ({ o, r: o.getBoundingRect() }));
      // 2+ objects align to each other; a single object aligns to the canvas.
      let minL: number, maxR: number, minT: number, maxB: number;
      if (objs.length > 1) {
        minL = Math.min(...rects.map((x) => x.r.left));
        maxR = Math.max(...rects.map((x) => x.r.left + x.r.width));
        minT = Math.min(...rects.map((x) => x.r.top));
        maxB = Math.max(...rects.map((x) => x.r.top + x.r.height));
      } else {
        minL = 0;
        maxR = canvas.getWidth() / canvas.getZoom();
        minT = 0;
        maxB = canvas.getHeight() / canvas.getZoom();
      }

      for (const { o, r } of rects) {
        let dx = 0;
        let dy = 0;
        if (mode === "left") dx = minL - r.left;
        else if (mode === "right") dx = maxR - (r.left + r.width);
        else if (mode === "centerH") dx = (minL + maxR) / 2 - (r.left + r.width / 2);
        else if (mode === "top") dy = minT - r.top;
        else if (mode === "bottom") dy = maxB - (r.top + r.height);
        else if (mode === "middle") dy = (minT + maxB) / 2 - (r.top + r.height / 2);
        o.set({ left: (o.left ?? 0) + dx, top: (o.top ?? 0) + dy });
        o.setCoords();
      }
      reselect(objs);
    },
    [reselect, takeSelection],
  );

  const distributeObjects = useCallback(
    (axis: "h" | "v") => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const objs = takeSelection();
      if (objs.length < 3) {
        reselect(objs);
        return;
      }
      // Distribute centers evenly between the first and last object.
      const rects = objs
        .map((o) => ({ o, r: o.getBoundingRect() }))
        .map((x) => ({ ...x, center: axis === "h" ? x.r.left + x.r.width / 2 : x.r.top + x.r.height / 2 }))
        .sort((a, b) => a.center - b.center);
      const first = rects[0].center;
      const last = rects[rects.length - 1].center;
      const stepGap = (last - first) / (rects.length - 1);
      rects.forEach((x, i) => {
        const target = first + i * stepGap;
        const delta = target - x.center;
        if (axis === "h") x.o.set({ left: (x.o.left ?? 0) + delta });
        else x.o.set({ top: (x.o.top ?? 0) + delta });
        x.o.setCoords();
      });
      reselect(objs);
    },
    [reselect, takeSelection],
  );

  const addImageFromUrl = useCallback(
    async (url: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const img = (await fabric.FabricImage.fromURL(url, {
        crossOrigin: "anonymous",
      })) as fabric.FabricImage;
      const { left, top } = centerPos();
      // Scale the image to comfortably fit within the canvas.
      const maxW = canvas.getWidth() / canvas.getZoom() * 0.6;
      const maxH = canvas.getHeight() / canvas.getZoom() * 0.6;
      const natW = img.width ?? 1;
      const natH = img.height ?? 1;
      const scale = Math.min(maxW / natW, maxH / natH, 1);
      img.set({ left, top, originX: "center", originY: "center", scaleX: scale, scaleY: scale });
      (img as EditorObject).bnzName = nextLayerName("image");
      addAndSelect(img);
    },
    [addAndSelect, centerPos],
  );

  const setBackgroundImage = useCallback(async (url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = (await fabric.FabricImage.fromURL(url, {
      crossOrigin: "anonymous",
    })) as fabric.FabricImage;
    const cw = canvas.getWidth() / canvas.getZoom();
    const ch = canvas.getHeight() / canvas.getZoom();
    // Cover the canvas initially, but add it as a REAL, movable & scalable layer
    // pinned to the back — so it can be repositioned/scaled to fill the canvas
    // nicely, with all placeholders staying in front of it.
    const scale = Math.max(cw / (img.width ?? 1), ch / (img.height ?? 1));
    img.set({
      left: cw / 2,
      top: ch / 2,
      originX: "center",
      originY: "center",
      scaleX: scale,
      scaleY: scale,
    });
    (img as EditorObject).bnzName = nextLayerName("background");
    canvas.add(img);
    canvas.sendObjectToBack(img);
    canvas.setActiveObject(img);
    setSelected(img as EditorObject);
    canvas.requestRenderAll();
    refreshLayers();
    bump();
  }, [bump, refreshLayers]);

  function deleteSelectedInternal() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const actives = canvas.getActiveObjects();
    if (actives.length === 0) return;
    actives.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setSelected(null);
    refreshLayers();
    bump();
  }
  const deleteSelected = useCallback(deleteSelectedInternal, [bump, refreshLayers]);

  const bringForward = useCallback(
    (obj?: EditorObject) => {
      const canvas = canvasRef.current;
      const target = obj ?? (canvas?.getActiveObject() as EditorObject | undefined);
      if (!canvas || !target) return;
      canvas.bringObjectForward(target);
      canvas.requestRenderAll();
      refreshLayers();
      bump();
    },
    [bump, refreshLayers],
  );

  const sendBackwards = useCallback(
    (obj?: EditorObject) => {
      const canvas = canvasRef.current;
      const target = obj ?? (canvas?.getActiveObject() as EditorObject | undefined);
      if (!canvas || !target) return;
      canvas.sendObjectBackwards(target);
      canvas.requestRenderAll();
      refreshLayers();
      bump();
    },
    [bump, refreshLayers],
  );

  const selectObject = useCallback((obj: EditorObject | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (obj) {
      canvas.setActiveObject(obj);
      setSelected(obj);
    } else {
      canvas.discardActiveObject();
      setSelected(null);
    }
    canvas.requestRenderAll();
  }, []);

  const toggleVisibility = useCallback(
    (obj: EditorObject) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      obj.visible = !obj.visible;
      canvas.requestRenderAll();
      refreshLayers();
      bump();
    },
    [bump, refreshLayers],
  );

  const setClip = useCallback(
    (shape: ClipShape) => {
      const canvas = canvasRef.current;
      const obj = canvas?.getActiveObject() as EditorObject | undefined;
      if (!canvas || !obj || !isImage(obj)) return;
      const img = obj as EditorObject & fabric.FabricImage;
      applyClipToImage(img, shape);
      img.bnzClip = shape;
      canvas.requestRenderAll();
      bump();
    },
    [bump],
  );

  const clearClip = useCallback(() => {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject() as EditorObject | undefined;
    if (!canvas || !obj || !isImage(obj)) return;
    const img = obj as EditorObject & fabric.FabricImage;
    img.clipPath = undefined;
    delete img.bnzClip;
    canvas.requestRenderAll();
    bump();
  }, [bump]);

  const updateSelectedProp = useCallback(
    (partial: Record<string, unknown>, opts?: { silent?: boolean }) => {
      const canvas = canvasRef.current;
      const obj = canvas?.getActiveObject() as EditorObject | undefined;
      if (!canvas || !obj) return;
      obj.set(partial);
      obj.setCoords();
      // If an image with a clip shape is resized, re-apply the clip.
      const img = obj as EditorObject & fabric.FabricImage;
      if (isImage(obj) && img.bnzClip && ("scaleX" in partial || "scaleY" in partial || "width" in partial || "height" in partial)) {
        applyClipToImage(img, img.bnzClip);
      }
      canvas.requestRenderAll();
      // @font-face fonts are loaded lazily — trigger a download now so the next
      // render uses the real font file rather than the system fallback.
      if ("fontFamily" in partial && typeof partial.fontFamily === "string") {
        const fam = partial.fontFamily;
        document.fonts.load(`400 12px "${fam}"`).then(() => {
          canvas.requestRenderAll();
        }).catch(() => { /* font unavailable; canvas already rendered */ });
      }
      // `silent` renders the canvas live but skips the React bump, so text
      // inputs keep focus while typing (the panel doesn't remount). We still
      // schedule a (debounced) history capture so typed text is undoable —
      // without the bump it won't remount the panel and steal focus.
      if (!opts?.silent) {
        refreshLayers();
        bump();
      } else if (armedRef.current && !isRestoringRef.current) {
        scheduleCaptureRef.current();
      }
    },
    [bump, refreshLayers],
  );

  const markPlaceholder = useCallback(
    (key: string, type: PlaceholderType, label?: string) => {
      const canvas = canvasRef.current;
      const obj = canvas?.getActiveObject() as EditorObject | undefined;
      if (!canvas || !obj) return;
      obj.bnzName = key;
      obj.bnzPlaceholder = { kind: type, ...(label ? { label } : {}) };
      // For fillable text, default to shrink-to-fit within the box the designer
      // drew, so over-long API values don't blow out the layout.
      if (type === "text" && isText(obj)) {
        const eo = obj as EditorObject;
        if (!eo.bnzFit) eo.bnzFit = "shrink";
        if (!eo.bnzMaxHeight) eo.bnzMaxHeight = Math.round(obj.height ?? 0);
      }
      canvas.requestRenderAll();
      refreshLayers();
      bump();
    },
    [bump, refreshLayers],
  );

  const clearPlaceholder = useCallback(() => {
    const canvas = canvasRef.current;
    const obj = canvas?.getActiveObject() as EditorObject | undefined;
    if (!canvas || !obj) return;
    delete obj.bnzPlaceholder;
    canvas.requestRenderAll();
    refreshLayers();
    bump();
  }, [bump, refreshLayers]);

  const setCanvasSize = useCallback(
    (width: number, height: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Reset to intrinsic 1:1 first so fitToScreen recovers the correct
      // intrinsic dimensions, then it re-applies the fit zoom.
      canvas.setZoom(1);
      canvas.setDimensions({ width, height });
      setCanvasSizeState({ width, height });
      fitToScreen();
      bump();
    },
    [bump, fitToScreen],
  );

  // Manual zoom around the canvas centre. Keeps the displayed dimensions in
  // sync with the intrinsic size * zoom (same invariant fitToScreen maintains).
  const applyZoom = useCallback((next: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prev = canvas.getZoom() || 1;
    const w = canvas.getWidth() / prev;
    const h = canvas.getHeight() / prev;
    const z = Math.min(Math.max(next, ZOOM_MIN), ZOOM_MAX);
    canvas.setZoom(z);
    canvas.setDimensions({ width: w * z, height: h * z });
    canvas.requestRenderAll();
    setZoom(z);
  }, []);

  const zoomIn = useCallback(() => {
    applyZoom((canvasRef.current?.getZoom() ?? 1) * 1.15);
  }, [applyZoom]);

  const zoomOut = useCallback(() => {
    applyZoom((canvasRef.current?.getZoom() ?? 1) / 1.15);
  }, [applyZoom]);

  const zoomToFit = useCallback(() => {
    fitToScreen();
  }, [fitToScreen]);

  const serialize = useCallback((): TemplateDoc => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return {
        schemaVersion: SCHEMA_VERSION,
        canvas: { width: canvasSize.width, height: canvasSize.height },
        fabric: {},
        placeholders: [],
      };
    }
    // Temporarily reset the viewport so geometry serializes in intrinsic
    // (unzoomed) canvas coordinates.
    // toObject(propertiesToInclude) is the v7 way to include our custom props;
    // toJSON() takes no args. The result is the same canvas serialization that
    // loadDocIntoCanvas / loadFromJSON consumes.
    const fabricJson = canvas.toObject(BNZ_PROPS as unknown as string[]) as Record<string, unknown>;

    const placeholders: PlaceholderDef[] = [];
    const seen = new Set<string>();
    for (const o of canvas.getObjects() as EditorObject[]) {
      if (o.bnzPlaceholder && o.bnzName && !seen.has(o.bnzName)) {
        seen.add(o.bnzName);
        placeholders.push({
          key: o.bnzName,
          type: o.bnzPlaceholder.kind,
          ...(o.bnzPlaceholder.label ? { label: o.bnzPlaceholder.label } : {}),
        });
      }
    }

    const bg = canvas.backgroundColor;
    return {
      schemaVersion: SCHEMA_VERSION,
      canvas: {
        width: canvas.getWidth() / canvas.getZoom(),
        height: canvas.getHeight() / canvas.getZoom(),
        ...(typeof bg === "string" && bg ? { backgroundColor: bg } : {}),
      },
      fabric: fabricJson,
      placeholders,
    };
  }, [canvasSize.width, canvasSize.height]);

  // ── History capture / restore ───────────────────────────────────────────────
  // Record the current document, dropping any redo tail and trimming to the cap.
  const captureNow = useCallback(() => {
    if (isRestoringRef.current || !canvasRef.current) return;
    const snap = serialize();
    const h = historyRef.current;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(snap);
    if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
    h.index = h.stack.length - 1;
    setHistoryVersion((v) => v + 1);
  }, [serialize]);

  // Debounced capture so a burst of mutations (e.g. typing) collapses into one
  // undo step.
  const scheduleCapture = useCallback(() => {
    if (pendingCaptureRef.current) clearTimeout(pendingCaptureRef.current);
    pendingCaptureRef.current = setTimeout(() => {
      pendingCaptureRef.current = null;
      captureNow();
    }, HISTORY_DEBOUNCE_MS);
  }, [captureNow]);

  // Commit a pending debounced capture immediately (used before undo/redo so the
  // in-flight edit becomes its own history entry first).
  const flushCapture = useCallback(() => {
    if (!pendingCaptureRef.current) return;
    clearTimeout(pendingCaptureRef.current);
    pendingCaptureRef.current = null;
    captureNow();
  }, [captureNow]);

  // Keep the ref bump()/the silent text path call in sync with the latest impl.
  useEffect(() => {
    scheduleCaptureRef.current = scheduleCapture;
  }, [scheduleCapture]);

  const restore = useCallback(
    async (snap: TemplateDoc) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      isRestoringRef.current = true;
      try {
        canvas.discardActiveObject();
        await loadDocIntoCanvas(canvas, snap);
        // loadDocIntoCanvas sets the display size to the intrinsic dimensions but
        // leaves the old zoom value; reset to 1 so fitToScreen recovers the right
        // fit (mirrors setCanvasSize).
        canvas.setZoom(1);
        setCanvasSizeState({ width: snap.canvas.width, height: snap.canvas.height });
        fitToScreen();
        refreshLayers();
        setSelected(null);
        setRevision((r) => r + 1);
      } finally {
        isRestoringRef.current = false;
      }
    },
    [fitToScreen, refreshLayers],
  );

  const undo = useCallback(() => {
    flushCapture();
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    setHistoryVersion((v) => v + 1);
    void restore(h.stack[h.index]);
  }, [flushCapture, restore]);

  const redo = useCallback(() => {
    flushCapture();
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    setHistoryVersion((v) => v + 1);
    void restore(h.stack[h.index]);
  }, [flushCapture, restore]);

  // historyVersion is read so canUndo/canRedo recompute on pointer moves.
  void historyVersion;
  const canUndo = historyRef.current.index > 0;
  const canRedo =
    historyRef.current.index < historyRef.current.stack.length - 1;

  const isEditingText = useCallback(() => {
    const active = canvasRef.current?.getActiveObject() as
      | (fabric.FabricObject & { isEditing?: boolean })
      | undefined;
    return Boolean(active?.isEditing);
  }, []);

  return {
    canvasElRef,
    containerRef,
    ready,
    selected,
    revision,
    layers,
    zoom,
    canvasSize,
    addText,
    addRect,
    addCircle,
    addTriangle,
    addRoundedRect,
    addLine,
    addPolygon,
    addStar,
    alignObjects,
    distributeObjects,
    addImageFromUrl,
    setBackgroundImage,
    deleteSelected,
    bringForward,
    sendBackwards,
    selectObject,
    toggleVisibility,
    setClip,
    clearClip,
    updateSelectedProp,
    markPlaceholder,
    clearPlaceholder,
    setCanvasSize,
    zoomIn,
    zoomOut,
    zoomToFit,
    serialize,
    undo,
    redo,
    canUndo,
    canRedo,
    isEditingText,
  };
}
