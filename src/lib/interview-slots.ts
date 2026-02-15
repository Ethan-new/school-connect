import { ObjectId } from "mongodb";
import {
  interviewSlotsCollection,
  classesCollection,
  studentsCollection,
  usersCollection,
  schoolsCollection,
} from "./db/collections";
import type { InterviewSlot } from "./db/types";
import { isDbConfigured } from "./db";

export interface InterviewSlotSerialized {
  id: string;
  classId: string;
  startAt: string;
  endAt: string;
  studentId?: string;
  studentName?: string;
  guardianId?: string;
  guardianName?: string;
  isClaimed: boolean;
}

function serializeSlot(
  slot: InterviewSlot,
  studentName?: string,
  guardianName?: string
): InterviewSlotSerialized {
  const isClaimed = Boolean(
    slot.studentId &&
      (slot.guardianId ||
        slot.manualGuardianName ||
        slot.manualGuardianEmail)
  );
  const name = guardianName ?? slot.manualGuardianName;
  return {
    id: slot._id?.toString() ?? "",
    classId: slot.classId,
    startAt: slot.startAt,
    endAt: slot.endAt,
    studentId: slot.studentId,
    studentName: isClaimed ? studentName : undefined,
    guardianId: slot.guardianId,
    guardianName: isClaimed ? name : undefined,
    isClaimed,
  };
}

/**
 * Creates interview slots for a class. Teacher must teach the class.
 */
export async function createInterviewSlots(
  auth0Id: string,
  classId: string,
  slots: { startAt: string; endAt: string }[]
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  if (slots.length === 0) {
    return { success: false, error: "Please add at least one time slot" };
  }
  if (slots.length > 100) {
    return { success: false, error: "Maximum 100 slots at a time" };
  }

  try {
    const classes = await classesCollection();
    const cls = await classes.findOne({ _id: new ObjectId(classId) });
    if (!cls) return { success: false, error: "Class not found" };
    if (!cls.teacherIds?.includes(auth0Id)) {
      return { success: false, error: "You don't have access to this class" };
    }

    const interviewSlots = await interviewSlotsCollection();
    const toInsert = slots.map((s) => ({
      classId,
      startAt: s.startAt,
      endAt: s.endAt,
      createdAt: new Date(),
    }));

    const result = await interviewSlots.insertMany(toInsert);
    return { success: true, count: result.insertedCount };
  } catch (error) {
    console.error("[createInterviewSlots] Failed:", error);
    return { success: false, error: "Failed to create slots" };
  }
}

/**
 * Fetches interview slots for a class. Teacher must teach the class.
 */
