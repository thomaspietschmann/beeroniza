import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { platformStarterTemplates } from "../src/lib/platform-templates";
import { TEST_EMAIL, TEST_PASSWORD } from "./test-user";

// Creates (or recreates) the isolated e2e test user with its own seeded starter
// templates. Idempotent: any previous test user (and its cascade-owned data) is
// removed first. Run by Playwright's global setup.
async function main() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });

  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      name: "E2E Test",
      passwordHash: await hashPassword(TEST_PASSWORD),
      // Admin so the /admin guard test can reach the page (it never triggers the
      // destructive reset — only checks the confirmation guards).
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
      data: t.data as object,
    })),
  });

  console.log(`e2e: seeded test user ${TEST_EMAIL} with ${starters.length} templates.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
