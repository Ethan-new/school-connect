import { ObjectId } from "mongodb";
import {
  eventPermissionSlipsCollection,
  calendarEventsCollection,
  classesCollection,
  studentsCollection,
  usersCollection,
} from "./db/collections";
import { isDbConfigured } from "./db";
import { getEventEffectiveCost } from "./calendar-events";

export interface EventPermissionStatusByStudent {
  studentId: string;
  studentName: string;
  status: "pending" | "signed" | "no_parent";
  signedBy?: string;
  /** Slip ID when signed; used by teachers to view the submitted PDF */
  slipId?: string;
  /** How parent will pay (when event has cost) */
  paymentMethod?: "online" | "cash";
  /** Teacher has marked cash as received (when paymentMethod=cash) */
  cashReceived?: boolean;
}

export interface EventPermissionStatus {
  eventId: string;
  eventTitle: string;
  eventStartAt: string;
  classId: string;
  className: string;
  students: EventPermissionStatusByStudent[];
  pendingCount: number;
  signedCount: number;
}

export interface PermissionSlipTask {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  eventStartAt: string;
  className: string;
  studentId?: string;
  studentName?: string;
  /** Cost in dollars. When set, parent must choose payment method. */
  cost?: number;
  /** Recurring: all occurrence dates (YYYY-MM-DD) */
  occurrenceDates?: string[];
  /** When true, parent must upload signed PDF; when false, only payment method is needed */
  requiresPermissionSlip?: boolean;
  /** When true, teacher has uploaded a permission form PDF for parents to sign */
  hasPermissionForm?: boolean;
}

export interface InboxItem {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  eventStartAt: string;
  eventEndAt: string;
  className: string;
  studentId?: string;
  studentName?: string;
  status: "unread" | "completed";
  /** Cost in dollars. When set, parent must choose payment method. */
  cost?: number;
  /** How parent will pay (when event has cost) */
  paymentMethod?: "online" | "cash";
  /** Recurring: all occurrence dates (YYYY-MM-DD) */
  occurrenceDates?: string[];
  /** When true, parent must upload signed PDF; when false, only payment method is needed */
  requiresPermissionSlip?: boolean;
  /** When true, teacher has uploaded a permission form PDF for parents to sign */
  hasPermissionForm?: boolean;
}

/**
 * Fetches pending permission slip tasks for a parent.
 */
export async function getParentPermissionSlipTasks(
  auth0Id: string
): Promise<PermissionSlipTask[]> {
  if (!isDbConfigured()) return [];

  try {
    const slips = await eventPermissionSlipsCollection();
    const events = await calendarEventsCollection();

    const pendingSlips = await slips
      .find({ guardianId: auth0Id, status: "pending" })
      .toArray();

    if (pendingSlips.length === 0) return [];

    const eventIds = [...new Set(pendingSlips.map((s) => s.eventId))];
    const eventDocs = await events
      .find({
        _id: {
          $in: eventIds
            .filter((id) => /^[a-f0-9]{24}$/i.test(id))
            .map((id) => new ObjectId(id)),
        },
      })
      .toArray();
    const eventMap = new Map(
      eventDocs.map((e) => [e._id?.toString(), e])
    );

    const classIds = [...new Set(pendingSlips.map((s) => s.classId))];
    const classes = await classesCollection();
    const classDocs = await classes
      .find({
        _id: {
          $in: classIds
            .filter((id) => /^[a-f0-9]{24}$/i.test(id))
            .map((id) => new ObjectId(id)),
        },
      })
      .toArray();
    const classMap = new Map(
      classDocs.map((c) => [c._id?.toString(), c])
    );

    const studentIds = [
      ...new Set(
        pendingSlips
          .map((s) => s.studentId)
          .filter((id): id is string => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id))
      ),
    ];
    const students = await studentsCollection();
    const studentDocs =
      studentIds.length > 0
        ? await students
            .find({
              _id: { $in: studentIds.map((id) => new ObjectId(id)) },
            })
            .toArray()
        : [];
    const studentMap = new Map(
      studentDocs.map((s) => [s._id?.toString(), s])
    );

    const tasks: PermissionSlipTask[] = [];
    for (const slip of pendingSlips) {
      const event = eventMap.get(slip.eventId);
      const cls = classMap.get(slip.classId);
      const student = slip.studentId
        ? studentMap.get(slip.studentId)
        : undefined;
      const effectiveCost = event ? getEventEffectiveCost(event) : undefined;
      const hasCost = effectiveCost != null && effectiveCost > 0;
      if (event && cls && (event.requiresPermissionSlip || hasCost)) {
        tasks.push({
          id: slip._id?.toString() ?? slip.eventId,
          eventId: slip.eventId,
          eventTitle: event.title,
          eventDescription: event.description,
          eventStartAt: event.startAt,
          className: cls.name,
          studentId: slip.studentId,
          studentName: student?.name,
          cost: effectiveCost,
          occurrenceDates: event.occurrenceDates,
          requiresPermissionSlip: event.requiresPermissionSlip ?? false,
          hasPermissionForm: Boolean(event.permissionFormPdfBase64),
        });
      }
    }
    return tasks;
  } catch (error) {
    console.error("[getParentPermissionSlipTasks] Failed:", error);
    return [];
  }
}

