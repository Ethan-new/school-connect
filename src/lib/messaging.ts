import { ObjectId } from "mongodb";
import {
  conversationsCollection,
  messagesCollection,
  classesCollection,
  studentsCollection,
  usersCollection,
} from "./db/collections";
import type { Conversation, Message } from "./db/types";
import { isDbConfigured } from "./db";

export interface MessageSerialized {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  isFromTeacher: boolean;
}

export interface ConversationWithDetails {
  id: string;
  studentId: string;
  studentName: string;
  guardianId: string;
  guardianName: string;
  lastMessageAt: string;
  lastMessagePreview?: string;
  messageCount: number;
}

/** Students with their guardians - for teacher messages tab */
export interface StudentWithGuardians {
  studentId: string;
  studentName: string;
  guardians: { guardianId: string; guardianName: string }[];
}

/**
 * For a teacher, get all students in their classes with linked guardians.
 * Used to build the Messages list (like Report Cards).
 */
export async function getStudentsWithGuardiansForTeacher(
  auth0Id: string
): Promise<StudentWithGuardians[]> {
  if (!isDbConfigured()) return [];

  try {
    const classes = await classesCollection();
    const students = await studentsCollection();
    const users = await usersCollection();

    const teacherClasses = await classes
      .find({ teacherIds: auth0Id })
      .toArray();
    const studentIds = [
      ...new Set(
        teacherClasses.flatMap((c) => c.studentIds ?? []).filter(Boolean)
      ),
    ].filter((id) => /^[a-f0-9]{24}$/i.test(id));
    if (studentIds.length === 0) return [];

    const studentDocs = await students
      .find({
        _id: { $in: studentIds.map((id) => new ObjectId(id)) },
      })
      .toArray();

    const guardianIds = [
      ...new Set(
        studentDocs.flatMap((s) => s.guardianIds ?? []).filter(Boolean)
      ),
    ];
    const guardianDocs =
      guardianIds.length > 0
        ? await users.find({ auth0Id: { $in: guardianIds } }).toArray()
        : [];
    const guardianNameMap = new Map(
      guardianDocs.map((u) => [
        u.auth0Id,
        u.name ?? u.email ?? "Parent",
      ])
    );

    const result: StudentWithGuardians[] = [];
    const seen = new Set<string>();

    for (const stu of studentDocs) {
      const sid = stu._id?.toString() ?? "";
      if (!sid || seen.has(sid)) continue;
      const gids = stu.guardianIds ?? [];
      if (gids.length === 0) continue;
      seen.add(sid);
      result.push({
        studentId: sid,
        studentName: stu.name ?? "Student",
        guardians: gids.map((gid) => ({
          guardianId: gid,
          guardianName: guardianNameMap.get(gid) ?? "Parent",
        })),
      });
    }

    return result.sort((a, b) =>
      a.studentName.localeCompare(b.studentName)
    );
  } catch (error) {
    console.error("[getStudentsWithGuardiansForTeacher] Failed:", error);
    return [];
  }
}

/**
 * Get or create a conversation between teacher and guardian about a student.
 */
export async function getOrCreateConversation(
  teacherId: string,
  guardianId: string,
  studentId: string,
  schoolId: string
): Promise<{ success: true; conversationId: string } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const convos = await conversationsCollection();
    const classes = await classesCollection();
    const students = await studentsCollection();

    const student = await students.findOne({ _id: new ObjectId(studentId) });
    if (!student) return { success: false, error: "Student not found" };

    const classIds = student.classIds ?? [];
    const teacherClasses = await classes
      .find({
        _id: { $in: classIds.map((id) => new ObjectId(id)) },
        teacherIds: teacherId,
      })
      .toArray();
    if (teacherClasses.length === 0) {
      return { success: false, error: "You don't have access to this student" };
    }

    if (!student.guardianIds?.includes(guardianId)) {
      return { success: false, error: "Guardian is not linked to this student" };
    }

    const participants = [teacherId, guardianId].sort();
    const existing = await convos.findOne({
      participantIds: participants,
      studentId,
    });
    if (existing) {
      return {
        success: true,
        conversationId: existing._id?.toString() ?? "",
      };
    }

    const now = new Date();
    const insert = await convos.insertOne({
      schoolId,
      participantIds: participants,
      studentId,
      lastMessageAt: now,
      createdAt: now,
    });
    const id = insert.insertedId?.toString();
    if (!id) return { success: false, error: "Failed to create conversation" };
    return { success: true, conversationId: id };
  } catch (error) {
    console.error("[getOrCreateConversation] Failed:", error);
    return { success: false, error: "Failed to create conversation" };
  }
}

