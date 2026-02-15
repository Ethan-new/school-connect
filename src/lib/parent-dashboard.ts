import { ObjectId } from "mongodb";
import type { Class, CalendarEvent } from "./db/types";
import type { PermissionSlipTask } from "./event-permission-slips";
import { getParentPermissionSlipTasks } from "./event-permission-slips";
import {
  classesCollection,
  schoolsCollection,
  calendarEventsCollection,
} from "./db/collections";
import type { InboxItem } from "./event-permission-slips";
import { getPublishedReportCardsForGuardian } from "./report-cards";
import type { ReportCardSerialized } from "./report-cards";
import { getInterviewDataForGuardian } from "./interview-slots";
import type { ParentInterviewClass } from "./interview-slots";
import { getConversationsForParent } from "./messaging";
import type { ParentConversationSummary } from "./messaging";
import { isDbConfigured } from "./db";

export interface ParentClassWithSchool extends Class {
  schoolName: string;
}

/** Serialized for passing to Client Components (no ObjectId, Date) */
export interface ParentClassSerialized {
  id: string;
  schoolId: string;
  name: string;
  code?: string;
  term: string;
  schoolName: string;
}

export interface CalendarEventSerialized {
  id: string;
  schoolId: string;
  classId?: string | null;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  /** Recurring: occurrence dates (YYYY-MM-DD) */
  occurrenceDates?: string[];
}

export interface ParentDashboardData {
  classes: ParentClassSerialized[];
  upcomingEvents: CalendarEventSerialized[];
  permissionSlipTasks: PermissionSlipTask[];
  inboxItems: InboxItem[];
  reportCards: ReportCardSerialized[];
  interviewData: ParentInterviewClass[];
  conversations: ParentConversationSummary[];
}

/**
 * Fetches all classes the parent has joined, with school names.
 */
export async function getParentClasses(
  auth0Id: string
): Promise<ParentClassWithSchool[]> {
  if (!isDbConfigured()) return [];

  try {
    const classes = await classesCollection();
    const schools = await schoolsCollection();

    const parentClasses = await classes
      .find({ guardianIds: auth0Id })
      .toArray();

    const schoolIds = [...new Set(parentClasses.map((c) => c.schoolId))];
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

    return parentClasses.map((cls) => ({
      ...cls,
      schoolName: schoolMap.get(cls.schoolId) ?? "Unknown School",
    }));
  } catch (error) {
    console.error("[getParentClasses] Failed:", error);
    return [];
  }
}

/**
 * Fetches upcoming calendar events for the parent's classes and schools.
 */
export async function getParentUpcomingEvents(
  auth0Id: string
): Promise<CalendarEvent[]> {
  if (!isDbConfigured()) return [];

  try {
    const parentClasses = await getParentClasses(auth0Id);
    const classIds = parentClasses
      .map((c) => c._id?.toString())
      .filter((id): id is string => Boolean(id));
    const schoolIds = [...new Set(parentClasses.map((c) => c.schoolId))];

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
    console.error("[getParentUpcomingEvents] Failed:", error);
    return [];
  }
}

function serializeClass(cls: ParentClassWithSchool): ParentClassSerialized {
  return {
    id: cls._id?.toString() ?? "",
    schoolId: cls.schoolId,
    name: cls.name,
    code: cls.code,
    term: cls.term,
    schoolName: cls.schoolName,
  };
}

function serializeEvent(event: CalendarEvent): CalendarEventSerialized {
  return {
    id: event._id?.toString() ?? "",
    schoolId: event.schoolId,
    classId: event.classId ?? null,
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    occurrenceDates: event.occurrenceDates,
  };
}

/**
 * Fetches full parent dashboard data (serialized for Client Components).
 */
export async function getParentDashboardData(
  auth0Id: string
): Promise<ParentDashboardData> {
  const { getParentInboxItems } = await import("./event-permission-slips");

  const [
    classes,
    upcomingEvents,
    permissionSlipTasks,
    inboxItems,
    reportCards,
    interviewData,
    conversations,
  ] = await Promise.all([
    getParentClasses(auth0Id),
    getParentUpcomingEvents(auth0Id),
    getParentPermissionSlipTasks(auth0Id),
    getParentInboxItems(auth0Id),
    getPublishedReportCardsForGuardian(auth0Id),
    getInterviewDataForGuardian(auth0Id),
    getConversationsForParent(auth0Id),
  ]);

  return {
    classes: classes.map(serializeClass),
    upcomingEvents: upcomingEvents.map(serializeEvent),
    permissionSlipTasks,
    inboxItems,
    reportCards,
    interviewData,
    conversations,
  };
}
