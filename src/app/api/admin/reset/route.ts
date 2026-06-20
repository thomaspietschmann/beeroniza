import { withAdmin, badRequest, json } from "@/lib/api-helpers";
import { resetApplication } from "@/lib/admin/reset";

// Destructive, admin-only: wipes all media/templates/usages/generations and
// re-seeds the starter templates. Requires an explicit confirmation phrase so
// it can't be triggered accidentally.
export const POST = withAdmin(async (req, userId) => {
  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== "RESET") {
    return badRequest('Confirmation required: send { "confirm": "RESET" }');
  }

  const summary = await resetApplication(userId);
  return json({ ok: true, summary });
});
