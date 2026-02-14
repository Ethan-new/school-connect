import type { Collection } from "mongodb";
import {
  type User,
  type School,
  type Student,
  type Class,
  type Conversation,
  type Message,
  type CalendarEvent,
  type ReportCard,
  type PermissionForm,
  type Signature,
} from "./types";
import { getDb } from "../db";

const DB_NAME = "school-connect";

export function usersCollection(): Promise<Collection<User>> {
  return getDb(DB_NAME).then((db) => db.collection<User>("users"));
}

export function schoolsCollection(): Promise<Collection<School>> {
  return getDb(DB_NAME).then((db) => db.collection<School>("schools"));
}

export function studentsCollection(): Promise<Collection<Student>> {
  return getDb(DB_NAME).then((db) => db.collection<Student>("students"));
}

export function classesCollection(): Promise<Collection<Class>> {
  return getDb(DB_NAME).then((db) => db.collection<Class>("classes"));
}

export function conversationsCollection(): Promise<Collection<Conversation>> {
  return getDb(DB_NAME).then((db) =>
    db.collection<Conversation>("conversations")
  );
}

export function messagesCollection(): Promise<Collection<Message>> {
  return getDb(DB_NAME).then((db) => db.collection<Message>("messages"));
}

export function calendarEventsCollection(): Promise<
  Collection<CalendarEvent>
> {
  return getDb(DB_NAME).then((db) =>
    db.collection<CalendarEvent>("calendar_events")
  );
}

export function reportCardsCollection(): Promise<Collection<ReportCard>> {
  return getDb(DB_NAME).then((db) =>
    db.collection<ReportCard>("report_cards")
  );
}

export function permissionFormsCollection(): Promise<
  Collection<PermissionForm>
> {
  return getDb(DB_NAME).then((db) =>
    db.collection<PermissionForm>("permission_forms")
  );
}

export function signaturesCollection(): Promise<Collection<Signature>> {
  return getDb(DB_NAME).then((db) =>
    db.collection<Signature>("signatures")
  );
}
