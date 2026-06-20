// Detect a raster image's MIME type from its magic bytes, so we never trust a
// client-supplied content-type / mime_type (which could claim "image/png" for
// an SVG or HTML payload that would then execute when served). Returns null for
// anything that isn't a recognized raster image — including SVG, which is
// intentionally rejected because it can carry script.

export function sniffImageMime(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF: "GIF87a" / "GIF89a"
  if (bytes.toString("ascii", 0, 6) === "GIF87a" || bytes.toString("ascii", 0, 6) === "GIF89a") {
    return "image/gif";
  }

  // WEBP: "RIFF"...."WEBP"
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }

  // AVIF (and HEIF-family): ISO-BMFF "ftyp" box with an avif/avis brand.
  if (bytes.toString("ascii", 4, 8) === "ftyp") {
    const brand = bytes.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
  }

  return null;
}