export async function getInterviewSlotsForClass(
  auth0Id: string,
  classId: string
): Promise<InterviewSlotSerialized[]> {
  if (!isDbConfigured()) return [];

  try {
    const classes = await classesCollection();
    const cls = await classes.findOne({ _id: new ObjectId(classId) });
    if (!cls) return [];
    if (!cls.teacherIds?.includes(auth0Id)) return [];

    const slots = await interviewSlotsCollection();
    const students = await studentsCollection();
    const users = await usersCollection();

    const slotDocs = await slots
      .find({ classId })
      .sort({ startAt: 1 })
      .toArray();

    const studentIds = [
      ...new Set(
        slotDocs
          .map((s) => s.studentId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const guardianIds = [
      ...new Set(
        slotDocs
          .map((s) => s.guardianId)
          .filter((id): id is string => Boolean(id))
      ),
    ];

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
    const guardianDocs =
      guardianIds.length > 0
        ? await users.find({ auth0Id: { $in: guardianIds } }).toArray()
        : [];

    const studentNameMap = new Map(
      studentDocs.map((s) => [s._id?.toString() ?? "", s.name ?? "Student"])
    );
    const guardianNameMap = new Map(
      guardianDocs.map((u) => [
        u.auth0Id,
        u.name ?? u.email ?? "Parent",
      ])
    );

    return slotDocs.map((s) =>
      serializeSlot(
        s,
        s.studentId ? studentNameMap.get(s.studentId) : undefined,
        s.guardianId ? guardianNameMap.get(s.guardianId) : undefined
      )
    );
  } catch (error) {
    console.error("[getInterviewSlotsForClass] Failed:", error);
    return [];
  }
}

/**
 * Fetches interview slots for all of a teacher's classes.
 */
export async function getInterviewSlotsForTeacher(
  auth0Id: string
): Promise<{ classId: string; className: string; slots: InterviewSlotSerialized[] }[]> {
  if (!isDbConfigured()) return [];

  try {
    const classes = await classesCollection();
    const teacherClasses = await classes
      .find({ teacherIds: auth0Id })
      .toArray();

    const result: { classId: string; className: string; slots: InterviewSlotSerialized[] }[] = [];
    for (const cls of teacherClasses) {
      const classId = cls._id?.toString() ?? "";
      const slots = await getInterviewSlotsForClass(auth0Id, classId);
      result.push({
        classId,
        className: cls.name ?? "Class",
        slots,
      });
    }
    return result;
  } catch (error) {
    console.error("[getInterviewSlotsForTeacher] Failed:", error);
    return [];
  }
}

/**
 * Teacher removes a slot. Only teacher of the class can remove.
 */
export async function deleteInterviewSlot(
  auth0Id: string,
  slotId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const slots = await interviewSlotsCollection();
    const classes = await classesCollection();

    const slot = await slots.findOne({ _id: new ObjectId(slotId) });
    if (!slot) return { success: false, error: "Slot not found" };

    const cls = await classes.findOne({ _id: new ObjectId(slot.classId) });
    if (!cls) return { success: false, error: "Class not found" };
    if (!cls.teacherIds?.includes(auth0Id)) {
      return { success: false, error: "You don't have access to this class" };
    }

    await slots.deleteOne({ _id: new ObjectId(slotId) });
    return { success: true };
  } catch (error) {
    console.error("[deleteInterviewSlot] Failed:", error);
    return { success: false, error: "Failed to remove slot" };
  }
}

/**
 * Teacher books a slot for a parent without an account.
 */
export async function bookInterviewSlotManually(
  auth0Id: string,
  slotId: string,
  studentId: string,
  parentName: string,
  parentEmail?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  const name = parentName?.trim();
  const email = parentEmail?.trim() || undefined;
  if (!name) {
    return { success: false, error: "Parent name is required" };
  }

  try {
    const slots = await interviewSlotsCollection();
    const classes = await classesCollection();
    const students = await studentsCollection();

    const slot = await slots.findOne({ _id: new ObjectId(slotId) });
    if (!slot) return { success: false, error: "Slot not found" };
    const alreadyClaimed = Boolean(
      slot.studentId &&
        (slot.guardianId ||
          slot.manualGuardianName ||
          slot.manualGuardianEmail)
    );
    if (alreadyClaimed) {
      return { success: false, error: "This slot is already claimed" };
    }

    const cls = await classes.findOne({ _id: new ObjectId(slot.classId) });
    if (!cls) return { success: false, error: "Class not found" };
    if (!cls.teacherIds?.includes(auth0Id)) {
      return { success: false, error: "You don't have access to this class" };
    }
    if (!cls.studentIds?.includes(studentId)) {
      return { success: false, error: "Student is not in this class" };
    }

    const student = await students.findOne({ _id: new ObjectId(studentId) });
    if (!student) return { success: false, error: "Student not found" };

    // Check: only one slot per child per class
    const existingClaim = await slots.findOne({
      classId: slot.classId,
      studentId,
    });
    if (existingClaim) {
      return {
        success: false,
        error: "This child already has a slot in this class",
      };
    }

    await slots.updateOne(
      { _id: new ObjectId(slotId) },
      {
        $set: {
          studentId,
          manualGuardianName: name,
          ...(email && { manualGuardianEmail: email }),
        },
      }
    );
    return { success: true };
  } catch (error) {
    console.error("[bookInterviewSlotManually] Failed:", error);
    return { success: false, error: "Failed to book slot" };
  }
}

/**
 * Teacher unbooks a manually-booked slot (or parent-claimed slot for admin).
 */
export async function unbookInterviewSlot(
  auth0Id: string,
  slotId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const slots = await interviewSlotsCollection();
    const classes = await classesCollection();

    const slot = await slots.findOne({ _id: new ObjectId(slotId) });
    if (!slot) return { success: false, error: "Slot not found" };

    const cls = await classes.findOne({ _id: new ObjectId(slot.classId) });
    if (!cls) return { success: false, error: "Class not found" };
    if (!cls.teacherIds?.includes(auth0Id)) {
      return { success: false, error: "You don't have access to this class" };
    }

    await slots.updateOne(
      { _id: new ObjectId(slotId) },
      { $unset: { studentId: "", guardianId: "", manualGuardianName: "", manualGuardianEmail: "" } }
    );
    return { success: true };
  } catch (error) {
    console.error("[unbookInterviewSlot] Failed:", error);
    return { success: false, error: "Failed to unbook slot" };
  }
}

/**
 * Parent claims a slot for one of their children. One slot per child per class.
 */
export async function claimInterviewSlot(
  guardianId: string,
  slotId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const slots = await interviewSlotsCollection();
    const classes = await classesCollection();
    const students = await studentsCollection();

    const slot = await slots.findOne({ _id: new ObjectId(slotId) });
    if (!slot) return { success: false, error: "Slot not found" };
    const alreadyClaimed = Boolean(
      slot.studentId &&
        (slot.guardianId ||
          slot.manualGuardianName ||
          slot.manualGuardianEmail)
    );
    if (alreadyClaimed) {
      return { success: false, error: "This slot is already claimed" };
    }

    const student = await students.findOne({
      _id: new ObjectId(studentId),
    });
    if (!student) return { success: false, error: "Student not found" };
    if (!student.guardianIds?.includes(guardianId)) {
      return { success: false, error: "You are not linked to this student" };
    }
    if (!student.classIds?.includes(slot.classId)) {
      return { success: false, error: "Student is not in this class" };
    }

    const cls = await classes.findOne({ _id: new ObjectId(slot.classId) });
    if (!cls) return { success: false, error: "Class not found" };
    if (!cls.guardianIds?.includes(guardianId)) {
      return { success: false, error: "You have not joined this class" };
    }

    // Check: parent can only claim one slot per child per class
    const existingClaim = await slots.findOne({
      classId: slot.classId,
      studentId,
      guardianId,
    });
    if (existingClaim) {
      return {
        success: false,
        error: "You have already claimed a slot for this child in this class",
      };
    }

    await slots.updateOne(
      { _id: new ObjectId(slotId) },
      { $set: { studentId, guardianId } }
    );
    return { success: true };
  } catch (error) {
    console.error("[claimInterviewSlot] Failed:", error);
    return { success: false, error: "Failed to claim slot" };
  }
}

