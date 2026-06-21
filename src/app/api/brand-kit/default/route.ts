import { prisma } from "@/lib/db";
import { withUser, json } from "@/lib/api-helpers";

// Returns the full default kit, or an empty shell when no kits exist.
export const GET = withUser(async () => {
  const kit = await prisma.brandKit.findFirst({ where: { isDefault: true } });
  return json(
    kit
      ? { id: kit.id, name: kit.name, isDefault: true, colors: kit.colors, fonts: kit.fonts }
      : { id: null, name: null, isDefault: true, colors: [], fonts: [] },
  );
});
