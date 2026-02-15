/**
 * Run: npm run db:setup
 * Ensures MongoDB indexes exist. Requires MONGODB_URI in .env.local
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { ensureIndexes } = await import("../src/lib/db/index");
  await ensureIndexes();
  console.log("Indexes created successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
