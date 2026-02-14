import { ObjectId } from "mongodb";
import {
  classesCollection,
  studentsCollection,
  usersCollection,
  calendarEventsCollection,
  eventPermissionSlipsCollection,
} from "./db/collections";
import { isDbConfigured } from "./db";

export interface ClassStudentWithGuardian {
  id: string;
  name: string;
  grade: string;
  guardianIds: string[];
  guardianNames: string[];
}

/**
 * Adds a list of students by name to a class. Verifies the teacher owns the class.
 */
export async function addStudentsToClass(
  auth0Id: string,
  classId: string,
  names: string[],
  grade = ""
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  const trimmedNames = names
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  if (trimmedNames.length === 0) {
    return { success: false, error: "Please enter at least one student name" };
  }

  if (trimmedNames.length > 100) {
    return { success: false, error: "Maximum 100 students at a time" };
  }

  try {
    const classes = await classesCollection();
    const cls = await classes.findOne({ _id: new ObjectId(classId) });

    if (!cls) return { success: false, error: "Class not found" };
    if (!cls.teacherIds?.includes(auth0Id)) {
      return { success: false, error: "You don't have access to this class" };
    }

    const students = await studentsCollection();
    const schoolId = cls.schoolId;
    const existingStudentIds = cls.studentIds ?? [];
    const newStudentIds: string[] = [];

    for (const name of trimmedNames) {
      if (name.length > 100) continue;

      const result = await students.insertOne({
        schoolId,
        name,
        grade: grade.trim() || "—",
        guardianIds: [],
        classIds: [classId],
        createdAt: new Date(),
      });

      const newId = result.insertedId?.toString();
      if (newId) {
        newStudentIds.push(newId);
      }
    }

    if (newStudentIds.length === 0) {
      return { success: false, error: "Failed to add students" };
    }

    await classes.updateOne(
      { _id: new ObjectId(classId) },
      { $addToSet: { studentIds: { $each: newStudentIds } } }
    );

    // Update students with classId in case they were created before class update
    for (const sid of newStudentIds) {
      await students.updateOne(
        { _id: new ObjectId(sid) },
        { $addToSet: { classIds: classId } }
      );
    }

    return { success: true, count: newStudentIds.length };
  } catch (error) {
    console.error("[addStudentsToClass] Failed:", error);
    return { success: false, error: "Failed to add students. Please try again." };
  }
}

/**
 * Links a parent (guardian) to a student. Verifies the teacher owns the class.
 */
