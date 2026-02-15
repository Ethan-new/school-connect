import { ObjectId } from "mongodb";
import type { CalendarEventVisibility } from "./db/types";
import type { CalendarEvent } from "./db/types";
import {
  calendarEventsCollection,
  classesCollection,
  eventPermissionSlipsCollection,
  studentsCollection,
} from "./db/collections";
import { isDbConfigured } from "./db";

/** Effective cost for payment/permission: recurring uses costPerOccurrence × dates, else cost */
export function getEventEffectiveCost(
  event: Pick<CalendarEvent, "cost" | "occurrenceDates" | "costPerOccurrence">
): number | undefined {
  const dates = event.occurrenceDates;
  const perOcc = event.costPerOccurrence;
  if (dates && dates.length > 1 && perOcc != null && perOcc > 0) {
    return perOcc * dates.length;
  }
  return event.cost != null && event.cost > 0 ? event.cost : undefined;
}

export interface CreateEventInput {
  schoolId: string;
  classId: string | null;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  visibility: CalendarEventVisibility;
  requiresPermissionSlip?: boolean;
  /** Cost in dollars. For recurring, use costPerOccurrence + occurrenceDates instead. */
  cost?: number;
  /** Recurring: cost per occurrence (e.g. $5 per pizza day) */
  costPerOccurrence?: number;
  /** Recurring: occurrence dates (YYYY-MM-DD). When set with costPerOccurrence, total = costPerOccurrence × length */
  occurrenceDates?: string[];
  /** Due date for form and payment (YYYY-MM-DD). Parents must submit by this date. */
  permissionSlipDueDate?: string;
}

/**
 * Creates a calendar event. Verifies the teacher owns the class/school.
 */
export async function createCalendarEvent(
  auth0Id: string,
  input: CreateEventInput
): Promise<{ success: true; eventId: string } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  const title = input.title.trim();
  if (!title) return { success: false, error: "Title is required" };
  if (title.length > 200) return { success: false, error: "Title is too long" };

  if (!input.startAt) return { success: false, error: "Start date is required" };
  if (!input.endAt) return { success: false, error: "End date is required" };

  const start = new Date(input.startAt);
  const end = new Date(input.endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { success: false, error: "Invalid date format" };
  }
  if (end <= start) {
    return { success: false, error: "End time must be after start time" };
  }

  if (!["class", "school", "private"].includes(input.visibility)) {
    return { success: false, error: "Invalid visibility" };
  }

  try {
    const classes = await classesCollection();
    const teacherClasses = await classes
      .find({ teacherIds: auth0Id })
      .toArray();

    const teacherSchoolIds = [...new Set(teacherClasses.map((c) => c.schoolId))];
    const teacherClassIds = teacherClasses
      .map((c) => c._id?.toString())
      .filter((id): id is string => Boolean(id));

    if (!teacherSchoolIds.includes(input.schoolId)) {
      return { success: false, error: "You don't have access to this school" };
    }

    if (input.classId) {
      if (!teacherClassIds.includes(input.classId)) {
        return { success: false, error: "You don't have access to this class" };
      }
      if (input.visibility !== "class" && input.visibility !== "school") {
        return { success: false, error: "Class events must be class or school visibility" };
      }
    } else {
      if (input.visibility !== "school") {
        return { success: false, error: "School-wide events need school visibility" };
      }
    }

    const events = await calendarEventsCollection();
    const occurrenceDates =
      input.occurrenceDates?.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) ?? [];
    const isRecurring = occurrenceDates.length > 1;

    const cost = isRecurring
      ? undefined
      : input.cost != null && input.cost > 0
        ? input.cost
        : undefined;
    const costPerOccurrence =
      isRecurring &&
      input.costPerOccurrence != null &&
      input.costPerOccurrence > 0
        ? input.costPerOccurrence
        : undefined;
    const storedOccurrenceDates = isRecurring ? occurrenceDates.sort() : undefined;

    const permissionSlipDueDate = input.permissionSlipDueDate?.match(/^\d{4}-\d{2}-\d{2}$/)
      ? input.permissionSlipDueDate
      : undefined;

    const result = await events.insertOne({
      schoolId: input.schoolId,
      classId: input.classId ?? null,
      title,
      description: input.description?.trim() || undefined,
      startAt: input.startAt,
      endAt: input.endAt,
      visibility: input.visibility,
      requiresPermissionSlip: input.requiresPermissionSlip ?? false,
      cost,
      occurrenceDates: storedOccurrenceDates,
      costPerOccurrence,
      permissionSlipDueDate,
      createdAt: new Date(),
    });

    const eventId = result.insertedId?.toString();
    if (input.classId && eventId) {
      const cls = await classes.findOne({
        _id: new ObjectId(input.classId),
      });
      const studentIds = cls?.studentIds ?? [];
      if (studentIds.length > 0) {
        const students = await studentsCollection();
        const studentDocs = await students
          .find({
            _id: {
              $in: studentIds
                .filter((id) => /^[a-f0-9]{24}$/i.test(id))
                .map((id) => new ObjectId(id)),
            },
          })
          .toArray();

        const slipsToInsert: Array<{
          eventId: string;
          classId: string;
          studentId: string;
          guardianId: string;
          status: "pending";
          createdAt: Date;
        }> = [];

        for (const student of studentDocs) {
          const guardianIds = student.guardianIds ?? [];
          for (const guardianId of guardianIds) {
            slipsToInsert.push({
              eventId,
              classId: input.classId!,
              studentId: student._id?.toString() ?? "",
              guardianId,
              status: "pending",
              createdAt: new Date(),
            });
          }
        }

        if (slipsToInsert.length > 0) {
          const slips = await eventPermissionSlipsCollection();
          await slips.insertMany(slipsToInsert);
        }
      }
    }

    return { success: true, eventId: eventId ?? "" };
  } catch (error) {
    console.error("[createCalendarEvent] Failed:", error);
    return { success: false, error: "Failed to create event. Please try again." };
  }
}

