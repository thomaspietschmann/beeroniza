// Shared formatting helpers for dashboard / management UI.

export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const ms = date.getTime();
  if (Number.isNaN(ms)) return "—";

  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const sec = Math.round(abs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  const suffix = diff >= 0 ? "ago" : "from now";
  if (sec < 45) return "just now";
  if (min < 60) return `${min} min ${suffix}`;
  if (hr < 24) return `${hr} hr ${suffix}`;
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ${suffix}`;

  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export type GenerationStatus = "queued" | "processing" | "completed" | "failed";

// Maps a (case-insensitive) generation status to a Bootstrap badge variant.
export function statusVariant(status: string): string {
  switch (status.toLowerCase()) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "processing":
      return "primary";
    case "queued":
    default:
      return "secondary";
  }
}
