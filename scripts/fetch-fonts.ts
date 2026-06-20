/**
 * Fetch the curated set of bundled open-source fonts.
 *
 * Downloads UNMODIFIED .ttf files (and their license texts) from the
 * authoritative google/fonts GitHub repository into public/fonts/<slug>/, then
 * regenerates:
 *   - src/lib/fonts/bundled.ts  (the typed manifest)
 *   - src/styles/_fonts.scss    (the @font-face declarations)
 *
 * Run with:  npm run fonts:fetch   (tsx scripts/fetch-fonts.ts)
 *
 * Constraints honoured here:
 *   - Only OFL / Apache-2.0 licensed families.
 *   - Fonts are shipped UNMODIFIED (no subsetting / renaming / conversion) so we
 *     stay clear of OFL Reserved Font Name rules.
 *   - TTF only (no woff2 conversion).
 *   - Node built-ins + global fetch only (Node 24). No extra dependencies.
 *
 * The download is idempotent: existing identical files are skipped.
 */

import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const FONTS_DIR = path.join(REPO_ROOT, "public", "fonts");
const MANIFEST_FILE = path.join(REPO_ROOT, "src", "lib", "fonts", "bundled.ts");
const SCSS_FILE = path.join(REPO_ROOT, "src", "styles", "_fonts.scss");

type Category = "sans" | "serif" | "display" | "mono";
type License = "OFL" | "Apache-2.0";

interface FaceSpec {
  weight: number;
  /** File name within the family dir on disk and on the web path. */
  file: string;
  /** True if `file` is a variable font supplying multiple weights. */
  variable?: boolean;
}

interface FamilySpec {
  family: string;
  slug: string;
  category: Category;
  license: License;
  /** Directory under google/fonts: "ofl" or "apache". */
  bucket: "ofl" | "apache";
  /** License file name in the upstream directory. */
  licenseFile: string;
  faces: FaceSpec[];
}

/**
 * Curated families. All are OFL on google/fonts.
 *
 * Weights 400 + 700 (plus 600 for sans UI fonts where easy). Bebas Neue is 400
 * only. Variable-font families list a single face flagged `variable: true`; the
 * generated CSS declares `font-weight: 100 900` for those so any weight works.
 */
const FAMILIES: FamilySpec[] = [
  // --- Sans ---
  {
    family: "Inter",
    slug: "inter",
    category: "sans",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "Inter[opsz,wght].ttf", variable: true }],
  },
  {
    family: "Roboto",
    slug: "roboto",
    category: "sans",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "Roboto[wdth,wght].ttf", variable: true }],
  },
  {
    family: "Open Sans",
    slug: "opensans",
    category: "sans",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "OpenSans[wdth,wght].ttf", variable: true }],
  },
  {
    family: "Lato",
    slug: "lato",
    category: "sans",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    // Lato ships only static instances upstream.
    faces: [
      { weight: 400, file: "Lato-Regular.ttf" },
      { weight: 700, file: "Lato-Bold.ttf" },
      { weight: 600, file: "Lato-SemiBold.ttf" },
    ],
  },
  {
    family: "Montserrat",
    slug: "montserrat",
    category: "sans",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "Montserrat[wght].ttf", variable: true }],
  },
  {
    family: "Poppins",
    slug: "poppins",
    category: "sans",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    // Poppins ships only static instances upstream.
    faces: [
      { weight: 400, file: "Poppins-Regular.ttf" },
      { weight: 600, file: "Poppins-SemiBold.ttf" },
      { weight: 700, file: "Poppins-Bold.ttf" },
    ],
  },
  {
    family: "Work Sans",
    slug: "worksans",
    category: "sans",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "WorkSans[wght].ttf", variable: true }],
  },
  {
    family: "Nunito",
    slug: "nunito",
    category: "sans",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "Nunito[wght].ttf", variable: true }],
  },
  {
    family: "Raleway",
    slug: "raleway",
    category: "sans",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "Raleway[wght].ttf", variable: true }],
  },
  // --- Serif ---
  {
    family: "Merriweather",
    slug: "merriweather",
    category: "serif",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "Merriweather[opsz,wdth,wght].ttf", variable: true }],
  },
  {
    family: "Playfair Display",
    slug: "playfairdisplay",
    category: "serif",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "PlayfairDisplay[wght].ttf", variable: true }],
  },
  {
    family: "Lora",
    slug: "lora",
    category: "serif",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "Lora[wght].ttf", variable: true }],
  },
  // --- Display ---
  {
    family: "Oswald",
    slug: "oswald",
    category: "display",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "Oswald[wght].ttf", variable: true }],
  },
  {
    family: "Bebas Neue",
    slug: "bebasneue",
    category: "display",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    // 400 only.
    faces: [{ weight: 400, file: "BebasNeue-Regular.ttf" }],
  },
  // --- Mono ---
  {
    family: "JetBrains Mono",
    slug: "jetbrainsmono",
    category: "mono",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "JetBrainsMono[wght].ttf", variable: true }],
  },
  {
    family: "Roboto Mono",
    slug: "robotomono",
    category: "mono",
    license: "OFL",
    bucket: "ofl",
    licenseFile: "OFL.txt",
    faces: [{ weight: 400, file: "RobotoMono[wght].ttf", variable: true }],
  },
];

