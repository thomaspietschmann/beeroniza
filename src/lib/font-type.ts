// Detect a font file's type from its magic bytes, so we never trust a
// client-supplied content-type for uploaded fonts. Returns null for anything
// that isn't a recognized desktop/web font container.
//
// `format` is the short token we store on Font.format; `cssFormat` is the value
// for the @font-face `src: url(...) format("…")` hint.

export interface FontType {
  mime: string;
  format: "woff2" | "woff" | "ttf" | "otf";
  cssFormat: "woff2" | "woff" | "truetype" | "opentype";
}

export function sniffFontType(bytes: Buffer): FontType | null {
  if (bytes.length < 4) return null;
  const tag = bytes.toString("ascii", 0, 4);

  // WOFF2: "wOF2"
  if (tag === "wOF2") {
    return { mime: "font/woff2", format: "woff2", cssFormat: "woff2" };
  }
  // WOFF: "wOFF"
  if (tag === "wOFF") {
    return { mime: "font/woff", format: "woff", cssFormat: "woff" };
  }
  // OpenType with CFF outlines: "OTTO"
  if (tag === "OTTO") {
    return { mime: "font/otf", format: "otf", cssFormat: "opentype" };
  }
  // TrueType: 0x00010000 (version 1.0) or "true" / "typ1"; TrueType collection: "ttcf"
  if (
    (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) ||
    tag === "true" ||
    tag === "typ1" ||
    tag === "ttcf"
  ) {
    return { mime: "font/ttf", format: "ttf", cssFormat: "truetype" };
  }

  return null;
}

// Map a stored Font.format token back to the @font-face format() hint.
export function cssFormatFor(format: string): string {
  switch (format) {
    case "woff2":
      return "woff2";
    case "woff":
      return "woff";
    case "otf":
    case "opentype":
      return "opentype";
    // Bundled fonts are stored as "truetype"; uploads as "ttf".
    case "ttf":
    case "truetype":
    default:
      return "truetype";
  }
}