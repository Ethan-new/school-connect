import { ObjectId } from "mongodb";
import {
  reportCardsCollection,
  studentsCollection,
  classesCollection,
} from "./db/collections";
import type { ReportCard } from "./db/types";
import { isDbConfigured } from "./db";

export interface ReportCardSerialized {
  id: string;
  studentId: string;
  studentName?: string;
  term: string;
  teacherId: string;
  status: "draft" | "published";
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

function serializeReportCard(rc: ReportCard | null): ReportCardSerialized | null {
  if (!rc || !rc.pdfBase64) return null;
  return {
    id: rc._id?.toString() ?? "",
    studentId: rc.studentId,
    term: rc.term,
    teacherId: rc.teacherId,
    status: rc.status,
    publishedAt: rc.publishedAt?.toISOString(),
    createdAt: rc.createdAt?.toISOString(),
    updatedAt: rc.updatedAt?.toISOString(),
  };
}

/**
 * Fetches all report cards for students in a teacher's classes.
 * Used for the Report cards tab.
 */
export async function getReportCardsForTeacher(
  auth0Id: string
): Promise<ReportCardSerialized[]> {
  if (!isDbConfigured()) return [];

  try {
    const classes = await classesCollection();
    const students = await studentsCollection();
    const reportCards = await reportCardsCollection();

    const teacherClasses = await classes
      .find({ teacherIds: auth0Id })
      .toArray();
    const studentIds = [
      ...new Set(
        teacherClasses.flatMap((c) => c.studentIds ?? [])
      ),
    ].filter((id) => /^[a-f0-9]{24}$/i.test(id));
    if (studentIds.length === 0) return [];

    const studentDocs = await students
      .find({
        _id: { $in: studentIds.map((id) => new ObjectId(id)) },
      })
      .toArray();
    const studentNameMap = new Map(
      studentDocs.map((s) => [s._id?.toString() ?? "", s.name ?? "Student"])
    );

    const cards = await reportCards
      .find({
        studentId: { $in: studentIds },
        pdfBase64: { $exists: true, $ne: "" },
      })
      .sort({ term: -1, createdAt: -1 })
      .toArray();

    return cards
      .map((c) => {
        const serialized = serializeReportCard(c);
        if (serialized) {
          serialized.studentName = studentNameMap.get(c.studentId) ?? "Student";
        }
        return serialized;
      })
      .filter((s): s is ReportCardSerialized => Boolean(s));
  } catch (error) {
    console.error("[getReportCardsForTeacher] Failed:", error);
    return [];
  }
}

/**
 * Fetches report cards for a student. Teacher must teach a class that includes this student.
 */
export async function getReportCardsForStudent(
  auth0Id: string,
  studentId: string
): Promise<ReportCardSerialized[]> {
  if (!isDbConfigured()) return [];

  try {
    const students = await studentsCollection();
    const classes = await classesCollection();
    const reportCards = await reportCardsCollection();

    const student = await students.findOne({
      _id: new ObjectId(studentId),
    });
    if (!student) return [];

    // Verify teacher has access: teacher must be in a class that has this student
    const studentClassIds = student.classIds ?? [];
    const teacherClasses = await classes
      .find({
        _id: { $in: studentClassIds.map((id) => new ObjectId(id)) },
        teacherIds: auth0Id,
      })
      .toArray();
    if (teacherClasses.length === 0) return [];

    const cards = await reportCards
      .find({
        studentId,
        pdfBase64: { $exists: true, $ne: "" },
      })
      .sort({ term: -1, createdAt: -1 })
      .toArray();

    return cards.map((c) => serializeReportCard(c)!).filter(Boolean);
  } catch (error) {
    console.error("[getReportCardsForStudent] Failed:", error);
    return [];
  }
}

/**
 * Creates a new report card (draft) from an uploaded PDF.
 */
export async function createReportCard(
  auth0Id: string,
  input: {
    studentId: string;
    term: string;
    pdfBase64: string;
  }
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  const { studentId, term, pdfBase64 } = input;
  if (!studentId || !term.trim()) {
    return { success: false, error: "Student and term are required" };
  }
  if (!pdfBase64 || pdfBase64.length < 100) {
    return { success: false, error: "Please upload a PDF file" };
  }

  try {
    const students = await studentsCollection();
    const classes = await classesCollection();
    const reportCards = await reportCardsCollection();

    const student = await students.findOne({
      _id: new ObjectId(studentId),
    });
    if (!student) return { success: false, error: "Student not found" };

    const studentClassIds = student.classIds ?? [];
    const teacherClasses = await classes
      .find({
        _id: { $in: studentClassIds.map((id) => new ObjectId(id)) },
        teacherIds: auth0Id,
      })
      .toArray();
    if (teacherClasses.length === 0) {
      return { success: false, error: "You don't have access to this student" };
    }

    // Check for existing report card for same student+term
    const existing = await reportCards.findOne({ studentId, term });
    if (existing) {
      return {
        success: false,
        error: `A report card for term "${term}" already exists. Edit it instead.`,
      };
    }

    const now = new Date();
    const result = await reportCards.insertOne({
      studentId,
      term: term.trim(),
      teacherId: auth0Id,
      pdfBase64,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });

    const id = result.insertedId?.toString();
    if (!id) return { success: false, error: "Failed to create report card" };
    return { success: true, id };
  } catch (error) {
    console.error("[createReportCard] Failed:", error);
    return { success: false, error: "Failed to create report card" };
  }
}

/**
 * Updates a report card (draft only). Teacher must own it or teach the student.
 */
export async function updateReportCardPdf(
  auth0Id: string,
  reportCardId: string,
  pdfBase64: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const reportCards = await reportCardsCollection();
    const classes = await classesCollection();
    const students = await studentsCollection();

    const rc = await reportCards.findOne({
      _id: new ObjectId(reportCardId),
    });
    if (!rc) return { success: false, error: "Report card not found" };
    if (rc.status !== "draft") {
      return { success: false, error: "Published report cards cannot be edited" };
    }

    const student = await students.findOne({
      _id: new ObjectId(rc.studentId),
    });
    if (!student) return { success: false, error: "Student not found" };
    const teacherClasses = await classes
      .find({
        _id: {
          $in: (student.classIds ?? []).map((id) => new ObjectId(id)),
        },
        teacherIds: auth0Id,
      })
      .toArray();
    if (teacherClasses.length === 0 && rc.teacherId !== auth0Id) {
      return { success: false, error: "You don't have access to this report card" };
    }

    await reportCards.updateOne(
      { _id: new ObjectId(reportCardId) },
      { $set: { pdfBase64, updatedAt: new Date() } }
    );
    return { success: true };
  } catch (error) {
    console.error("[updateReportCardPdf] Failed:", error);
    return { success: false, error: "Failed to update report card" };
  }
}

