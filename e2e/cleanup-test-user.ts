import "dotenv/config";
import { prisma } from "../src/lib/db";
import { TEST_EMAIL } from "./test-user";

// Removes the e2e test user; the cascade deletes all of its templates, usages,
// generations, uploaded media, API keys and brand kit. Run by global teardown.
async function main() {
  const res = await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  console.log(`e2e: removed ${res.count} test user(s) and all owned data.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