const RAW_BRANCHES = ["main", "master"];

function rawUrl(branch: string, bucket: string, slug: string, file: string): string {
  // Each path segment is encoded so bracketed variable-font names survive.
  const enc = file.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/google/fonts/${branch}/${bucket}/${slug}/${enc}`;
}

function sourceDirUrl(bucket: string, slug: string): string {
  return `https://github.com/google/fonts/tree/main/${bucket}/${slug}`;
}

async function download(bucket: string, slug: string, file: string): Promise<Buffer> {
  let lastErr: unknown;
  for (const branch of RAW_BRANCHES) {
    try {
      const res = await fetch(rawUrl(branch, bucket, slug, file));
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
      lastErr = new Error(`HTTP ${res.status} for ${rawUrl(branch, bucket, slug, file)}`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`Failed to download ${bucket}/${slug}/${file}`);
}

async function writeIfChanged(dest: string, data: Buffer): Promise<"written" | "skipped"> {
  if (existsSync(dest)) {
    const current = await readFile(dest);
    if (current.equals(data)) return "skipped";
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, data);
  return "written";
}

async function fetchAll(): Promise<void> {
  for (const fam of FAMILIES) {
    const dir = path.join(FONTS_DIR, fam.slug);
    await mkdir(dir, { recursive: true });

    // License file (required for redistribution).
    const licenseData = await download(fam.bucket, fam.slug, fam.licenseFile);
    const licResult = await writeIfChanged(path.join(dir, fam.licenseFile), licenseData);
    console.log(`  [${fam.slug}] ${fam.licenseFile} (${licResult})`);

    for (const face of fam.faces) {
      const data = await download(fam.bucket, fam.slug, face.file);
      const result = await writeIfChanged(path.join(dir, face.file), data);
      const kb = (data.length / 1024).toFixed(0);
      console.log(`  [${fam.slug}] ${face.file} ${kb}KB (${result})`);
    }
  }
}

function webPath(slug: string, file: string): string {
  // Public web path; bracketed variable-font names are URL-encoded for CSS url().
  const enc = file.split("/").map(encodeURIComponent).join("/");
  return `/fonts/${slug}/${enc}`;
}

function generateManifest(): string {
  const lines: string[] = [];
  lines.push("// GENERATED by scripts/fetch-fonts.ts — do not edit by hand.");
  lines.push("//");
  lines.push("// Typed manifest of the bundled open-source fonts. The full license text for");
  lines.push("// each family lives next to its files in public/fonts/<slug>/.");
  lines.push("");
  lines.push('export type FontCategory = "sans" | "serif" | "display" | "mono";');
  lines.push('export type FontLicense = "OFL" | "Apache-2.0";');
  lines.push("");
  lines.push("export interface BundledFontFace {");
  lines.push("  weight: number;");
  lines.push('  style: "normal";');
  lines.push("  /** Public path, e.g. /fonts/inter/Inter-Regular.ttf */");
  lines.push("  file: string;");
  lines.push("  /** True for variable fonts that cover the full 100–900 weight range. */");
  lines.push("  variable?: boolean;");
  lines.push("}");
  lines.push("");
  lines.push("export interface BundledFont {");
  lines.push("  family: string;");
  lines.push("  slug: string;");
  lines.push("  category: FontCategory;");
  lines.push("  license: FontLicense;");
  lines.push("  /** URL of the upstream google/fonts directory. */");
  lines.push("  source: string;");
  lines.push("  faces: BundledFontFace[];");
  lines.push("}");
  lines.push("");
  lines.push("export const BUNDLED_FONTS: BundledFont[] = [");
  for (const fam of FAMILIES) {
    lines.push("  {");
    lines.push(`    family: ${JSON.stringify(fam.family)},`);
    lines.push(`    slug: ${JSON.stringify(fam.slug)},`);
    lines.push(`    category: ${JSON.stringify(fam.category)},`);
    lines.push(`    license: ${JSON.stringify(fam.license)},`);
    lines.push(`    source: ${JSON.stringify(sourceDirUrl(fam.bucket, fam.slug))},`);
    lines.push("    faces: [");
    for (const face of fam.faces) {
      const parts = [
        `weight: ${face.weight}`,
        `style: "normal"`,
        `file: ${JSON.stringify(webPath(fam.slug, face.file))}`,
      ];
      if (face.variable) parts.push("variable: true");
      lines.push(`      { ${parts.join(", ")} },`);
    }
    lines.push("    ],");
    lines.push("  },");
  }
  lines.push("];");
  lines.push("");
  lines.push("/** Distinct font-family names available to the renderer/editor. */");
  lines.push("export function fontFamilyNames(): string[] {");
  lines.push("  return BUNDLED_FONTS.map((f) => f.family);");
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function generateScss(): string {
  const lines: string[] = [];
  lines.push("// @font-face declarations for the bundled open-source fonts.");
  lines.push("//");
  lines.push("// GENERATED by scripts/fetch-fonts.ts — do not edit by hand.");
  lines.push("// Re-run `npm run fonts:fetch` to refresh the bundled fonts and rewrite this file.");
  lines.push("//");
  lines.push("// All families are licensed under the SIL Open Font License (OFL) or Apache 2.0");
  lines.push("// and are shipped UNMODIFIED. See THIRD_PARTY_LICENSES.md.");
  lines.push("");
  for (const fam of FAMILIES) {
    lines.push(`// ${fam.family} (${fam.license}, ${fam.category})`);
    for (const face of fam.faces) {
      lines.push("@font-face {");
      lines.push(`  font-family: "${fam.family}";`);
      lines.push("  font-style: normal;");
      if (face.variable) {
        lines.push("  font-weight: 100 900;");
      } else {
        lines.push(`  font-weight: ${face.weight};`);
      }
      lines.push("  font-display: swap;");
      lines.push(`  src: url("${webPath(fam.slug, face.file)}") format("truetype");`);
      lines.push("}");
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  console.log(`Fetching ${FAMILIES.length} font families into public/fonts/ ...`);
  await fetchAll();

  console.log("Regenerating manifest and SCSS ...");
  await mkdir(path.dirname(MANIFEST_FILE), { recursive: true });
  await writeFile(MANIFEST_FILE, generateManifest());
  await writeFile(SCSS_FILE, generateScss());

  // Quick size summary.
  let total = 0;
  for (const fam of FAMILIES) {
    for (const face of fam.faces) {
      const s = await stat(path.join(FONTS_DIR, fam.slug, face.file));
      total += s.size;
    }
  }
  console.log(`Done. Total .ttf payload: ${(total / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Manifest: ${path.relative(REPO_ROOT, MANIFEST_FILE)}`);
  console.log(`  SCSS:     ${path.relative(REPO_ROOT, SCSS_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