/**
 * Parent unclaims a slot they previously claimed.
 */
export async function unclaimInterviewSlot(
  guardianId: string,
  slotId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const slots = await interviewSlotsCollection();
    const users = await usersCollection();

    const slot = await slots.findOne({ _id: new ObjectId(slotId) });
    if (!slot) return { success: false, error: "Slot not found" };

    const claimedByGuardian = slot.guardianId === guardianId;
    let claimedByManualEmail = false;
    if (slot.manualGuardianEmail) {
      const guardian = await users.findOne({ auth0Id: guardianId });
      claimedByManualEmail = Boolean(
        guardian?.email &&
          slot.manualGuardianEmail.toLowerCase() === guardian.email.toLowerCase()
      );
    }

    if (!claimedByGuardian && !claimedByManualEmail) {
      return { success: false, error: "You did not claim this slot" };
    }

    await slots.updateOne(
      { _id: new ObjectId(slotId) },
      {
        $unset: {
          studentId: "",
          guardianId: "",
          manualGuardianName: "",
          manualGuardianEmail: "",
        },
      }
    );
    return { success: true };
  } catch (error) {
    console.error("[unclaimInterviewSlot] Failed:", error);
    return { success: false, error: "Failed to unclaim slot" };
  }
}

/**
 * Fetches interview data for a parent: classes with slots and their children per class.
 */