export interface UpdateEventInput {
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

/**
 * Updates a calendar event. Verifies the teacher owns the class/school.
 */
export async function updateCalendarEvent(
  auth0Id: string,
  eventId: string,
  input: UpdateEventInput
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  try {
    const events = await calendarEventsCollection();
    const classes = await classesCollection();

    const event = await events.findOne({ _id: new ObjectId(eventId) });
    if (!event) return { success: false, error: "Event not found" };

    const teacherClasses = await classes
      .find({ teacherIds: auth0Id })
      .toArray();
    const teacherSchoolIds = new Set(teacherClasses.map((c) => c.schoolId));
    const teacherClassIds = new Set(
      teacherClasses
        .map((c) => c._id?.toString())
        .filter((id): id is string => Boolean(id))
    );

    if (!teacherSchoolIds.has(event.schoolId)) {
      return { success: false, error: "You don't have access to this event" };
    }
    if (
      event.classId &&
      !teacherClassIds.has(event.classId)
    ) {
      return { success: false, error: "You don't have access to this event" };
    }

    const update: Record<string, unknown> = {};
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) return { success: false, error: "Title is required" };
      if (title.length > 200) return { success: false, error: "Title is too long" };
      update.title = title;
    }
    if (input.description !== undefined) {
      update.description = input.description?.trim() || undefined;
    }
    if (input.startAt !== undefined) {
      if (!input.startAt) return { success: false, error: "Start date is required" };
      const start = new Date(input.startAt);
      if (isNaN(start.getTime())) return { success: false, error: "Invalid start date" };
      update.startAt = input.startAt;
    }
    if (input.endAt !== undefined) {
      if (!input.endAt) return { success: false, error: "End date is required" };
      const end = new Date(input.endAt);
      if (isNaN(end.getTime())) return { success: false, error: "Invalid end date" };
      const start = new Date((update.startAt as string) ?? event.startAt);
      if (end <= start) {
        return { success: false, error: "End time must be after start time" };
      }
      update.endAt = input.endAt;
    }
    if (input.requiresPermissionSlip !== undefined) {
      update.requiresPermissionSlip = input.requiresPermissionSlip;
    }
    if (input.cost !== undefined) {
      if (input.cost != null && input.cost > 0) {
        update.cost = input.cost;
      } else {
        update.cost = null;
      }
    }
    if (input.costPerOccurrence !== undefined) {
      if (input.costPerOccurrence != null && input.costPerOccurrence > 0) {
        update.costPerOccurrence = input.costPerOccurrence;
      } else {
        update.costPerOccurrence = null;
      }
    }
    if (input.occurrenceDates !== undefined) {
      if (
        Array.isArray(input.occurrenceDates) &&
        input.occurrenceDates.length > 1
      ) {
        update.occurrenceDates = input.occurrenceDates
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
          .sort();
      } else {
        update.occurrenceDates = null;
      }
    }
    if (input.permissionSlipDueDate !== undefined) {
      update.permissionSlipDueDate =
        input.permissionSlipDueDate?.match(/^\d{4}-\d{2}-\d{2}$/) ?? null;
    }

