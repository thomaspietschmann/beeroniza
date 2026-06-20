import { sessionUserId, unauthorized } from "@/lib/api-helpers";
import { userFontFaceCssUrl } from "@/lib/fonts/server";

// Per-user @font-face stylesheet for the authenticated browser. Linked from the
// (app) layout so the editor canvas, template thumbnails and the fonts overview
// can all render the user's uploaded / Google-imported fonts. Bundled fonts are
// already declared in the build-time _fonts.scss, so they're not repeated here.
export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();

  const css = await userFontFaceCssUrl(userId);
  return new Response(css, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      // Per-user and cheap to regenerate; keep it briefly cached but private.
      "cache-control": "private, max-age=30",
    },
  });
}