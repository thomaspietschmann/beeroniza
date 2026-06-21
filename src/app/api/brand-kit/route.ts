import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUser, badRequest, json } from "@/lib/api-helpers";

// Returns a summary list of all brand kits (instance-wide).
export const GET = withUser(async () => {
  const kits = await prisma.brandKit.findMany({
    orderBy: [{ isDefault: "desc" }, { updatedAt: "asc" }],
    select: { id: true, name: true, isDefault: true, updatedAt: true },
  });
  return json({ kits });
});

const createSchema = z.object({ name: z.string().min(1).max(80) });

// Creates a new brand kit. If none exist yet, marks it as default.
export const POST = withUser(async (req, userId) => {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid brand kit", parsed.error.issues);

  const count = await prisma.brandKit.count();
  const kit = await prisma.brandKit.create({
    data: { userId, name: parsed.data.name, isDefault: count === 0 },
    select: { id: true, name: true, isDefault: true },
  });
  return json({ kit }, 201);
});
