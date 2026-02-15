"use server";

import { auth0 } from "@/lib/auth0";
import { leaveClass } from "@/lib/class-code";
import {
  createCalendarEvent,
  updateCalendarEvent,
  uploadEventPermissionForm,
} from "@/lib/calendar-events";
import {
  uploadSignedPermissionSlip,
  submitPaymentMethodOnly,
  unsubmitPermissionSlip,
  uploadPermissionSlipForStudent,
  markCashReceived,
  markInboxItemAsRead,
} from "@/lib/event-permission-slips";
import {
  addStudentsToClass,
  linkGuardianToStudent,
  unlinkGuardianFromStudent,
} from "@/lib/class-students";
import {
  getReportCardsForStudent,
  createReportCard,
  updateReportCardPdf,
  publishReportCard,
} from "@/lib/report-cards";
import {
  createInterviewSlots,
  claimInterviewSlot,
  unclaimInterviewSlot,
  deleteInterviewSlot,
  deleteAllInterviewSlotsForClass,
  bookInterviewSlotManually,
  unbookInterviewSlot,
} from "@/lib/interview-slots";
import {
  getOrCreateConversation,
  getMessages,
  sendMessage,
} from "@/lib/messaging";
import type { CalendarEventVisibility } from "@/lib/db/types";

export async function createEventAction(input: {
  schoolId: string;
  classId: string | null;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  visibility: CalendarEventVisibility;
  requiresPermissionSlip?: boolean;
  cost?: number;
  costPerOccurrence?: number;
  occurrenceDates?: string[];
  permissionSlipDueDate?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await createCalendarEvent(session.user.sub, input);
  return result.success
    ? { success: true, eventId: result.eventId }
    : { success: false, error: result.error };
}

export async function updateEventAction(
  eventId: string,
  input: {
    title?: string;
    description?: string;
    startAt?: string;
    endAt?: string;
    requiresPermissionSlip?: boolean;
    cost?: number | null;
    costPerOccurrence?: number | null;
    occurrenceDates?: string[] | null;
    permissionSlipDueDate?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await updateCalendarEvent(
    session.user.sub,
    eventId,
    input
  );
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}

export async function uploadSignedSlipAction(
  slipId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const file = formData.get("pdf") as File | null;
  if (!file || !(file instanceof File)) {
    return { success: false, error: "Please select a PDF file" };
  }
  if (file.type !== "application/pdf") {
    return { success: false, error: "File must be a PDF" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "File must be under 5MB" };
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const paymentMethod = formData.get("paymentMethod") as string | null;
  const validPayment =
    paymentMethod === "online" || paymentMethod === "cash"
      ? paymentMethod
      : undefined;
  const result = await uploadSignedPermissionSlip(
    session.user.sub,
    slipId,
    base64,
    validPayment
  );
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}

/** For payment-only events: parent confirms payment method without uploading PDF. */
export async function submitPaymentMethodAction(
  slipId: string,
  paymentMethod: "online" | "cash"
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await submitPaymentMethodOnly(
    session.user.sub,
    slipId,
    paymentMethod
  );
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}

export async function markInboxItemAsReadAction(
  slipId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }
  return markInboxItemAsRead(session.user.sub, slipId);
}

export async function unsubmitSlipAction(
  slipId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await unsubmitPermissionSlip(session.user.sub, slipId);
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}

export async function uploadPermissionSlipForStudentAction(
  eventId: string,
  classId: string,
  studentId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const file = formData.get("pdf") as File | null;
  if (!file || !(file instanceof File)) {
    return { success: false, error: "Please select a PDF file" };
  }
  if (file.type !== "application/pdf") {
    return { success: false, error: "File must be a PDF" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "File must be under 5MB" };
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const paymentMethod = formData.get("paymentMethod") as string | null;
  const validPayment =
    paymentMethod === "online" || paymentMethod === "cash"
      ? paymentMethod
      : undefined;

  const result = await uploadPermissionSlipForStudent(
    session.user.sub,
    eventId,
    classId,
    studentId,
    base64,
    validPayment
  );
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}

export async function markCashReceivedAction(
  slipId: string,
  received: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await markCashReceived(
    session.user.sub,
    slipId,
    received
  );
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}

export async function leaveClassAction(
  classId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await leaveClass(session.user.sub, classId);
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}

export async function addStudentsAction(
  classId: string,
  names: string[],
  grade?: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await addStudentsToClass(
    session.user.sub,
    classId,
    names,
    grade ?? ""
  );
  return result.success
    ? { success: true, count: result.count }
    : { success: false, error: result.error };
}

export async function linkGuardianAction(
  classId: string,
  studentId: string,
  guardianId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await linkGuardianToStudent(
    session.user.sub,
    classId,
    studentId,
    guardianId
  );
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}

export async function uploadEventPermissionFormAction(
  eventId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const file = formData.get("pdf") as File | null;
  if (!file || !(file instanceof File)) {
    return { success: false, error: "Please select a PDF file" };
  }
  if (file.type !== "application/pdf") {
    return { success: false, error: "File must be a PDF" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "File must be under 5MB" };
  }

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const result = await uploadEventPermissionForm(
    session.user.sub,
    eventId,
    base64
  );
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}

export async function unlinkGuardianAction(
  classId: string,
  studentId: string,
  guardianId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await unlinkGuardianFromStudent(
    session.user.sub,
    classId,
    studentId,
    guardianId
  );
  return result.success
    ? { success: true }
    : { success: false, error: result.error };
}

// --- Report cards ---

export async function getReportCardsAction(
  studentId: string
): Promise<
  { success: true; reportCards: Awaited<ReturnType<typeof getReportCardsForStudent>> } | { success: false; error?: string }
> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const reportCards = await getReportCardsForStudent(
    session.user.sub,
    studentId
  );
  return { success: true, reportCards };
}

export async function createReportCardAction(
  formData: FormData
): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const studentId = formData.get("studentId") as string | null;
  const term = formData.get("term") as string | null;
  const file = formData.get("pdf") as File | null;

  if (!studentId || !term?.trim()) {
    return { success: false, error: "Student and term are required" };
  }
  if (!file || !(file instanceof File) || file.size === 0) {
    return { success: false, error: "Please select a PDF file" };
  }
  if (file.type !== "application/pdf") {
    return { success: false, error: "File must be a PDF" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "File must be under 5MB" };
  }

  const buffer = await file.arrayBuffer();
  const pdfBase64 = Buffer.from(buffer).toString("base64");

  const result = await createReportCard(session.user.sub, {
    studentId,
    term: term.trim(),
    pdfBase64,
  });
  return result.success
    ? { success: true, id: result.id }
    : { success: false, error: result.error };
}

export async function updateReportCardPdfAction(
  reportCardId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const file = formData.get("pdf") as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { success: false, error: "Please select a PDF file" };
  }
  if (file.type !== "application/pdf") {
    return { success: false, error: "File must be a PDF" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "File must be under 5MB" };
  }

  const buffer = await file.arrayBuffer();
  const pdfBase64 = Buffer.from(buffer).toString("base64");

  return updateReportCardPdf(session.user.sub, reportCardId, pdfBase64);
}