/**
 * Fetches all permission slip inbox items for a parent (pending + completed).
 */
export async function getParentInboxItems(
  auth0Id: string
): Promise<InboxItem[]> {
  if (!isDbConfigured()) return [];

  try {
    const slips = await eventPermissionSlipsCollection();
    const events = await calendarEventsCollection();
    const classes = await classesCollection();
    const students = await studentsCollection();

    const allSlips = await slips
      .find({ guardianId: auth0Id })
      .sort({ createdAt: -1 })
      .toArray();

    if (allSlips.length === 0) return [];

    const eventIds = [...new Set(allSlips.map((s) => s.eventId))];
    const eventDocs = await events
      .find({
        _id: {
          $in: eventIds
            .filter((id) => /^[a-f0-9]{24}$/i.test(id))
            .map((id) => new ObjectId(id)),
        },
      })
      .toArray();
    const eventMap = new Map(
      eventDocs.map((e) => [e._id?.toString(), e])
    );

    const classIds = [...new Set(allSlips.map((s) => s.classId))];
    const classDocs = await classes
      .find({
        _id: {
          $in: classIds
            .filter((id) => /^[a-f0-9]{24}$/i.test(id))
            .map((id) => new ObjectId(id)),
        },
      })
      .toArray();
    const classMap = new Map(
      classDocs.map((c) => [c._id?.toString(), c])
    );

    const studentIds = [
      ...new Set(
        allSlips
          .map((s) => s.studentId)
          .filter((id): id is string => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id))
      ),
    ];
    const studentDocs =
      studentIds.length > 0
        ? await students
            .find({
              _id: { $in: studentIds.map((id) => new ObjectId(id)) },
            })
            .toArray()
        : [];
    const studentMap = new Map(
      studentDocs.map((s) => [s._id?.toString(), s])
    );

    const items: InboxItem[] = [];
    for (const slip of allSlips) {
      const event = eventMap.get(slip.eventId);
      const cls = classMap.get(slip.classId);
      const student = slip.studentId
        ? studentMap.get(slip.studentId)
        : undefined;
      const effectiveCost = event ? getEventEffectiveCost(event) : undefined;
      const hasCost = effectiveCost != null && effectiveCost > 0;
      if (event && cls && (event.requiresPermissionSlip || hasCost)) {
        items.push({
          id: slip._id?.toString() ?? slip.eventId,
          eventId: slip.eventId,
          eventTitle: event.title,
          eventDescription: event.description,
          eventStartAt: event.startAt,
          eventEndAt: event.endAt,
          className: cls.name,
          studentId: slip.studentId,
          studentName: student?.name,
          status: slip.status === "signed" ? "completed" : "unread",
          cost: effectiveCost,
          paymentMethod: slip.paymentMethod,
          occurrenceDates: event.occurrenceDates,
          requiresPermissionSlip: event.requiresPermissionSlip ?? false,
          hasPermissionForm: Boolean(event.permissionFormPdfBase64),
        });
      }
    }
    return items;
  } catch (error) {
    console.error("[getParentInboxItems] Failed:", error);
    return [];
  }
}

