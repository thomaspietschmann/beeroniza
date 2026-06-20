import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { prisma } from "./db";
import { env } from "./env";
import type { FileKind, StoredFile } from "@prisma/client";

// Pluggable file storage for uploads and generated images.
//
//   STORAGE_DRIVER=db    – bytes live in Postgres (StoredFile.data). Zero extra
//                          infrastructure: a single DATABASE_URL runs everything.
//   STORAGE_DRIVER=local – bytes live on disk under STORAGE_LOCAL_PATH, which
//                          should point at a mounted directory / Docker volume.
//                          The DB row only keeps a RELATIVE storageKey
//                          ("<kind>/<id>"), so the storage root can be remounted
//                          at a different path without breaking existing files.

export interface SaveFileInput {
  userId?: string | null;
  kind: FileKind;
  mimeType: string;
  bytes: Buffer;
  width?: number | null;
  height?: number | null;
  originalName?: string | null;
  // Normalized face focal point (0..1) and whether a face was detected.
  focalX?: number | null;
  focalY?: number | null;
  hasFace?: boolean;
  // When true, an existing file with the same userId+kind+sha256 is returned
  // instead of storing a byte-identical duplicate.
  dedupe?: boolean;
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Resolve a stored key to an absolute path. Relative keys resolve against the
// configured storage root; absolute keys (legacy) are returned as-is.
function resolveStoragePath(storageKey: string): string {
  return path.isAbsolute(storageKey)
    ? storageKey
    : path.join(env.storageLocalPath, storageKey);
}

export async function saveFile(input: SaveFileInput): Promise<StoredFile> {
  const sha256 = sha256Hex(input.bytes);

  // Deduplicate byte-identical uploads for the same owner+kind: reuse the
  // existing row instead of storing the same bytes twice. If the new upload
  // carries focal/face metadata the stored row lacks or differs on (e.g. the
  // user just set a focal point, or detection ran this time), merge it in so the
  // correction isn't silently discarded.
  if (input.dedupe) {
    const existing = await prisma.storedFile.findFirst({
      where: { userId: input.userId ?? null, kind: input.kind, sha256 },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      const merged = {
        focalX: input.focalX ?? existing.focalX,
        focalY: input.focalY ?? existing.focalY,
        hasFace: input.hasFace ?? existing.hasFace,
      };
      const changed =
        merged.focalX !== existing.focalX ||
        merged.focalY !== existing.focalY ||
        merged.hasFace !== existing.hasFace;
      if (changed) {
        return prisma.storedFile.update({ where: { id: existing.id }, data: merged });
      }
      return existing;
    }
  }

  const base = {
    userId: input.userId ?? null,
    kind: input.kind,
    mimeType: input.mimeType,
    byteSize: input.bytes.length,
    width: input.width ?? null,
    height: input.height ?? null,
    originalName: input.originalName ?? null,
    sha256,
    focalX: input.focalX ?? null,
    focalY: input.focalY ?? null,
    hasFace: input.hasFace ?? false,
  };

  if (env.storageDriver === "local") {
    const created = await prisma.storedFile.create({ data: base });
    try {
      const relKey = path.join(input.kind.toLowerCase(), created.id);
      const absPath = path.join(env.storageLocalPath, relKey);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      // Write to a temp file then rename so readers never see a partial file.
      const tmp = `${absPath}.tmp`;
      await fs.writeFile(tmp, new Uint8Array(input.bytes));
      await fs.rename(tmp, absPath);
      return await prisma.storedFile.update({
        where: { id: created.id },
        data: { storageKey: relKey },
      });
    } catch (err) {
      // Don't leave an unreadable row (no inline data, no storageKey) behind.
      await prisma.storedFile.delete({ where: { id: created.id } }).catch(() => undefined);
      throw err;
    }
  }

  return prisma.storedFile.create({
    data: { ...base, data: new Uint8Array(input.bytes) },
  });
}

export async function readFileBytes(
  file: Pick<StoredFile, "data" | "storageKey">,
): Promise<Buffer> {
  if (file.data) {
    return Buffer.from(file.data);
  }
  if (file.storageKey) {
    return fs.readFile(resolveStoragePath(file.storageKey));
  }
  throw new Error("StoredFile has neither inline data nor a storageKey");
}

export async function getFile(id: string): Promise<StoredFile | null> {
  return prisma.storedFile.findUnique({ where: { id } });
}

export async function deleteFile(id: string): Promise<void> {
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) return;
  if (file.storageKey) {
    await fs.rm(resolveStoragePath(file.storageKey), { force: true });
  }
  await prisma.storedFile.delete({ where: { id } });
}