export async function publishReportCardAction(
  reportCardId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  return publishReportCard(session.user.sub, reportCardId);
}

// --- Interview slots ---

export async function createInterviewSlotsAction(
  classId: string,
  slots: { startAt: string; endAt: string }[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await createInterviewSlots(
    session.user.sub,
    classId,
    slots
  );
  return result.success
    ? { success: true, count: result.count }
    : { success: false, error: result.error };
}

export async function claimInterviewSlotAction(
  slotId: string,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  return claimInterviewSlot(session.user.sub, slotId, studentId);
}

export async function unclaimInterviewSlotAction(
  slotId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  return unclaimInterviewSlot(session.user.sub, slotId);
}

export async function deleteInterviewSlotAction(
  slotId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }
  return deleteInterviewSlot(session.user.sub, slotId);
}

export async function deleteAllInterviewSlotsForClassAction(
  classId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }
  return deleteAllInterviewSlotsForClass(session.user.sub, classId);
}

export async function bookInterviewSlotManuallyAction(
  slotId: string,
  studentId: string,
  parentName: string,
  parentEmail?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }
  return bookInterviewSlotManually(
    session.user.sub,
    slotId,
    studentId,
    parentName,
    parentEmail ?? ""
  );
}

export async function unbookInterviewSlotAction(
  slotId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }
  return unbookInterviewSlot(session.user.sub, slotId);
}

// --- Messaging ---

export async function getOrCreateConversationAction(
  guardianId: string,
  studentId: string,
  schoolId: string
): Promise<
  | { success: true; conversationId: string }
  | { success: false; error: string }
> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }
  return getOrCreateConversation(
    session.user.sub,
    guardianId,
    studentId,
    schoolId
  );
}

export async function getMessagesAction(
  conversationId: string
): Promise<{ success: true; messages: import("@/lib/messaging").MessageSerialized[] } | { success: false; error: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }
  const messages = await getMessages(session.user.sub, conversationId);
  return { success: true, messages };
}

export async function sendMessageAction(
  conversationId: string,
  body: string
): Promise<
  | { success: true; messageId: string }
  | { success: false; error: string }
> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }
  return sendMessage(session.user.sub, conversationId, body);
}
