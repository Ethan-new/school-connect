import type { ObjectId } from "mongodb";

// --- Users (one per account: parent, teacher, admin) ---
export type UserRole = "parent" | "teacher" | "admin";

export interface User {
  _id?: ObjectId;
  auth0Id: string;
  role: UserRole;
  name: string | null;
  email: string | null;
  picture?: string | null;
  schoolId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- Schools (minimal; add fields as needed) ---
export interface School {
  _id?: ObjectId;
  name: string;
  createdAt: Date;
}

// --- Students ---
export interface Student {
  _id?: ObjectId;
  schoolId: string;
  name: string;
  grade: string;
  guardianIds: string[];
  classIds: string[];
  createdAt?: Date;
}

// --- Classes ---
export interface Class {
  _id?: ObjectId;
  schoolId: string;
  name: string;
  teacherIds: string[];
  studentIds: string[];
  term: string;
  createdAt?: Date;
}

// --- Conversations (one thread per parent↔teacher, optionally per student) ---
export interface Conversation {
  _id?: ObjectId;
  schoolId: string;
  participantIds: string[];
  studentId?: string | null;
  lastMessageAt: Date;
  createdAt?: Date;
}

// --- Messages ---
export interface MessageAttachment {
  type: string;
  url: string;
  name: string;
}

export interface Message {
  _id?: ObjectId;
  conversationId: string;
  senderId: string;
  body: string;
  attachments?: MessageAttachment[];
  createdAt: Date;
}

// --- Calendar events ---
export type CalendarEventVisibility = "class" | "school" | "private";

export interface CalendarEvent {
  _id?: ObjectId;
  schoolId: string;
  classId?: string | null;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  visibility: CalendarEventVisibility;
  createdAt?: Date;
}

// --- Report cards ---
export interface ReportCardSubject {
  name: string;
  level: string;
  comment?: string;
}

export type ReportCardStatus = "draft" | "published";

export interface ReportCard {
  _id?: ObjectId;
  studentId: string;
  term: string;
  teacherId: string;
  subjects: ReportCardSubject[];
  overallComment?: string;
  status: ReportCardStatus;
  publishedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// --- Permission forms ---
export interface PermissionFormField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
}

export type PermissionFormStatus = "sent" | "signed" | "overdue";

export interface PermissionForm {
  _id?: ObjectId;
  schoolId: string;
  classId: string;
  studentId: string;
  title: string;
  bodyText: string;
  fields?: PermissionFormField[];
  dueAt: Date;
  status: PermissionFormStatus;
  createdBy: string;
  createdAt: Date;
}

// --- Signatures (e-sign for permission forms) ---
export interface FormSnapshot {
  title: string;
  bodyText: string;
  fields?: PermissionFormField[];
  values?: Record<string, unknown>;
}

export interface Signature {
  _id?: ObjectId;
  formId: string;
  studentId: string;
  signedBy: string;
  signedAt: Date;
  signerNameTyped: string;
  signatureImageUrl?: string | null;
  signatureHash: string;
  formSnapshot: FormSnapshot;
}
