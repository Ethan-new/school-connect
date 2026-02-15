/**
 * Run: npx tsx scripts/seed-events-by-code.ts
 * Adds sample events to the class with code QZQPPS.
 * Requires MONGODB_URI in .env.local
 */
import { config } from "dotenv";
import { ObjectId } from "mongodb";

config({ path: ".env.local" });

const CLASS_CODE = "QZQPPS";

function getThursdaysInMonth(year: number, month: number): string[] {
  const dates: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === 4) {
      dates.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function nextThursday(from: Date): string {
  const d = new Date(from);
  const day = d.getDay();
  const daysUntilThu = day <= 4 ? 4 - day : 11 - day;
  d.setDate(d.getDate() + daysUntilThu);
  return d.toISOString().slice(0, 10);
}

function nextWeekday(from: Date): string {
  const d = new Date(from);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1);
  else if (day === 6) d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

function dayBefore(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const { ensureIndexes } = await import("../src/lib/db/index");
  const { getDb } = await import("../src/lib/db");
  await ensureIndexes();
  const db = await getDb("school-connect");

  const classes = db.collection("classes");
  const calendarEvents = db.collection("calendar_events");
  const eventPermissionSlips = db.collection("event_permission_slips");
  const students = db.collection("students");

  const cls = await classes.findOne({ code: CLASS_CODE });
  if (!cls) {
    console.error(`Class with code "${CLASS_CODE}" not found.`);
    process.exit(1);
  }

  const classId = cls._id?.toString();
  const schoolId = cls.schoolId;
  if (!classId || !schoolId) {
    console.error("Invalid class document.");
    process.exit(1);
  }

  const deletedSlips = await eventPermissionSlips.deleteMany({ classId });
  const deletedClass = await calendarEvents.deleteMany({ classId });
  const deletedSchoolWide = await calendarEvents.deleteMany({
    classId: null,
    schoolId,
  });
  console.log(`Wiped ${deletedSlips.deletedCount} permission slips, ${deletedClass.deletedCount} class events, ${deletedSchoolWide.deletedCount} school-wide events.`);

  const now = new Date();
  const year = now.getFullYear();
  const inOneWeek = new Date(now);
  inOneWeek.setDate(inOneWeek.getDate() + 7);
  const inTwoWeeks = new Date(now);
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
  const inThreeWeeks = new Date(now);
  inThreeWeeks.setDate(inThreeWeeks.getDate() + 21);

  const febThursdays = getThursdaysInMonth(year, 1);
  const marThursdays = getThursdaysInMonth(year, 2);
  const febFirstThu = febThursdays[0] ?? `${year}-02-01`;
  const marFirstThu = marThursdays[0] ?? `${year}-03-01`;
  const pictureDayThu = nextThursday(inTwoWeeks);
  const fieldTripDate = nextWeekday(inOneWeek);
  const interviewDate = nextWeekday(inTwoWeeks);
  const assemblyDate = nextWeekday(inThreeWeeks);

  const events = [
    {
      schoolId,
      classId,
      title: "Field Trip - Science Museum",
      description: "Permission slips required. Bring a packed lunch.",
      startAt: `${fieldTripDate}T09:00:00`,
      endAt: `${fieldTripDate}T14:00:00`,
      visibility: "class" as const,
      requiresPermissionSlip: true,
      cost: 15,
      permissionSlipDueDate: dayBefore(fieldTripDate),
      createdAt: now,
    },
    {
      schoolId,
      classId,
      title: "Feb Pizza Day",
      description: "Pizza lunch every Thursday in February. Pay on the day or in advance.",
      startAt: `${febFirstThu}T12:00:00`,
      endAt: `${febFirstThu}T13:00:00`,
      visibility: "class" as const,
      requiresPermissionSlip: true,
      costPerOccurrence: 5,
      occurrenceDates: febThursdays,
      permissionSlipDueDate: dayBefore(febFirstThu),
      createdAt: now,
    },
    {
      schoolId,
      classId,
      title: "March Pizza Day",
      description: "Pizza lunch every Thursday in March. Pay on the day or in advance.",
      startAt: `${marFirstThu}T12:00:00`,
      endAt: `${marFirstThu}T13:00:00`,
      visibility: "class" as const,
      requiresPermissionSlip: true,
      costPerOccurrence: 5,
      occurrenceDates: marThursdays,
      permissionSlipDueDate: dayBefore(marFirstThu),
      createdAt: now,
    },
    {
      schoolId,
      classId,
      title: "School Picture Day",
      description: "Remember to wear school colors!",
      startAt: `${pictureDayThu}T09:00:00`,
      endAt: `${pictureDayThu}T11:00:00`,
      visibility: "class" as const,
      requiresPermissionSlip: false,
      cost: 0,
      permissionSlipDueDate: dayBefore(pictureDayThu),
      createdAt: now,
    },
    {
      schoolId,
      classId,
      title: "Parent-Teacher Interviews",
      description: "Sign up for a time slot via the Interviews tab.",
      startAt: `${interviewDate}T16:00:00`,
      endAt: `${interviewDate}T19:00:00`,
      visibility: "class" as const,
      createdAt: now,
    },
    {
      schoolId,
      classId,
      title: "Class Assembly",
      description: "Parents welcome to attend.",
      startAt: `${assemblyDate}T09:00:00`,
      endAt: `${assemblyDate}T10:00:00`,
      visibility: "class" as const,
      createdAt: now,
    },
  ];

  const insertResult = await calendarEvents.insertMany(events);
  const insertedIds = events.map(
    (_, i) => insertResult.insertedIds[i]?.toString()
  );

  const guardianIds = (cls as { guardianIds?: string[] }).guardianIds ?? [];
  const studentIds = cls.studentIds ?? [];
  const studentDocs =
    studentIds.length > 0
      ? await students
          .find({
            _id: {
              $in: studentIds
                .filter((id) => /^[a-f0-9]{24}$/i.test(id))
                .map((id) => new ObjectId(id)),
            },
          })
          .toArray()
      : [];

  let linkedCount = 0;
  for (let i = 0; i < Math.min(studentDocs.length, guardianIds.length); i++) {
    const student = studentDocs[i] as { _id?: ObjectId; guardianIds?: string[] };
    const existing = student.guardianIds ?? [];
    if (existing.length === 0) {
      const guardianId = guardianIds[i];
      await students.updateOne(
        { _id: student._id },
        { $addToSet: { guardianIds: guardianId } }
      );
      student.guardianIds = [guardianId];
      linkedCount++;
    }
  }
  if (linkedCount > 0) {
    console.log(`✓ Linked ${linkedCount} students to parents for inbox items.`);
  }

  const eventsNeedingSlips = events.filter(
    (e, i) =>
      (e.requiresPermissionSlip ||
        (e.cost != null && e.cost > 0) ||
        (e.costPerOccurrence != null && e.costPerOccurrence > 0)) &&
      e.classId
  );

  const slipsToInsert: Array<{
    eventId: string;
    classId: string;
    studentId: string;
    guardianId: string;
    status: "pending";
    createdAt: Date;
  }> = [];
  const slipKeys = new Set<string>();

  for (const evt of eventsNeedingSlips) {
    const evtIndex = events.indexOf(evt);
    const eventId = insertedIds[evtIndex];
    if (!eventId) continue;

    for (const student of studentDocs) {
      const studentGuardianIds = (student as { guardianIds?: string[] }).guardianIds ?? [];
      for (const guardianId of studentGuardianIds) {
        const key = `${eventId}|${student._id}|${guardianId}`;
        if (slipKeys.has(key)) continue;
        slipKeys.add(key);
        slipsToInsert.push({
          eventId,
          classId: evt.classId as string,
          studentId: student._id?.toString() ?? "",
          guardianId,
          status: "pending",
          createdAt: now,
        });
      }
    }
  }

  if (slipsToInsert.length > 0) {
    await eventPermissionSlips.insertMany(slipsToInsert);
    console.log(`✓ Created ${slipsToInsert.length} permission slip tasks for parent inbox.`);
  }

  console.log(`✓ Added ${events.length} events to class ${cls.name} (${CLASS_CODE})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