/**
 * Get messages for a conversation. Teacher must be a participant.
 */
export async function getMessages(
  auth0Id: string,
  conversationId: string
): Promise<MessageSerialized[]> {
  if (!isDbConfigured()) return [];

  try {
    const convos = await conversationsCollection();
    const messages = await messagesCollection();

    const convo = await convos.findOne({
      _id: new ObjectId(conversationId),
    });
    if (!convo) return [];
    if (!convo.participantIds?.includes(auth0Id)) return [];

    const docs = await messages
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .toArray();

    return docs.map((m) => ({
      id: m._id?.toString() ?? "",
      conversationId: m.conversationId,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt?.toISOString() ?? "",
      isFromTeacher: m.senderId === auth0Id,
    }));
  } catch (error) {
    console.error("[getMessages] Failed:", error);
    return [];
  }
}

/**
 * Send a message. Sender must be a participant.
 */
export async function sendMessage(
  auth0Id: string,
  conversationId: string,
  body: string
): Promise<{ success: true; messageId: string } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  const trimmed = body?.trim();
  if (!trimmed) return { success: false, error: "Message cannot be empty" };

  try {
    const convos = await conversationsCollection();
    const messages = await messagesCollection();

    const convo = await convos.findOne({
      _id: new ObjectId(conversationId),
    });
    if (!convo) return { success: false, error: "Conversation not found" };
    if (!convo.participantIds?.includes(auth0Id)) {
      return { success: false, error: "You are not in this conversation" };
    }

    const now = new Date();
    const result = await messages.insertOne({
      conversationId,
      senderId: auth0Id,
      body: trimmed,
      createdAt: now,
    });

    await convos.updateOne(
      { _id: new ObjectId(conversationId) },
      { $set: { lastMessageAt: now } }
    );

    const id = result.insertedId?.toString();
    if (!id) return { success: false, error: "Failed to send message" };
    return { success: true, messageId: id };
  } catch (error) {
    console.error("[sendMessage] Failed:", error);
    return { success: false, error: "Failed to send message" };
  }
}

/** Key: "guardianId:studentId" */
export type ConversationSummaryMap = Map<
  string,
  {
    conversationId: string;
    lastMessageAt: string;
    lastMessagePreview: string | null;
    messageCount: number;
  }
>;

/**
 * Get conversation summaries for all teacher+guardian+student pairs.
 * More efficient than per-call lookups.
 */
