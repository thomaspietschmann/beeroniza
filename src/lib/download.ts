// Helpers for naming + downloading generated images. Shared by the usage filler
// and the template generate form, which previously duplicated this logic.

// Turn an arbitrary name into a filename-safe slug, falling back when empty.
export function slugifyFilename(name: string, fallback: string): string {
  return (
    name
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .replace(/^-+|-+$/g, "") || fallback
  );
}

// Decorate a generated image URL with a meaningful filename (and optional
// download flag) so the file route's Content-Disposition drives the saved name +
// extension across browsers, instead of the bare cuid.
export function namedDownloadUrl(
  imageUrl: string,
  base: string,
  opts: { dl?: boolean } = {},
): string {
  const sep = imageUrl.includes("?") ? "&" : "?";
  return `${imageUrl}${sep}name=${encodeURIComponent(base)}${opts.dl ? "&dl=1" : ""}`;
}