/**
 * For payment-only events (no permission slip required): parent confirms payment method
 * without uploading a PDF. Marks slip as signed with the selected payment method.
 */
export async function submitPaymentMethodOnly(
  auth0Id: string,
  slipId: string,
  paymentMethod: "online" | "cash"
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const slips = await eventPermissionSlipsCollection();
    const slip = await slips.findOne({
      _id: new ObjectId(slipId),
      guardianId: auth0Id,
      status: "pending",
    });
    if (!slip) {
      return {
        success: false,
        error: "Item not found or already completed",
      };
    }

    const events = await calendarEventsCollection();
    const event = await events.findOne({ _id: new ObjectId(slip.eventId) });
    if (!event) {
      return { success: false, error: "Event not found" };
    }

    if (event.requiresPermissionSlip) {
      return {
        success: false,
        error: "This event requires a signed permission form. Please upload the PDF.",
      };
    }

    const effectiveCost = getEventEffectiveCost(event);
    if (!effectiveCost || effectiveCost <= 0) {
      return {
        success: false,
        error: "This event has no cost. No payment method needed.",
      };
    }

    const updateResult = await slips.updateOne(
      { _id: new ObjectId(slipId), guardianId: auth0Id, status: "pending" },
      {
        $set: {
          status: "signed",
          signedAt: new Date(),
          paymentMethod,
        },
      }
    );
    if (updateResult.matchedCount === 0) {
      return {
        success: false,
        error: "Item not found or already completed",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[submitPaymentMethodOnly] Failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Uploads a signed PDF and marks the permission slip as signed.
 */
export async function uploadSignedPermissionSlip(
  auth0Id: string,
  slipId: string,
  pdfBase64: string,
  paymentMethod?: "online" | "cash"
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  if (!pdfBase64 || pdfBase64.length > 2_000_000) {
    return { success: false, error: "Invalid or too large PDF" };
  }

  try {
    const slips = await eventPermissionSlipsCollection();
    const slip = await slips.findOne({
      _id: new ObjectId(slipId),
      guardianId: auth0Id,
      status: "pending",
    });
    if (!slip) {
      return { success: false, error: "Permission slip not found or already signed" };
    }
    const events = await calendarEventsCollection();
    const event = await events.findOne({ _id: new ObjectId(slip.eventId) });
    const effectiveCost = event ? getEventEffectiveCost(event) : undefined;
    const hasCost = effectiveCost != null && effectiveCost > 0;
    if (hasCost && !paymentMethod) {
      return { success: false, error: "Please select how you will pay (online or cash)" };
    }

    const update: Record<string, unknown> = {
      status: "signed",
      signedAt: new Date(),
      signedPdfBase64: pdfBase64,
    };
    if (paymentMethod) update.paymentMethod = paymentMethod;

    const updateResult = await slips.updateOne(
      { _id: new ObjectId(slipId), guardianId: auth0Id, status: "pending" },
      { $set: update }
    );
    if (updateResult.matchedCount === 0) {
      return { success: false, error: "Permission slip not found or already signed" };
    }

    return { success: true };
  } catch (error) {
    console.error("[uploadSignedPermissionSlip] Failed:", error);
    return { success: false, error: "Failed to upload. Please try again." };
  }
}

/**
 * Revokes a signed permission slip so the parent can re-upload a different PDF.
 */
export async function unsubmitPermissionSlip(
  auth0Id: string,
  slipId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const slips = await eventPermissionSlipsCollection();
    const result = await slips.updateOne(
      {
        _id: new ObjectId(slipId),
        guardianId: auth0Id,
        status: "signed",
      },
      {
        $set: { status: "pending" },
        $unset: { signedAt: "", signedPdfBase64: "" },
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "Permission slip not found or not yet signed" };
    }

    return { success: true };
  } catch (error) {
    console.error("[unsubmitPermissionSlip] Failed:", error);
    return { success: false, error: "Failed to unsubmit. Please try again." };
  }
}

/**
 * Fetches permission slip status per student for events. Used by teacher dashboard.
 */
export async function getEventPermissionSlipStatus(
  eventIds: string[]
): Promise<EventPermissionStatus[]> {
  if (!isDbConfigured() || eventIds.length === 0) return [];

  const validIds = eventIds.filter((id) => /^[a-f0-9]{24}$/i.test(id));
  if (validIds.length === 0) return [];

  try {
    const slips = await eventPermissionSlipsCollection();
    const events = await calendarEventsCollection();
    const classes = await classesCollection();
    const students = await studentsCollection();
    const users = await usersCollection();

    const allSlips = await slips
      .find({ eventId: { $in: validIds } })
      .toArray();

    const eventDocs = await events
      .find({
        _id: { $in: validIds.map((id) => new ObjectId(id)) },
      })
      .toArray();
    const eventMap = new Map(
      eventDocs.map((e) => [e._id?.toString(), e])
    );

    const classIds = [...new Set(eventDocs.map((e) => e.classId).filter(Boolean))];
    const classDocs = await classes
      .find({
        _id: {
          $in: classIds
            .filter((id): id is string => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id))
            .map((id) => new ObjectId(id)),
        },
      })
      .toArray();
    const classMap = new Map(classDocs.map((c) => [c._id?.toString(), c]));

    const studentIds = [...new Set(classDocs.flatMap((c) => c.studentIds ?? []))];
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
    const studentMap = new Map(
      studentDocs.map((s) => [s._id?.toString(), s])
    );

    const guardianIds = [...new Set(allSlips.map((s) => s.guardianId))];
    const guardianDocs =
      guardianIds.length > 0
        ? await users.find({ auth0Id: { $in: guardianIds } }).toArray()
        : [];
    const guardianMap = new Map(
      guardianDocs.map((u) => [u.auth0Id, u.name ?? u.email ?? "Unknown"])
    );

    const result: EventPermissionStatus[] = [];

    for (const eventId of validIds) {
      const event = eventMap.get(eventId);
      const cls = event?.classId
        ? classMap.get(event.classId)
        : undefined;
      if (!event || !cls) continue;

      const eventSlips = allSlips.filter((s) => s.eventId === eventId);
      const classStudentIds = cls.studentIds ?? [];
      const studentStatuses: EventPermissionStatusByStudent[] = [];

      for (const studentId of classStudentIds) {
        const student = studentMap.get(studentId);
        const studentSlips = eventSlips.filter((s) => s.studentId === studentId);

        if (studentSlips.length === 0) {
          studentStatuses.push({
            studentId,
            studentName: student?.name ?? "Unknown",
            status: "no_parent",
          });
          continue;
        }

        const signedSlip = studentSlips.find((s) => s.status === "signed");
        const status: "pending" | "signed" = signedSlip ? "signed" : "pending";
        const signedBy = signedSlip
          ? cls.teacherIds?.includes(signedSlip.guardianId)
            ? "Parent"
            : guardianMap.get(signedSlip.guardianId)
          : undefined;
        const slipId = signedSlip?._id?.toString();
        const isTeacherUploaded = signedSlip
          ? cls.teacherIds?.includes(signedSlip.guardianId)
          : false;
        const paymentMethod =
          signedSlip?.paymentMethod ??
          (isTeacherUploaded ? "cash" : undefined);
        const cashReceived = Boolean(signedSlip?.cashReceivedAt);

        studentStatuses.push({
          studentId,
          studentName: student?.name ?? "Unknown",
          status,
          signedBy,
          slipId,
          paymentMethod,
          cashReceived,
        });
      }

      result.push({
        eventId,
        eventTitle: event.title,
        eventStartAt: event.startAt,
        classId: cls._id?.toString() ?? event.classId ?? "",
        className: cls.name,
        students: studentStatuses,
        pendingCount: studentStatuses.filter(
          (s) => s.status === "pending" || s.status === "no_parent"
        ).length,
        signedCount: studentStatuses.filter((s) => s.status === "signed").length,
      });
    }

    return result;
  } catch (error) {
    console.error("[getEventPermissionSlipStatus] Failed:", error);
    return [];
  }
}

/**
 * Teacher manually uploads a signed PDF for a student with no parent linked.
 * Creates a new slip with the teacher as the "submitter".
 */
export async function uploadPermissionSlipForStudent(
  teacherAuth0Id: string,
  eventId: string,
  classId: string,
  studentId: string,
  pdfBase64: string,
  paymentMethod?: "online" | "cash"
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }
  if (!pdfBase64 || pdfBase64.length > 2_000_000) {
    return { success: false, error: "Invalid or too large PDF" };
  }

  try {
    const classes = await classesCollection();
    const cls = await classes.findOne({
      _id: new ObjectId(classId),
    });
    if (!cls || !cls.teacherIds?.includes(teacherAuth0Id)) {
      return { success: false, error: "Class not found or access denied" };
    }
    if (!cls.studentIds?.includes(studentId)) {
      return { success: false, error: "Student not in this class" };
    }

    const events = await calendarEventsCollection();
    const event = await events.findOne({
      _id: new ObjectId(eventId),
    });
    if (!event) {
      return { success: false, error: "Event not found" };
    }
    const eventClassId = event.classId ?? undefined;
    if (eventClassId && eventClassId !== classId) {
      return { success: false, error: "Event class mismatch" };
    }
    const effectiveCost = getEventEffectiveCost(event);
    const hasCost = effectiveCost != null && effectiveCost > 0;
    const resolvedPaymentMethod =
      paymentMethod ?? (hasCost ? "cash" : undefined);

    const slips = await eventPermissionSlipsCollection();
    const existingSlip = await slips.findOne({
      eventId,
      studentId,
    });
    if (existingSlip?.status === "signed") {
      return { success: false, error: "Already has a submitted slip" };
    }

    const slipData: Record<string, unknown> = {
      status: "signed",
      signedAt: new Date(),
      signedPdfBase64: pdfBase64,
    };
    if (resolvedPaymentMethod) slipData.paymentMethod = resolvedPaymentMethod;

    if (existingSlip) {
      await slips.updateOne(
        { _id: existingSlip._id },
        { $set: slipData }
      );
    } else {
      await slips.insertOne({
        eventId,
        classId,
        studentId,
        guardianId: teacherAuth0Id,
        status: "signed",
        signedAt: new Date(),
        signedPdfBase64: pdfBase64,
        ...(resolvedPaymentMethod && { paymentMethod: resolvedPaymentMethod }),
        createdAt: new Date(),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("[uploadPermissionSlipForStudent] Failed:", error);
    return { success: false, error: "Failed to upload. Please try again." };
  }
}

/**
 * Teacher marks cash as received (or toggles off) for a slip with paymentMethod=cash.
 */
export async function markCashReceived(
  teacherAuth0Id: string,
  slipId: string,
  received: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const slips = await eventPermissionSlipsCollection();
    const slip = await slips.findOne({ _id: new ObjectId(slipId) });
    if (!slip) {
      return { success: false, error: "Permission slip not found" };
    }
    if (slip.status !== "signed") {
      return { success: false, error: "Slip must be signed" };
    }

    const classes = await classesCollection();
    const cls = await classes.findOne({
      _id: new ObjectId(slip.classId),
    });
    if (!cls || !cls.teacherIds?.includes(teacherAuth0Id)) {
      return { success: false, error: "Class not found or access denied" };
    }

    const isTeacherUploaded = slip.guardianId === teacherAuth0Id;
    const isCashPayment =
      slip.paymentMethod === "cash" ||
      (isTeacherUploaded && !slip.paymentMethod);
    if (!isCashPayment) {
      return { success: false, error: "Only cash payments can be marked as received" };
    }

    if (received) {
      await slips.updateOne(
        { _id: new ObjectId(slipId) },
        { $set: { cashReceivedAt: new Date() } }
      );
    } else {
      await slips.updateOne(
        { _id: new ObjectId(slipId) },
        { $unset: { cashReceivedAt: "" } }
      );
    }

    return { success: true };
  } catch (error) {
    console.error("[markCashReceived] Failed:", error);
    return { success: false, error: "Failed to update. Please try again." };
  }
}