export async function getConversationSummariesForTeacher(
  teacherId: string,
  studentsWithGuardians: StudentWithGuardians[]
): Promise<ConversationSummaryMap> {
  const map: ConversationSummaryMap = new Map();
  if (!isDbConfigured()) return map;

  try {
    const convos = await conversationsCollection();
    const messages = await messagesCollection();

    const pairs: { guardianId: string; studentId: string }[] = [];
    for (const swg of studentsWithGuardians) {
      for (const g of swg.guardians) {
        pairs.push({ guardianId: g.guardianId, studentId: swg.studentId });
      }
    }
    if (pairs.length === 0) return map;

    const allConvos = await convos
      .find({
        participantIds: teacherId,
        studentId: { $in: pairs.map((p) => p.studentId) },
      })
      .toArray();

    for (const convo of allConvos) {
      const participants = convo.participantIds ?? [];
      const other = participants.find((id) => id !== teacherId);
      if (!other || !convo.studentId) continue;
      const key = `${other}:${convo.studentId}`;
      if (!pairs.some((p) => p.guardianId === other && p.studentId === convo.studentId))
        continue;

      const convoId = convo._id?.toString() ?? "";
      const msgs = await messages
        .find({ conversationId: convoId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
      const count = await messages.countDocuments({ conversationId: convoId });

      map.set(key, {
        conversationId: convoId,
        lastMessageAt: convo.lastMessageAt?.toISOString() ?? "",
        lastMessagePreview: msgs[0]
          ? msgs[0].body?.slice(0, 60) + (msgs[0].body.length > 60 ? "…" : "")
          : null,
        messageCount: count,
      });
    }
    return map;
  } catch (error) {
    console.error("[getConversationSummariesForTeacher] Failed:", error);
    return map;
  }
}

/** For parent dashboard: conversation with teacher info */
export interface ParentConversationSummary {
  conversationId: string;
  studentId: string;
  studentName: string;
  teacherName: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  messageCount: number;
}

/**
 * Get all conversations for a parent (guardian), with teacher and student info.
 */
export async function getConversationsForParent(
  guardianId: string
): Promise<ParentConversationSummary[]> {
  if (!isDbConfigured()) return [];

  try {
    const convos = await conversationsCollection();
    const messages = await messagesCollection();
    const students = await studentsCollection();
    const users = await usersCollection();

    const convoDocs = await convos
      .find({ participantIds: guardianId })
      .sort({ lastMessageAt: -1 })
      .toArray();

    const teacherIds = [
      ...new Set(
        convoDocs.flatMap((c) =>
          (c.participantIds ?? []).filter((id) => id !== guardianId)
        )
      ),
    ];
    const studentIds = [
      ...new Set(
        convoDocs.map((c) => c.studentId).filter((id): id is string => Boolean(id))
      ),
    ];

    const [teacherDocs, studentDocs] = await Promise.all([
      teacherIds.length > 0
        ? users.find({ auth0Id: { $in: teacherIds } }).toArray()
        : [],
      studentIds.length > 0
        ? students.find({
            _id: {
              $in: studentIds
                .filter((id) => /^[a-f0-9]{24}$/i.test(id))
                .map((id) => new ObjectId(id)),
            },
          }).toArray()
        : [],
    ]);

    const teacherNameMap = new Map(
      teacherDocs.map((u) => [u.auth0Id, u.name ?? u.email ?? "Teacher"])
    );
    const studentNameMap = new Map(
      studentDocs.map((s) => [s._id?.toString() ?? "", s.name ?? "Student"])
    );

    const result: ParentConversationSummary[] = [];
    for (const convo of convoDocs) {
      const other = (convo.participantIds ?? []).find((id) => id !== guardianId);
      if (!other || !convo.studentId) continue;

      const convoId = convo._id?.toString() ?? "";
      const lastMsgs = await messages
        .find({ conversationId: convoId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
      const count = await messages.countDocuments({ conversationId: convoId });

      result.push({
        conversationId: convoId,
        studentId: convo.studentId,
        studentName: studentNameMap.get(convo.studentId) ?? "Student",
        teacherName: teacherNameMap.get(other) ?? "Teacher",
        lastMessageAt: convo.lastMessageAt?.toISOString() ?? "",
        lastMessagePreview: lastMsgs[0]
          ? lastMsgs[0].body?.slice(0, 60) +
            (lastMsgs[0].body.length > 60 ? "…" : "")
          : null,
        messageCount: count,
      });
    }
    return result;
  } catch (error) {
    console.error("[getConversationsForParent] Failed:", error);
    return [];
  }
}