/**
 * Publishes a report card. Only draft report cards can be published.
 */
export async function publishReportCard(
  auth0Id: string,
  reportCardId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const reportCards = await reportCardsCollection();
    const classes = await classesCollection();
    const students = await studentsCollection();

    const rc = await reportCards.findOne({
      _id: new ObjectId(reportCardId),
    });
    if (!rc) return { success: false, error: "Report card not found" };
    if (rc.status === "published") {
      return { success: false, error: "Report card is already published" };
    }

    const student = await students.findOne({
      _id: new ObjectId(rc.studentId),
    });
    if (!student) return { success: false, error: "Student not found" };
    const teacherClasses = await classes
      .find({
        _id: {
          $in: (student.classIds ?? []).map((id) => new ObjectId(id)),
        },
        teacherIds: auth0Id,
      })
      .toArray();
    if (teacherClasses.length === 0 && rc.teacherId !== auth0Id) {
      return { success: false, error: "You don't have access to this report card" };
    }

    await reportCards.updateOne(
      { _id: new ObjectId(reportCardId) },
      {
        $set: {
          status: "published",
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
    return { success: true };
  } catch (error) {
    console.error("[publishReportCard] Failed:", error);
    return { success: false, error: "Failed to publish report card" };
  }
}

/**
 * Fetches published report cards for all students linked to a guardian (parent).
 * Includes student names for display.
 */
export async function getPublishedReportCardsForGuardian(
  guardianId: string
): Promise<ReportCardSerialized[]> {
  if (!isDbConfigured()) return [];

  try {
    const students = await studentsCollection();
    const reportCards = await reportCardsCollection();

    const guardianStudents = await students
      .find({ guardianIds: guardianId })
      .toArray();
    const studentIds = guardianStudents
      .map((s) => s._id?.toString())
      .filter((id): id is string => Boolean(id));
    const studentNameMap = new Map(
      guardianStudents.map((s) => [s._id?.toString() ?? "", s.name ?? "Student"])
    );
    if (studentIds.length === 0) return [];

    const cards = await reportCards
      .find({
        studentId: { $in: studentIds },
        status: "published",
        pdfBase64: { $exists: true, $ne: "" },
      })
      .sort({ term: -1, publishedAt: -1 })
      .toArray();

    return cards
      .map((c) => {
        const serialized = serializeReportCard(c);
        if (serialized) {
          serialized.studentName = studentNameMap.get(c.studentId) ?? "Student";
        }
        return serialized;
      })
      .filter((s): s is ReportCardSerialized => Boolean(s));
  } catch (error) {
    console.error("[getPublishedReportCardsForGuardian] Failed:", error);
    return [];
  }
}
