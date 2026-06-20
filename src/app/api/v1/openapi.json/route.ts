import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi";

// Served at /api/v1/openapi.json — the machine-readable API contract for tools
// and LLM agents.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(buildOpenApiSpec(), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
