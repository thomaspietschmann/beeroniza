import { test, expect } from "@playwright/test";

// Proves multi-selection (Shift-click) + relative alignment in the editor.
// Note: these templates have a full-canvas background layer, so rubber-band
// marquee starts on the background; Shift-clicking the shapes is the reliable
// multi-select path (and what the in-editor hint recommends).
test.describe("editor: multi-select + align", () => {
  test("shift-click three shapes and align their tops", async ({ page }) => {
    const templates = (await (await page.request.get("/api/templates")).json()).templates as { id: string }[];
    await page.goto(`/editor/${templates[0].id}`);
    await page.waitForFunction(() => !!(window as unknown as { __bnzCanvas?: unknown }).__bnzCanvas);

    // Add three rectangles.
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Rect", exact: true }).click();

    // Spread them to distinct positions (scene coords).
    await page.evaluate(() => {
      const c = (window as any).__bnzCanvas;
      const rects = c.getObjects().filter((o: any) => o.bnzName?.startsWith("rect")).slice(-3);
      const pos = [{ left: 280, top: 170 }, { left: 600, top: 330 }, { left: 920, top: 470 }];
      rects.forEach((o: any, i: number) => { o.set(pos[i]); o.setCoords(); });
      c.discardActiveObject();
      c.requestRenderAll();
    });

    // Screen positions of each rect centre (canvas-local CSS px).
    const pts: { x: number; y: number }[] = await page.evaluate(() => {
      const c = (window as any).__bnzCanvas;
      const vt = c.viewportTransform;
      const rects = c.getObjects().filter((o: any) => o.bnzName?.startsWith("rect")).slice(-3);
      return rects.map((o: any) => {
        const p = o.getCenterPoint();
        return { x: vt[0] * p.x + vt[4], y: vt[3] * p.y + vt[5] };
      });
    });

    const box = (await page.locator("canvas.upper-canvas").boundingBox())!;
    // Click the first, Shift-click the other two → 3-object selection.
    await page.mouse.click(box.x + pts[0].x, box.y + pts[0].y);
    await page.keyboard.down("Shift");
    await page.mouse.click(box.x + pts[1].x, box.y + pts[1].y);
    await page.mouse.click(box.x + pts[2].x, box.y + pts[2].y);
    await page.keyboard.up("Shift");

    const selCount = await page.evaluate(() => {
      const a = (window as any).__bnzCanvas.getActiveObject();
      return a && a.type === "activeselection" ? a.getObjects().length : a ? 1 : 0;
    });
    expect(selCount).toBe(3);

    // Align tops, then assert the three rects share the same bounding-box top.
    await page.getByRole("button", { name: "Align top" }).click();
    const tops: number[] = await page.evaluate(() => {
      const c = (window as any).__bnzCanvas;
      const rects = c.getObjects().filter((o: any) => o.bnzName?.startsWith("rect")).slice(-3);
      return rects.map((o: any) => Math.round(o.getBoundingRect().top));
    });
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
  });
});
