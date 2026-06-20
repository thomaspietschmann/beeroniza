import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 connects through a driver adapter. We wrap node-postgres with a
// single connection string (DATABASE_URL) — the only hard dependency of the
// whole app.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

function createPrismaClient() {
  const adapter = new PrismaPg(connectionString as string);
  return new PrismaClient({ adapter });
}

// Reuse the client across HMR reloads in development to avoid exhausting
// connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
