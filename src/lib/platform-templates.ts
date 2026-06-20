import { SCHEMA_VERSION } from "./template/schema";
import { SIZE_PRESETS } from "./presets";
import { clamp } from "./math";

// The organised starter library: for EACH platform format (see ./presets.ts)
// the 8 content variants — Title / +1 / +2 / +3 avatars, each also with a
// subtitle. Every template has a full-bleed default background (a gradient,
// swappable), a logo placeholder, and the appropriate title/subtitle/avatar+name
// slots. Used by the boot seed (prisma/seed.ts), by createUser (every new
// account) and by the manual reset script (scripts/seed-platform-templates.ts).
//
// Rendering rule (see template/fabric-render.ts): any placeholder left empty is
// dropped from the output, EXCEPT the background, which keeps its baked-in
// default via bnzKeepDefault. So the logo and unused avatars simply don't render.

const INK = "#0e2a33";
const PEACH = "#f9b97e";

const svg = (s: string) => "data:image/svg+xml," + encodeURIComponent(s);

const bgDefault = (w: number, h: number) =>
  svg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='#0e2a33'/><stop offset='1' stop-color='#15596a'/>` +
      `</linearGradient></defs><rect width='${w}' height='${h}' fill='url(#g)'/></svg>`,
  );

const avatarPlaceholder = svg(
  "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>" +
    "<rect width='240' height='240' fill='#d9d9df'/>" +
    "<circle cx='120' cy='96' r='44' fill='#b4b4c2'/>" +
    "<rect x='52' y='150' width='136' height='70' rx='34' fill='#b4b4c2'/></svg>",
);

export interface PlatformVariant {
  avatars: 0 | 1 | 2 | 3;
  subtitle: boolean;
  name: string;
}

export const PLATFORM_VARIANTS: PlatformVariant[] = [
  { avatars: 0, subtitle: false, name: "Title" },
  { avatars: 1, subtitle: false, name: "Title + 1 avatar" },
  { avatars: 2, subtitle: false, name: "Title + 2 avatars" },
  { avatars: 3, subtitle: false, name: "Title + 3 avatars" },
  { avatars: 0, subtitle: true, name: "Title + subtitle" },
  { avatars: 1, subtitle: true, name: "Title + subtitle + 1 avatar" },
  { avatars: 2, subtitle: true, name: "Title + subtitle + 2 avatars" },
  { avatars: 3, subtitle: true, name: "Title + subtitle + 3 avatars" },
];

export function buildPlatformDoc(w: number, h: number, v: PlatformVariant) {
  const margin = Math.round(w * 0.066);
  const hasAvatars = v.avatars > 0;

  const barH = clamp(Math.round(h * 0.135), 96, 150);
  const barTop = h - barH;
  const av = barH - 46; // avatar diameter
  const avTop = barTop + (barH - av) / 2;

  // Logo: contain-fit rectangle, top-right corner. Hidden in output if unfilled.
  const logoW = Math.round(w * 0.2);
  const logoH = clamp(Math.round(h * 0.08), 44, 90);

  // Title / subtitle vertical region (below the logo, above the bar/bottom).
  const titleSize = clamp(Math.round(w * 0.072), 28, 160);
  const subSize = clamp(Math.round(w * 0.03), 16, 64);
  const titleW = w - 2 * margin;
  const region0 = margin + logoH + Math.round(h * 0.02);
  const region1 = (hasAvatars ? barTop : h - margin) - Math.round(h * 0.03);
  const regionH = region1 - region0;
  // Reserve up to a fraction of the region for the title, but never more than
  // ~2.5 lines — otherwise on tall (story/portrait) canvases the subtitle drifts
  // far below the title. The smaller of the two keeps the block tight + centered.
  const lineCap = Math.round(titleSize * 1.05 * 2.5);
  const titleMaxH = Math.min(Math.round(regionH * (v.subtitle ? 0.52 : 0.78)), lineCap);
  const gap = Math.round(h * 0.018);
  const blockH = titleMaxH + (v.subtitle ? gap + Math.round(subSize * 1.4) : 0);
  const blockTop = region0 + Math.max(0, Math.round((regionH - blockH) / 2));

  const objects: Record<string, unknown>[] = [];

  // 1) Background (default gradient, swappable, kept when not filled).
  objects.push({
    type: "Image",
    originX: "left",
    originY: "top",
    src: bgDefault(w, h),
    left: 0,
    top: 0,
    width: w,
    height: h,
    scaleX: 1,
    scaleY: 1,
    bnzName: "background",
    bnzKeepDefault: true,
    bnzPlaceholder: { type: "image", label: "Background image" },
  });

  // 2) Title (always present; large, centered).
  objects.push({
    type: "Textbox",
    originX: "left",
    originY: "top",
    text: "Your headline goes here",
    left: margin,
    top: blockTop,
    width: titleW,
    fontSize: titleSize,
    fontFamily: "Work Sans",
    fontWeight: "700",
    fill: "#ffffff",
    textAlign: "left",
    lineHeight: 1.05,
    bnzName: "title",
    bnzFit: "shrink",
    bnzMaxHeight: titleMaxH,
    bnzPlaceholder: { type: "text", label: "Title" },
  });

  // 3) Subtitle (optional variants).
  if (v.subtitle) {
    objects.push({
      type: "Textbox",
      originX: "left",
      originY: "top",
      text: "A short supporting subtitle",
      left: margin,
      top: blockTop + titleMaxH + gap,
      width: titleW,
      fontSize: subSize,
      fontFamily: "Work Sans",
      fontWeight: "600",
      fill: "#ffffff",
      textAlign: "left",
      bnzName: "subtitle",
      bnzFit: "shrink",
      bnzMaxHeight: Math.round(subSize * 2.6),
      bnzPlaceholder: { type: "text", label: "Subtitle" },
    });
  }

  // 4) Bottom bar + avatars + names (only when the variant has avatars).
  if (hasAvatars) {
    objects.push({
      type: "Rect",
      originX: "left",
      originY: "top",
      left: 0,
      top: barTop,
      width: w,
      height: barH,
      fill: PEACH,
      bnzName: "bar_color",
      bnzKeepDefault: true, // keeps the peach default if no color is supplied
      bnzPlaceholder: { type: "color", label: "Bar color" },
    });

    const slots = 3;
    const slotGap = Math.round(w * 0.025);
    const slotW = (w - 2 * margin - (slots - 1) * slotGap) / slots;
    const nameW = Math.round(slotW - av - 12);
    const nameSize = clamp(Math.round(w * 0.02), 12, 30);

    for (let i = 0; i < v.avatars; i++) {
      const n = i + 1;
      const x = Math.round(margin + i * (slotW + slotGap));
      objects.push({
        type: "Image",
        originX: "left",
        originY: "top",
        src: avatarPlaceholder,
        left: x,
        top: avTop,
        width: 240,
        height: 240,
        scaleX: av / 240,
        scaleY: av / 240,
        clipPath: { type: "Circle", radius: 120, originX: "center", originY: "center" },
        bnzName: `author${n}_avatar`,
        bnzClip: "circle",
        bnzPlaceholder: { type: "image", label: `Author ${n} avatar` },
      });
      objects.push({
        type: "Textbox",
        originX: "left",
        originY: "top",
        text: "Author Name",
        left: x + av + 12,
        top: Math.round(barTop + barH / 2 - nameSize * 0.7),
        width: nameW,
        fontSize: nameSize,
        fontFamily: "Work Sans",
        fontWeight: "700",
        fill: INK,
        textAlign: "left",
        bnzName: `author${n}_name`,
        bnzFit: "shrink",
        bnzMaxHeight: Math.round(nameSize * 2.4),
        bnzPlaceholder: { type: "text", label: `Author ${n} name` },
      });
    }
  }

  // 5) Logo placeholder (top-right; contain-fit; optional — hidden if unfilled).
  objects.push({
    type: "Rect",
    originX: "left",
    originY: "top",
    left: w - margin - logoW,
    top: margin,
    width: logoW,
    height: logoH,
    fill: "",
    stroke: "rgba(255,255,255,0.45)",
    strokeWidth: 1,
    strokeDashArray: [6, 5],
    bnzName: "logo",
    bnzImageFit: "contain",
    bnzImageAlign: "right",
    bnzPlaceholder: { type: "image", label: "Logo (transparent PNG)" },
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    canvas: { width: w, height: h, backgroundColor: "#ffffff" },
    fabric: { version: "6.0.0", background: "#ffffff", objects },
  };
}

export interface PlatformStarterTemplate {
  name: string;
  platform: string;
  formatLabel: string;
  width: number;
  height: number;
  data: object;
}

// The full set (SIZE_PRESETS × PLATFORM_VARIANTS) ready for prisma.createMany.
export function platformStarterTemplates(): PlatformStarterTemplate[] {
  const out: PlatformStarterTemplate[] = [];
  for (const fmt of SIZE_PRESETS) {
    for (const v of PLATFORM_VARIANTS) {
      out.push({
        name: v.name,
        platform: fmt.platform,
        formatLabel: fmt.label,
        width: fmt.width,
        height: fmt.height,
        data: buildPlatformDoc(fmt.width, fmt.height, v) as object,
      });
    }
  }
  return out;
}
