// Canvas size presets for common social / OpenGraph formats, grouped by
// platform. This single list is the shared source of truth for: the New
// template modal (size dropdown), the seed generator (which pre-builds variants
// for each format) and the templates listing (grouping + platform filter).
//
// Dimensions verified against 2026 platform guidance (Hootsuite / Buffer / OG
// guides): 1200×630 is the universal OG/link card; 1200×675 is X's 16:9 card;
// 1200×627 LinkedIn link; 1080-wide square/portrait/story for IG & Facebook.

export interface SizePreset {
  id: string;
  platform: string;
  // Short human label for the specific format, including dimensions.
  label: string;
  width: number;
  height: number;
}

// Display / grouping order for platforms on the listing page and modal.
// X and OpenGraph come first — those drive the og:image / twitter:image meta
// tags. Bluesky and Mastodon have no card format of their own; they render the
// same OpenGraph image (1200×630), so they reuse that link-card layout.
export const PLATFORM_ORDER = [
  "Web / OpenGraph",
  "X (Twitter)",
  "Bluesky",
  "Mastodon",
  "LinkedIn",
  "Instagram",
  "Facebook",
] as const;

export const SIZE_PRESETS: SizePreset[] = [
  { id: "og", platform: "Web / OpenGraph", label: "Link 1200×630", width: 1200, height: 630 },
  { id: "x", platform: "X (Twitter)", label: "Post 1200×675", width: 1200, height: 675 },
  { id: "bluesky", platform: "Bluesky", label: "Link 1200×630", width: 1200, height: 630 },
  { id: "mastodon", platform: "Mastodon", label: "Link 1200×630", width: 1200, height: 630 },
  { id: "li-link", platform: "LinkedIn", label: "Link 1200×627", width: 1200, height: 627 },
  { id: "li-square", platform: "LinkedIn", label: "Square 1200×1200", width: 1200, height: 1200 },
  { id: "ig-square", platform: "Instagram", label: "Square 1080×1080", width: 1080, height: 1080 },
  { id: "ig-portrait", platform: "Instagram", label: "Portrait 1080×1350", width: 1080, height: 1350 },
  { id: "ig-story", platform: "Instagram", label: "Story 1080×1920", width: 1080, height: 1920 },
  { id: "fb-post", platform: "Facebook", label: "Post 1080×1080", width: 1080, height: 1080 },
  { id: "fb-story", platform: "Facebook", label: "Story 1080×1920", width: 1080, height: 1920 },
];

export function presetById(id: string): SizePreset | undefined {
  return SIZE_PRESETS.find((p) => p.id === id);
}

// Presets grouped by platform, in PLATFORM_ORDER, for rendering optgroups /
// sections.
export function presetsByPlatform(): { platform: string; presets: SizePreset[] }[] {
  return PLATFORM_ORDER.map((platform) => ({
    platform,
    presets: SIZE_PRESETS.filter((p) => p.platform === platform),
  })).filter((g) => g.presets.length > 0);
}
