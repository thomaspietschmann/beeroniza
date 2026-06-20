import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/session";
import { authenticateApiKey } from "@/lib/apikey";

export async function sessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function apiKeyUnauthorized() {
  return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
}

type Ctx<P> = { params: Promise<P> };

// Route wrappers that hoist the repeated auth preamble out of every handler.
// The wrapped handler receives the authenticated identity (and resolved params)
// directly, so route bodies are just business logic.

export function withUser(
  handler: (req: Request, userId: string) => Promise<Response> | Response,
) {
  return async (req: Request): Promise<Response> => {
    const userId = await sessionUserId();
    if (!userId) return unauthorized();
    return handler(req, userId);
  };
}

export function withUserParams<P>(
  handler: (req: Request, userId: string, params: P) => Promise<Response> | Response,
) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    const userId = await sessionUserId();
    if (!userId) return unauthorized();
    return handler(req, userId, await ctx.params);
  };
}

export function withAdmin(
  handler: (req: Request, userId: string) => Promise<Response> | Response,
) {
  return async (req: Request): Promise<Response> => {
    const userId = await sessionUserId();
    if (!userId) return unauthorized();
    if (!(await isAdmin(userId))) return forbidden();
    return handler(req, userId);
  };
}

export function withAdminParams<P>(
  handler: (req: Request, userId: string, params: P) => Promise<Response> | Response,
) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    const userId = await sessionUserId();
    if (!userId) return unauthorized();
    if (!(await isAdmin(userId))) return forbidden();
    return handler(req, userId, await ctx.params);
  };
}

export function withApiKey(
  handler: (req: Request, user: User) => Promise<Response> | Response,
) {
  return async (req: Request): Promise<Response> => {
    const user = await authenticateApiKey(req.headers.get("authorization"));
    if (!user) return apiKeyUnauthorized();
    return handler(req, user);
  };
}

export function withApiKeyParams<P>(
  handler: (req: Request, user: User, params: P) => Promise<Response> | Response,
) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    const user = await authenticateApiKey(req.headers.get("authorization"));
    if (!user) return apiKeyUnauthorized();
    return handler(req, user, await ctx.params);
  };
}
