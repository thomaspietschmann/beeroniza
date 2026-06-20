import * as fabric from "fabric";

// Smart alignment guides + snapping.
//
// Implementation notes (this replaces an earlier top-context version that left
// trails and didn't actually snap):
//   - We work entirely in ABSOLUTE canvas coordinates via object.getCoords(),
//     so it's correct regardless of zoom / viewport transform.
//   - Guide lines are real (non-interactive, non-exported) fabric.Line objects
//     added to the canvas, so fabric clears & redraws them every frame — no
//     smearing. They're recreated on each move and removed on release.
//   - Snapping nudges the moving object's left/top by the matched delta (a rigid
//     translation, so it works for any origin), then we draw only the matched
//     guide line(s).

const SNAP = 8; // snap threshold in canvas pixels
const COLOR = "#8a7bff";
const GUIDE_FLAG = "__bnzGuide";

type AnyCanvas = fabric.Canvas;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
}

function boxOf(obj: fabric.FabricObject): Box {
  const pts = obj.getCoords(); // absolute canvas-space corners
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { left, right, top, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 };
}

export function isGuide(obj: fabric.FabricObject): boolean {
  return Boolean((obj as { [GUIDE_FLAG]?: boolean })[GUIDE_FLAG]);
}

export function installAligningGuides(canvas: AnyCanvas): () => void {
  let guides: fabric.Line[] = [];

  function clearGuides() {
    if (!guides.length) return;
    for (const g of guides) canvas.remove(g);
    guides = [];
  }

  function addGuide(coords: [number, number, number, number]) {
    const line = new fabric.Line(coords, {
      stroke: COLOR,
      strokeWidth: 1,
      strokeUniform: true,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
      hoverCursor: "default",
    });
    (line as { [GUIDE_FLAG]?: boolean })[GUIDE_FLAG] = true;
    guides.push(line);
    canvas.add(line);
  }

  const onMoving = (e: { target?: fabric.FabricObject }) => {
    const target = e.target;
    if (!target) return;
    clearGuides();

    const W = canvas.getWidth();
    const H = canvas.getHeight();
    const tb = boxOf(target);

    // When dragging a multi-selection, its own member objects are still in
    // canvas.getObjects() — exclude them so the group doesn't snap to itself.
    const ownMembers =
      target.type === "activeselection" && "getObjects" in target
        ? new Set((target as fabric.ActiveSelection).getObjects())
        : null;

    // Vertical snap candidates: { x, [y1, y2] for the drawn span }.
    const vCands: { x: number; y1: number; y2: number }[] = [
      { x: 0, y1: 0, y2: H },
      { x: W / 2, y1: 0, y2: H },
      { x: W, y1: 0, y2: H },
    ];
    const hCands: { y: number; x1: number; x2: number }[] = [
      { y: 0, x1: 0, x2: W },
      { y: H / 2, x1: 0, x2: W },
      { y: H, x1: 0, x2: W },
    ];
    for (const o of canvas.getObjects()) {
      if (o === target || isGuide(o) || o.visible === false) continue;
      if (ownMembers?.has(o)) continue;
      const b = boxOf(o);
      vCands.push(
        { x: b.left, y1: b.top, y2: b.bottom },
        { x: b.cx, y1: b.top, y2: b.bottom },
        { x: b.right, y1: b.top, y2: b.bottom },
      );
      hCands.push(
        { y: b.top, x1: b.left, x2: b.right },
        { y: b.cy, x1: b.left, x2: b.right },
        { y: b.bottom, x1: b.left, x2: b.right },
      );
    }

    // Best vertical match across the target's left / center / right edges.
    const vEdges = [tb.left, tb.cx, tb.right];
    let bestV: { delta: number; cand: (typeof vCands)[number] } | null = null;
    for (const edge of vEdges) {
      for (const cand of vCands) {
        const delta = cand.x - edge;
        if (Math.abs(delta) <= SNAP && (!bestV || Math.abs(delta) < Math.abs(bestV.delta))) {
          bestV = { delta, cand };
        }
      }
    }

    const hEdges = [tb.top, tb.cy, tb.bottom];
    let bestH: { delta: number; cand: (typeof hCands)[number] } | null = null;
    for (const edge of hEdges) {
      for (const cand of hCands) {
        const delta = cand.y - edge;
        if (Math.abs(delta) <= SNAP && (!bestH || Math.abs(delta) < Math.abs(bestH.delta))) {
          bestH = { delta, cand };
        }
      }
    }

    if (bestV) {
      target.left = (target.left ?? 0) + bestV.delta;
    }
    if (bestH) {
      target.top = (target.top ?? 0) + bestH.delta;
    }
    if (bestV || bestH) target.setCoords();

    // Draw guides using the post-snap bounds so the line spans both objects.
    const nb = boxOf(target);
    if (bestV) {
      addGuide([
        bestV.cand.x,
        Math.min(bestV.cand.y1, nb.top),
        bestV.cand.x,
        Math.max(bestV.cand.y2, nb.bottom),
      ]);
    }
    if (bestH) {
      addGuide([
        Math.min(bestH.cand.x1, nb.left),
        bestH.cand.y,
        Math.max(bestH.cand.x2, nb.right),
        bestH.cand.y,
      ]);
    }
  };

  const onDone = () => {
    clearGuides();
    canvas.requestRenderAll();
  };

  canvas.on("object:moving", onMoving);
  canvas.on("mouse:up", onDone);
  canvas.on("object:modified", onDone);

  return () => {
    canvas.off("object:moving", onMoving);
    canvas.off("mouse:up", onDone);
    canvas.off("object:modified", onDone);
    clearGuides();
  };
}
