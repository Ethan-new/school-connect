import { ObjectId } from "mongodb";
import type { Class, CalendarEvent } from "./db/types";
import {
  classesCollection,
  schoolsCollection,
  calendarEventsCollection,
  usersCollection,
} from "./db/collections";
import { isDbConfigured } from "./db";
import { getClassStudentsWithGuardians } from "./class-students";
import {
  getEventPermissionSlipStatus,
  type EventPermissionStatus,
} from "./event-permission-slips";
import { getEventEffectiveCost } from "./calendar-events";

export interface TeacherClassWithSchool extends Class {
  schoolName: string;
}

export interface ClassStudentSerialized {
  id: string;
  name: string;
  grade: string;
  guardianIds: string[];
  guardianNames: string[];
}

export interface ClassGuardianSerialized {
  id: string;
  name: string;
}

/** Serialized for passing to Client Components (no ObjectId, Date) */
export interface TeacherClassSerialized {
  id: string;
  schoolId: string;
  name: string;
  code?: string;
  teacherIds: string[];
  studentIds: string[];
  guardianIds?: string[];
  term: string;
  schoolName: string;
  students: ClassStudentSerialized[];
  guardians: ClassGuardianSerialized[];
}

export interface CalendarEventSerialized {
  id: string;
  schoolId: string;
  classId?: string | null;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  requiresPermissionSlip?: boolean;
  hasPermissionForm?: boolean;
  /** Cost in dollars. When set, parents must choose payment method. Includes recurring total. */
  cost?: number;
  /** Recurring: occurrence dates (YYYY-MM-DD) */
  occurrenceDates?: string[];
  /** Recurring: cost per occurrence */
  costPerOccurrence?: number;
}

export interface TeacherDashboardData {
  classes: TeacherClassSerialized[];
  upcomingEvents: CalendarEventSerialized[];
  /** Events requiring permission slips - always shown so teachers don't miss them */
  permissionSlipEvents: CalendarEventSerialized[];
  /** Per-event permission slip status by student */
  permissionSlipStatus: EventPermissionStatus[];
}

/**
 * Fetches all classes the teacher teaches, with school names.
 */
export async function getTeacherClasses(
  auth0Id: string
): Promise<TeacherClassWithSchool[]> {
  if (!isDbConfigured()) return [];

  try {
    const classes = await classesCollection();
    const schools = await schoolsCollection();

    const teacherClasses = await classes
      .find({ teacherIds: auth0Id })
      .toArray();

    const schoolIds = [...new Set(teacherClasses.map((c) => c.schoolId))];
    const schoolMap = new Map<string, string>();
    for (const id of schoolIds) {
      try {
        const school = await schools.findOne({
          _id: new ObjectId(id),
        });
        if (school?.name) schoolMap.set(id, school.name);
      } catch {
        schoolMap.set(id, "Unknown School");
      }
    }

    return teacherClasses.map((cls) => ({
      ...cls,
      schoolName: schoolMap.get(cls.schoolId) ?? "Unknown School",
    }));
  } catch (error) {
    console.error("[getTeacherClasses] Failed:", error);
    return [];
  }
}

/**
 * Fetches upcoming calendar events for the teacher's classes and schools.
 */
export async function getTeacherUpcomingEvents(
  auth0Id: string
): Promise<CalendarEvent[]> {
  if (!isDbConfigured()) return [];

  try {
    const teacherClasses = await getTeacherClasses(auth0Id);
    const classIds = teacherClasses
      .map((c) => c._id?.toString())
      .filter((id): id is string => Boolean(id));
    const schoolIds = [...new Set(teacherClasses.map((c) => c.schoolId))];

    const orConditions = [
      ...(classIds.length > 0 ? [{ classId: { $in: classIds } }] : []),
      ...(schoolIds.length > 0 ? [{ schoolId: { $in: schoolIds } }] : []),
    ];
    if (orConditions.length === 0) return [];

    const events = await calendarEventsCollection();
    const now = new Date().toISOString();
    const today = now.slice(0, 10); // YYYY-MM-DD for occurrenceDates comparison

    const upcoming = await events
      .find({
        $and: [
          { $or: orConditions },
          {
            $or: [
              { startAt: { $gte: now } },
              { startAt: { $lt: now }, endAt: { $gte: now } },
              // Recurring: include if any occurrence date is today or in the future
              { occurrenceDates: { $elemMatch: { $gte: today } } },
            ],
          },
        ],
      })
      .sort({ startAt: 1 })
      .toArray();

    return upcoming;
  } catch (error) {
    console.error("[getTeacherUpcomingEvents] Failed:", error);
    return [];
  }
}

