/**
 * Run: npx tsx scripts/fix-pizza-day-no-signature.ts
 * Updates all Pizza Day events to not require a permission slip.
 * Requires MONGODB_URI in .env.local
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { getDb } = await import("../src/lib/db");
  const db = await getDb("school-connect");
  const calendarEvents = db.collection("calendar_events");

  const result = await calendarEvents.updateMany(
    { title: /pizza/i },
    { $set: { requiresPermissionSlip: false } }
  );

  console.log(
    `✓ Updated ${result.modifiedCount} Pizza Day event(s) to no signature required (matched ${result.matchedCount}).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
