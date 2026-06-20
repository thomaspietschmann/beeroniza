import "dotenv/config";
import { prisma } from "../src/lib/db";
import { BUNDLED_FONTS } from "../src/lib/fonts/bundled";
import { hashPassword } from "../src/lib/password";
import { platformStarterTemplates } from "../src/lib/platform-templates";

// Idempotent seed: registers the bundled open-source fonts as global Font rows
// (userId = null, isBundled = true) so they appear in the editor's font picker.
async function seedBundledFonts() {
  let created = 0;
  for (const font of BUNDLED_FONTS) {
    for (const face of font.faces) {
      const existing = await prisma.font.findFirst({
        where: {
          userId: null,
          family: font.family,
          weight: face.weight,
          style: face.style,
          isBundled: true,
        },
      });
      if (existing) continue;
      await prisma.font.create({
        data: {
          userId: null,
          family: font.family,
          weight: face.weight,
          style: face.style,
          format: "truetype",
          isBundled: true,
          source: "bundled",
        },
      });
      created += 1;
    }
  }
  console.log(
    `Seed: bundled fonts — ${created} new face(s) registered (${BUNDLED_FONTS.length} families).`,
  );
}

// Development admin account. Bypasses the 8-char registration rule on purpose.
async function seedAdminUser() {
  const email = "admin@example.org";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed: admin user ${email} already exists.`);
    return;
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: "Admin",
      passwordHash: await hashPassword("123456"),
      role: "ADMIN",
    },
  });
  const starters = platformStarterTemplates();
  await prisma.template.createMany({
    data: starters.map((t) => ({
      userId: user.id,
      name: t.name,
      platform: t.platform,
      formatLabel: t.formatLabel,
      width: t.width,
      height: t.height,
      data: t.data,
    })),
  });
  console.log(`Seed: created admin user ${email} (password: 123456) with ${starters.length} starter templates.`);
}

async function main() {
  await seedBundledFonts();
  await seedAdminUser();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
