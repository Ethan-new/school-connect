/**
 * Run: npx tsx scripts/seed-students-by-code.ts
 * Clears all students from the class with code QZQPPS, adds 20 with fake names,
 * and adds 20 seed parents (no Auth0 - for linking/testing).
 * Requires MONGODB_URI in .env.local
 */
import { config } from "dotenv";
import { ObjectId } from "mongodb";

config({ path: ".env.local" });

const CLASS_CODE = "QZQPPS";
const STUDENT_COUNT = 20;
const PARENT_COUNT = 19;
const SEED_PREFIX = "seed|parent-";

const FAKE_STUDENT_NAMES = [
  "Emma Wilson", "Liam Chen", "Olivia Martinez", "Noah Thompson", "Ava Johnson",
  "Ethan Davis", "Sophia Brown", "Mason Lee", "Isabella Garcia", "Lucas Anderson",
  "Mia Jackson", "Oliver White", "Charlotte Harris", "Elijah Clark", "Amelia Lewis",
  "James Robinson", "Harper Walker", "Benjamin Hall", "Evelyn Young", "Alexander King",
];

const FAKE_PARENT_NAMES = [
  "Jennifer Adams", "Michael Torres", "Sarah Kim", "David Patel", "Emily Nguyen",
  "Christopher Lee", "Amanda Foster", "Daniel Wright", "Jessica Hayes", "Matthew Brooks",
  "Stephanie Rivera", "Andrew Coleman", "Nicole Bell", "Kevin Russell", "Rachel Powell",
  "Brandon Reed", "Lauren Cooper", "Tyler Howard", "Brittany Watson",
];

async function main() {
  const { ensureIndexes } = await import("../src/lib/db/index");
  const { getDb } = await import("../src/lib/db");
  await ensureIndexes();
  const db = await getDb("school-connect");

  const classes = db.collection("classes");
  const students = db.collection("students");
  const users = db.collection("users");

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

  const existingStudentIds: string[] = cls.studentIds ?? [];
  console.log(`Found class: ${cls.name} (${CLASS_CODE})`);
  console.log(`Clearing ${existingStudentIds.length} existing students...`);

  for (const sid of existingStudentIds) {
    const student = await students.findOne({ _id: new ObjectId(sid) });
    if (student) {
      const classIds = (student.classIds ?? []).filter((id) => id !== classId);
      if (classIds.length === 0) {
        await students.deleteOne({ _id: new ObjectId(sid) });
      } else {
        await students.updateOne(
          { _id: new ObjectId(sid) },
          { $set: { classIds } }
        );
      }
    }
  }
  await classes.updateOne(
    { _id: new ObjectId(classId) },
    { $set: { studentIds: [] } }
  );
  console.log(`✓ Cleared. Adding ${STUDENT_COUNT} students...`);

  const newStudentIds: string[] = [];
  for (let i = 0; i < STUDENT_COUNT; i++) {
    const result = await students.insertOne({
      schoolId,
      name: FAKE_STUDENT_NAMES[i],
      grade: "—",
      guardianIds: [],
      classIds: [classId],
      createdAt: new Date(),
    });
    const newId = result.insertedId?.toString();
    if (newId) newStudentIds.push(newId);
  }

  await classes.updateOne(
    { _id: new ObjectId(classId) },
    { $addToSet: { studentIds: { $each: newStudentIds } } }
  );

  for (const sid of newStudentIds) {
    await students.updateOne(
      { _id: new ObjectId(sid) },
      { $addToSet: { classIds: classId } }
    );
  }

  console.log(`✓ Added ${newStudentIds.length} students to ${cls.name}`);

  // Add 20 seed parents (no Auth0 - synthetic auth0Ids for linking/testing)
  const existingGuardianIds: string[] = cls.guardianIds ?? [];
  const seedGuardianIds = existingGuardianIds.filter((id) => id.startsWith(SEED_PREFIX));
  if (seedGuardianIds.length > 0) {
    console.log(`Clearing ${seedGuardianIds.length} existing seed parents...`);
    await classes.updateOne(
      { _id: new ObjectId(classId) },
      { $pull: { guardianIds: { $in: seedGuardianIds } } }
    );
    await users.deleteMany({ auth0Id: { $in: seedGuardianIds } });
  }

  const now = new Date();
  const newGuardianIds: string[] = [];
  for (let i = 0; i < PARENT_COUNT; i++) {
    const auth0Id = `${SEED_PREFIX}${i + 1}`;
    await users.updateOne(
      { auth0Id },
      {
        $set: {
          auth0Id,
          role: "parent",
          name: FAKE_PARENT_NAMES[i],
          email: `parent${i + 1}@example.com`,
          roleSelectedAt: now,
          parentNameSetAt: now,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
    newGuardianIds.push(auth0Id);
  }

  await classes.updateOne(
    { _id: new ObjectId(classId) },
    { $addToSet: { guardianIds: { $each: newGuardianIds } } }
  );
  console.log(`✓ Added ${newGuardianIds.length} parents to ${cls.name} (seed accounts - no Auth0 login)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
