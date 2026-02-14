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
} from "@/lib/event-permission-slips";
import {
  addStudentsToClass,
  linkGuardianToStudent,
  unlinkGuardianFromStudent,
} from "@/lib/class-students";
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
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await createCalendarEvent(session.user.sub, input);
  return result.success
    ? { success: true }
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