export interface ParentInterviewClass {
  classId: string;
  className: string;
  schoolName: string;
  children: { id: string; name: string; claimedSlotId?: string; claimedSlotStartAt?: string }[];
  slots: InterviewSlotSerialized[];
}

export async function getInterviewDataForGuardian(
  guardianId: string
): Promise<ParentInterviewClass[]> {
  if (!isDbConfigured()) return [];

  try {
    const classes = await classesCollection();
    const students = await studentsCollection();
    const schools = await schoolsCollection();
    const slots = await interviewSlotsCollection();

    const parentClasses = await classes
      .find({ guardianIds: guardianId })
      .toArray();

    const result: ParentInterviewClass[] = [];

    for (const cls of parentClasses) {
      const classId = cls._id?.toString() ?? "";
      const studentIds = cls.studentIds ?? [];

      const studentDocs = await students
        .find({
          _id: { $in: studentIds.map((id) => new ObjectId(id)) },
          guardianIds: guardianId,
        })
        .toArray();

      const myChildIds = studentDocs.map((s) => s._id?.toString()).filter(Boolean) as string[];
      if (myChildIds.length === 0) continue;

      const slotDocs = await slots
        .find({ classId })
        .sort({ startAt: 1 })
        .toArray();

      const slotSerialized = slotDocs.map((s) => {
        const isClaimed = Boolean(
          s.studentId &&
            (s.guardianId ||
              s.manualGuardianName ||
              s.manualGuardianEmail)
        );
        return {
          id: s._id?.toString() ?? "",
          classId: s.classId,
          startAt: s.startAt,
          endAt: s.endAt,
          studentId: s.studentId,
          guardianId: s.guardianId,
          isClaimed,
        } as InterviewSlotSerialized;
      });

      const users = await usersCollection();
      const guardianUser = await users.findOne({ auth0Id: guardianId });
      const guardianEmail = guardianUser?.email?.toLowerCase();

      const claimedByMyChild = new Map<string, { slotId: string; startAt: string }>();
      for (const s of slotDocs) {
        if (!s.studentId || !myChildIds.includes(s.studentId)) continue;
        const claimedByMe =
          s.guardianId === guardianId ||
          (s.manualGuardianEmail &&
            guardianEmail &&
            s.manualGuardianEmail.toLowerCase() === guardianEmail);
        if (claimedByMe) {
          claimedByMyChild.set(s.studentId, {
            slotId: s._id?.toString() ?? "",
            startAt: s.startAt,
          });
        }
      }

      const children = studentDocs.map((s) => {
        const sid = s._id?.toString() ?? "";
        const claim = claimedByMyChild.get(sid);
        return {
          id: sid,
          name: s.name ?? "Student",
          claimedSlotId: claim?.slotId,
          claimedSlotStartAt: claim?.startAt,
        };
      });

      let schoolName = "School";
      try {
        const school = await schools.findOne({ _id: new ObjectId(cls.schoolId) });
        if (school?.name) schoolName = school.name;
      } catch {
        // ignore
      }

      result.push({
        classId,
        className: cls.name ?? "Class",
        schoolName,
        children,
        slots: slotSerialized,
      });
    }

    return result;
  } catch (error) {
    console.error("[getInterviewDataForGuardian] Failed:", error);
    return [];
  }
}
