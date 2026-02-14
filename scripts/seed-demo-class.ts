/**
 * Run: npm run db:seed
 * Creates a demo school and class with code "DEMO1" for testing the parent flow.
 * Requires MONGODB_URI in .env.local
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { ensureIndexes } = await import("../src/lib/db/index");
  const { getDb } = await import("../src/lib/db");
  await ensureIndexes();
  const db = await getDb();

  const schools = db.collection("schools");
  const classes = db.collection("classes");

  const schoolResult = await schools.insertOne({
    name: "Demo School",
    createdAt: new Date(),
  });
  const schoolId = schoolResult.insertedId?.toString();
  if (!schoolId) throw new Error("Failed to create school");

  const classResult = await classes.insertOne({
    schoolId,
    name: "Grade 3 - Room 101",
    code: "DEMO1",
    teacherIds: [],
    studentIds: [],
    guardianIds: [],
    term: "2025-Q1",
    createdAt: new Date(),
  });
  const classId = classResult.insertedId?.toString();

  const calendarEvents = db.collection("calendar_events");
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const inTwoWeeks = new Date();
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

  await calendarEvents.insertMany([
    {
      schoolId,
      classId: classId ?? null,
      title: "Field Trip - Science Museum",
      description: "Permission slips required. Bring lunch.",
      startAt: nextWeek.toISOString(),
      endAt: new Date(nextWeek.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      visibility: "class",
      createdAt: new Date(),
    },
    {
      schoolId,
      classId: null,
      title: "School Picture Day",
      description: "Remember to wear school colors!",
      startAt: inTwoWeeks.toISOString(),
      endAt: new Date(inTwoWeeks.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      visibility: "school",
      createdAt: new Date(),
    },
  ]);

  console.log("Demo class created successfully.");
  console.log("Class code: DEMO1 (parents can use this to join)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