export async function linkGuardianToStudent(
  auth0Id: string,
  classId: string,
  studentId: string,
  guardianId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  if (!classId || !studentId || !guardianId) {
    return { success: false, error: "Class, student, and guardian are required" };
  }

  try {
    const classes = await classesCollection();
    const students = await studentsCollection();

    const cls = await classes.findOne({ _id: new ObjectId(classId) });
    if (!cls) return { success: false, error: "Class not found" };
    if (!cls.teacherIds?.includes(auth0Id)) {
      return { success: false, error: "You don't have access to this class" };
    }

    const studentIds = cls.studentIds ?? [];
    if (!studentIds.includes(studentId)) {
      return { success: false, error: "Student is not in this class" };
    }

    const student = await students.findOne({ _id: new ObjectId(studentId) });
    if (!student) return { success: false, error: "Student not found" };

    const guardianIds = cls.guardianIds ?? [];
    if (!guardianIds.includes(guardianId)) {
      return { success: false, error: "Guardian is not in this class" };
    }

    const currentGuardians = student.guardianIds ?? [];
    if (currentGuardians.includes(guardianId)) {
      return { success: true };
    }

    await students.updateOne(
      { _id: new ObjectId(studentId) },
      { $addToSet: { guardianIds: guardianId } }
    );

    // Create permission slips for existing events that require them
    const now = new Date().toISOString();
    const today = now.slice(0, 10); // YYYY-MM-DD for occurrenceDates comparison
    const events = await calendarEventsCollection();
    const slips = await eventPermissionSlipsCollection();

    const relevantEvents = await events
      .find({
        classId,
        $and: [
          {
            $or: [
              { requiresPermissionSlip: true },
              { cost: { $gt: 0 } },
              { costPerOccurrence: { $gt: 0 } },
            ],
          },
          {
            $or: [
              { startAt: { $gte: now } },
              { startAt: { $lt: now }, endAt: { $gte: now } },
              { occurrenceDates: { $elemMatch: { $gte: today } } },
            ],
          },
        ],
      })
      .toArray();

    for (const event of relevantEvents) {
      const eventId = event._id?.toString();
      if (!eventId) continue;

      const existing = await slips.findOne({
        eventId,
        studentId,
        guardianId,
      });
      if (existing) continue;

      await slips.insertOne({
        eventId,
        classId,
        studentId,
        guardianId,
        status: "pending" as const,
        createdAt: new Date(),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("[linkGuardianToStudent] Failed:", error);
    return { success: false, error: "Failed to link. Please try again." };
  }
}

/**
 * Unlinks a guardian from a student.
 */
export async function unlinkGuardianFromStudent(
  auth0Id: string,
  classId: string,
  studentId: string,
  guardianId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const classes = await classesCollection();
    const students = await studentsCollection();

    const cls = await classes.findOne({ _id: new ObjectId(classId) });
    if (!cls) return { success: false, error: "Class not found" };
    if (!cls.teacherIds?.includes(auth0Id)) {
      return { success: false, error: "You don't have access to this class" };
    }

    const studentIds = cls.studentIds ?? [];
    if (!studentIds.includes(studentId)) {
      return { success: false, error: "Student is not in this class" };
    }

    const student = await students.findOne({ _id: new ObjectId(studentId) });
    if (!student) return { success: false, error: "Student not found" };

    await students.updateOne(
      { _id: new ObjectId(studentId) },
      { $pull: { guardianIds: guardianId } }
    );

    // Remove permission slip tasks for this student from the unlinked parent
    const slips = await eventPermissionSlipsCollection();
    await slips.deleteMany({ studentId, guardianId });

    return { success: true };
  } catch (error) {
    console.error("[unlinkGuardianFromStudent] Failed:", error);
    return { success: false, error: "Failed to unlink. Please try again." };
  }
}

/**
 * Fetches students for a class with guardian names. Used for teacher dashboard.
 */
export async function getClassStudentsWithGuardians(
  classId: string
): Promise<ClassStudentWithGuardian[]> {
  if (!isDbConfigured()) return [];

  try {
    const classes = await classesCollection();
    const students = await studentsCollection();
    const users = await usersCollection();

    const cls = await classes.findOne({ _id: new ObjectId(classId) });
    if (!cls) return [];

    const studentIds = cls.studentIds ?? [];
    if (studentIds.length === 0) return [];

    const studentDocs = await students
      .find({
        _id: {
          $in: studentIds
            .filter((id) => /^[a-f0-9]{24}$/i.test(id))
            .map((id) => new ObjectId(id)),
        },
      })
      .toArray();

    const allGuardianIds = [
      ...new Set(
        studentDocs.flatMap((s) => s.guardianIds ?? [])
      ),
    ];
    const guardianDocs =
      allGuardianIds.length > 0
        ? await users
            .find({ auth0Id: { $in: allGuardianIds } })
            .toArray()
        : [];
    const guardianNameMap = new Map(
      guardianDocs.map((u) => [u.auth0Id, u.name ?? u.email ?? "Unknown"])
    );

    return studentDocs.map((s) => ({
      id: s._id?.toString() ?? "",
      name: s.name,
      grade: s.grade ?? "",
      guardianIds: s.guardianIds ?? [],
      guardianNames: (s.guardianIds ?? []).map(
        (gid) => guardianNameMap.get(gid) ?? "Unknown"
      ),
    }));
  } catch (error) {
    console.error("[getClassStudentsWithGuardians] Failed:", error);
    return [];
  }
}
