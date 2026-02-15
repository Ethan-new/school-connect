import { getDb } from "../db";

const DB_NAME = "school-connect";

/**
 * Ensure all indexes exist. Call once on app startup or via a setup script.
 */
export async function ensureIndexes(): Promise<void> {
  const db = await getDb(DB_NAME);

  // Messages: conversationId + createdAt for fast message queries
  await db.collection("messages").createIndex(
    { conversationId: 1, createdAt: 1 },
    { name: "conversation_created" }
  );

  // Event permission slips: guardianId for parent task lookup, eventId for teacher status
  await db.collection("event_permission_slips").createIndex(
    { guardianId: 1, status: 1 },
    { name: "guardian_status" }
  );
  await db.collection("event_permission_slips").createIndex(
    { eventId: 1 },
    { name: "event_slips" }
  );

  // Calendar events: classId + startAt, schoolId + startAt
  await db.collection("calendar_events").createIndex(
    { classId: 1, startAt: 1 },
    { name: "class_start", sparse: true }
  );
  await db.collection("calendar_events").createIndex(
    { schoolId: 1, startAt: 1 },
    { name: "school_start" }
  );

  // Users: auth0Id unique index (already used for upsert)
  await db.collection("users").createIndex(
    { auth0Id: 1 },
    { unique: true, name: "auth0Id_unique" }
  );
  await db.collection("users").createIndex(
    { schoolId: 1 },
    { name: "school_users", sparse: true }
  );

  // Students: schoolId for listing students by school
  await db.collection("students").createIndex(
    { schoolId: 1 },
    { name: "school_students" }
  );
  await db.collection("students").createIndex(
    { guardianIds: 1 },
    { name: "guardian_lookup" }
  );

  // Classes: schoolId, term
  await db.collection("classes").createIndex(
    { schoolId: 1, term: 1 },
    { name: "school_term" }
  );
  // Classes: unique code for parent join lookup (sparse for classes without codes)
  await db.collection("classes").createIndex(
    { code: 1 },
    { unique: true, sparse: true, name: "code_unique" }
  );

  // Conversations: participantIds for lookup, lastMessageAt for sorting
  await db.collection("conversations").createIndex(
    { participantIds: 1, studentId: 1 },
    { name: "participants_student" }
  );
  await db.collection("conversations").createIndex(
    { lastMessageAt: -1 },
    { name: "recent_threads" }
  );

  // Report cards: studentId + term
  await db.collection("report_cards").createIndex(
    { studentId: 1, term: 1 },
    { name: "student_term" }
  );

  // Permission forms: studentId, status
  await db.collection("permission_forms").createIndex(
    { studentId: 1 },
    { name: "student_forms" }
  );
  await db.collection("permission_forms").createIndex(
    { dueAt: 1, status: 1 },
    { name: "due_status" }
  );

  // Signatures: formId, studentId (one signature per form per student)
  await db.collection("signatures").createIndex(
    { formId: 1, studentId: 1 },
    { unique: true, name: "form_student_unique" }
  );

  // Interview slots: classId + startAt for teacher/parent lookup
  await db.collection("interview_slots").createIndex(
    { classId: 1, startAt: 1 },
    { name: "class_start" }
  );
}
