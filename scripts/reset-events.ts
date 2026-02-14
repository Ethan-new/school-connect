/**
 * Run: npm run db:reset-events
 * Clears calendar events and permission slips to start fresh.
 * Requires MONGODB_URI in .env.local
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { getDb } = await import("../src/lib/db");
  const db = await getDb("school-connect");

  const calendarEvents = db.collection("calendar_events");
  const permissionSlips = db.collection("event_permission_slips");

  const eventsResult = await calendarEvents.deleteMany({});
  const slipsResult = await permissionSlips.deleteMany({});

  console.log(`Deleted ${eventsResult.deletedCount} calendar event(s).`);
  console.log(`Deleted ${slipsResult.deletedCount} permission slip(s).`);
  console.log("Events database reset complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