    if (Object.keys(update).length === 0) {
      return { success: true };
    }

    const updateDoc: Record<string, unknown> = {};
    const unsetDoc: Record<string, string> = {};
    for (const [key, value] of Object.entries(update)) {
      if (value === null || value === undefined) {
        unsetDoc[key] = "";
      } else {
        updateDoc[key] = value;
      }
    }
    const mongoUpdate: Record<string, unknown> = {};
    if (Object.keys(updateDoc).length > 0) mongoUpdate.$set = updateDoc;
    if (Object.keys(unsetDoc).length > 0) mongoUpdate.$unset = unsetDoc;

    await events.updateOne(
      { _id: new ObjectId(eventId) },
      mongoUpdate
    );

    return { success: true };
  } catch (error) {
    console.error("[updateCalendarEvent] Failed:", error);
    return { success: false, error: "Failed to update event. Please try again." };
  }
}

/**
 * Deletes a calendar event and its permission slips. Verifies the teacher owns the class/school.
 */
export async function deleteCalendarEvent(
  auth0Id: string,
  eventId: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  if (!eventId || !/^[a-f0-9]{24}$/i.test(eventId)) {
    return { success: false, error: "Invalid event" };
  }

  try {
    const events = await calendarEventsCollection();
    const classes = await classesCollection();

    const event = await events.findOne({ _id: new ObjectId(eventId) });
    if (!event) return { success: false, error: "Event not found" };

    const teacherClasses = await classes
      .find({ teacherIds: auth0Id })
      .toArray();
    const teacherSchoolIds = new Set(teacherClasses.map((c) => c.schoolId));
    const teacherClassIds = new Set(
      teacherClasses
        .map((c) => c._id?.toString())
        .filter((id): id is string => Boolean(id))
    );

    if (!teacherSchoolIds.has(event.schoolId)) {
      return { success: false, error: "You don't have access to this event" };
    }
    if (
      event.classId &&
      !teacherClassIds.has(event.classId)
    ) {
      return { success: false, error: "You don't have access to this event" };
    }

    const slips = await eventPermissionSlipsCollection();
    await slips.deleteMany({ eventId });

    await events.deleteOne({ _id: new ObjectId(eventId) });

    return { success: true };
  } catch (error) {
    console.error("[deleteCalendarEvent] Failed:", error);
    return { success: false, error: "Failed to delete event. Please try again." };
  }
}

/**
 * Uploads a custom permission form PDF for an event. Verifies the teacher owns the class.
 */
export async function uploadEventPermissionForm(
  auth0Id: string,
  eventId: string,
  pdfBase64: string
): Promise<{ success: true } | { success: false; error: string }> {
  if (!isDbConfigured()) {
    return { success: false, error: "Database not configured" };
  }

  if (!pdfBase64 || pdfBase64.length > 10_000_000) {
    return { success: false, error: "Invalid or too large PDF (max ~7MB)" };
  }

  try {
    const events = await calendarEventsCollection();
    const classes = await classesCollection();

    const event = await events.findOne({
      _id: new ObjectId(eventId),
    });
    if (!event) return { success: false, error: "Event not found" };
    if (!event.requiresPermissionSlip) {
      return { success: false, error: "Event does not require permission slips" };
    }

    const classId = event.classId;
    if (!classId) return { success: false, error: "Event has no class" };

    const cls = await classes.findOne({ _id: new ObjectId(classId) });
    if (!cls) return { success: false, error: "Class not found" };
    if (!cls.teacherIds?.includes(auth0Id)) {
      return { success: false, error: "You don't have access to this event" };
    }

    await events.updateOne(
      { _id: new ObjectId(eventId) },
      { $set: { permissionFormPdfBase64: pdfBase64 } }
    );

    return { success: true };
  } catch (error) {
    console.error("[uploadEventPermissionForm] Failed:", error);
    return { success: false, error: "Failed to upload. Please try again." };
  }
}
