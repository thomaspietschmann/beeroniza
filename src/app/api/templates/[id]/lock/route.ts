import { z } from "zod";
import { prisma } from "@/lib/db";
import { withUserParams, notFound, badRequest, json } from "@/lib/api-helpers";
import { acquireLock, heartbeatLock, releaseLock } from "@/lib/template-lock-server";

const lockSchema = z.object({
  action: z.enum(["acquire", "heartbeat", "release"]),
  force: z.boolean().optional(),
});

export const POST = withUserParams<{ id: string }>(async (req, userId, { id }) => {
  const body = await req.json().catch(() => null);
  const parsed = lockSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid lock action", parsed.error.issues);

  const { action, force } = parsed.data;

  const existing = await prisma.template.findFirst({ where: { id }, select: { id: true } });
  if (!existing) return notFound();

  if (action === "release") {
    await releaseLock(id, userId);
    return json({ ok: true });
  }

  const result =
    action === "acquire"
      ? await acquireLock(id, userId, force ?? false)
      : await heartbeatLock(id, userId);

  if (!result.ok) return json({ ok: false, lock: result.lock }, 409);
  return json({ ok: true });
});