async function serializeClassWithStudents(
  cls: TeacherClassWithSchool
): Promise<TeacherClassSerialized> {
  const students = await getClassStudentsWithGuardians(cls._id?.toString() ?? "");
  const guardianIds = cls.guardianIds ?? [];

  let guardians: ClassGuardianSerialized[] = [];
  if (guardianIds.length > 0) {
    try {
      const users = await usersCollection();
      const guardianDocs = await users
        .find({ auth0Id: { $in: guardianIds } })
        .toArray();
      guardians = guardianDocs.map((u) => ({
        id: u.auth0Id,
        name: u.name ?? u.email ?? "Unknown",
      }));
    } catch {
      guardians = guardianIds.map((id) => ({ id, name: "Unknown" }));
    }
  }

  return {
    id: cls._id?.toString() ?? "",
    schoolId: cls.schoolId,
    name: cls.name,
    code: cls.code,
    teacherIds: cls.teacherIds ?? [],
    studentIds: cls.studentIds ?? [],
    guardianIds: cls.guardianIds,
    term: cls.term,
    schoolName: cls.schoolName,
    students,
    guardians,
  };
}

function serializeEvent(event: CalendarEvent): CalendarEventSerialized {
  const cost = getEventEffectiveCost(event);
  return {
    id: event._id?.toString() ?? "",
    schoolId: event.schoolId,
    classId: event.classId ?? null,
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    requiresPermissionSlip: event.requiresPermissionSlip ?? false,
    hasPermissionForm: Boolean(event.permissionFormPdfBase64),
    cost,
    occurrenceDates: event.occurrenceDates,
    costPerOccurrence: event.costPerOccurrence,
  };
}

/**
 * Fetches upcoming events that require permission slips for the teacher's classes.
 * Shown separately so teachers don't miss them even with many events.
 */
export async function getTeacherPermissionSlipEvents(
  auth0Id: string
): Promise<CalendarEvent[]> {
  if (!isDbConfigured()) return [];

  try {
    const teacherClasses = await getTeacherClasses(auth0Id);
    const classIds = teacherClasses
      .map((c) => c._id?.toString())
      .filter((id): id is string => Boolean(id));
    const schoolIds = [...new Set(teacherClasses.map((c) => c.schoolId))];

    const orConditions = [
      ...(classIds.length > 0 ? [{ classId: { $in: classIds } }] : []),
      ...(schoolIds.length > 0 ? [{ schoolId: { $in: schoolIds } }] : []),
    ];
    if (orConditions.length === 0) return [];

    const events = await calendarEventsCollection();
    const now = new Date().toISOString();

    return events
      .find({
        requiresPermissionSlip: true,
        $and: [
          { $or: orConditions },
          {
            $or: [
              { startAt: { $gte: now } },
              { startAt: { $lt: now }, endAt: { $gte: now } },
            ],
          },
        ],
      })
      .sort({ startAt: 1 })
      .toArray();
  } catch (error) {
    console.error("[getTeacherPermissionSlipEvents] Failed:", error);
    return [];
  }
}

/**
 * Fetches full teacher dashboard data (serialized for Client Components).
 */
export async function getTeacherDashboardData(
  auth0Id: string
): Promise<TeacherDashboardData> {
  const [classes, upcomingEvents] = await Promise.all([
    getTeacherClasses(auth0Id),
    getTeacherUpcomingEvents(auth0Id),
  ]);

  const classesSerialized = await Promise.all(
    classes.map(serializeClassWithStudents)
  );

  const permissionSlipEventIds = upcomingEvents
    .filter(
      (e) =>
        e.requiresPermissionSlip || (getEventEffectiveCost(e) ?? 0) > 0
    )
    .map((e) => e._id?.toString())
    .filter((id): id is string => Boolean(id));
  const permissionSlipStatus =
    permissionSlipEventIds.length > 0
      ? await getEventPermissionSlipStatus(permissionSlipEventIds)
      : [];

  return {
    classes: classesSerialized,
    upcomingEvents: upcomingEvents.map(serializeEvent),
    permissionSlipEvents: upcomingEvents.map(serializeEvent),
    permissionSlipStatus,
  };
}
