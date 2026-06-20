import { prisma } from "@/lib/db";
import { placeholdersOf } from "@/lib/template/schema";
import { templateDocSchema } from "@/lib/template/schema";
import { withApiKey, json } from "@/lib/api-helpers";

// GET /api/v1/templates — list templates available to this API key, including
// their placeholders so callers know what they can fill in.
export const GET = withApiKey(async (_req, user) => {
  const templates = await prisma.template.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  const result = templates.map((t) => {
    const parsed = templateDocSchema.safeParse(t.data);
    return {
      id: t.id,
      name: t.name,
      width: t.width,
      height: t.height,
      placeholders: parsed.success ? placeholdersOf(parsed.data) : [],
    };
  });

  return json({ templates: result });
});
