import { prisma } from "@/lib/db";
import { withUser, json } from "@/lib/api-helpers";

// Returns the full default kit for the current user, or an empty shell when
// the user has no kits yet.
export const GET = withUser(async (_req, userId) => {
  const kit = await prisma.brandKit.findFirst({
    where: { userId, isDefault: true },
  });
  return json(
    kit
      ? { id: kit.id, name: kit.name, isDefault: true, palettes: kit.palettes, fonts: kit.fonts }
      : { id: null, name: null, isDefault: true, palettes: [], fonts: [] },
  );
});
