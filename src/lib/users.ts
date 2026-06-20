import { prisma } from "./db";
import { hashPassword } from "./password";
import { env } from "./env";
import { platformStarterTemplates } from "./platform-templates";

export class RegistrationError extends Error {}

export async function findOrCreateOidcUser(email: string, name: string | null) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: name ?? null,
      passwordHash: null,
      role: "USER",
    },
  });
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !email.includes("@")) {
    throw new RegistrationError("Please enter a valid email address.");
  }
  if (password.length < 8) {
    throw new RegistrationError("Password must be at least 8 characters.");
  }

  // The very first account is always allowed (bootstrap), even if public
  // registration is disabled — otherwise a locked-down instance can never be
  // initialised.
  const existingCount = await prisma.user.count();
  if (existingCount > 0 && !env.allowRegistration) {
    throw new RegistrationError("Registration is disabled on this instance.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new RegistrationError("An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);
  const isFirstUser = existingCount === 0;

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash,
      role: isFirstUser ? "ADMIN" : "USER",
    },
  });

  // Give every new account the full platform starter library (organised by
  // social platform, with the title/subtitle/avatar variants per format).
  await prisma.template.createMany({
    data: platformStarterTemplates().map((t) => ({
      userId: user.id,
      name: t.name,
      platform: t.platform,
      formatLabel: t.formatLabel,
      width: t.width,
      height: t.height,
      data: t.data,
    })),
  });

  return user;
}
