import type { ObjectId } from "mongodb";

// --- Users (one per account: parent, teacher, admin) ---
export type UserRole = "parent" | "teacher" | "admin";

export interface User {
  _id?: ObjectId;
  auth0Id: string;
  role: UserRole;
  /** Set when user completes first-time role selection (parent vs teacher) */
  roleSelectedAt?: Date | null;
  /** Set when parent completes name step in onboarding */
  parentNameSetAt?: Date | null;
  /** Set when teacher completes name step in onboarding */
  teacherNameSetAt?: Date | null;
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
  /** Unique code parents enter to join the class (e.g. "ABC12") */
  code?: string;
  teacherIds: string[];
  studentIds: string[];
  /** Auth0 user ids of parents who joined via the class code */
  guardianIds?: string[];
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
  /** When true, parents in the class see a permission slip task to complete */
  requiresPermissionSlip?: boolean;
  /** Cost in dollars (e.g. 10.50). When set with requiresPermissionSlip, parents must choose payment method. */
  cost?: number;
  /** Recurring: multiple occurrence dates. Each date uses the same start/end time. */
  occurrenceDates?: string[];
  /** Recurring: cost per occurrence (e.g. $5 per pizza day). Total = costPerOccurrence × occurrenceDates.length */
  costPerOccurrence?: number;
  /** Teacher-uploaded permission form PDF (base64). Required for parents to download and sign. */
  permissionFormPdfBase64?: string;
  /** Due date for form and payment (YYYY-MM-DD). When set, parents must submit by this date. */
  permissionSlipDueDate?: string;
  createdAt?: Date;
}

// --- Event permission slips (simple sign-off per parent per event per student) ---
export type EventPermissionSlipStatus = "pending" | "signed";

export type PaymentMethod = "online" | "cash";

export interface EventPermissionSlip {
  _id?: ObjectId;
  eventId: string;
  classId: string;
  /** Linked student - required for new slips; legacy slips may not have this */
  studentId?: string;
  guardianId: string;
  status: EventPermissionSlipStatus;
  signedAt?: Date;
  /** When parent opened/viewed the inbox item (for read state) */
  readAt?: Date;
  /** Base64-encoded signed PDF uploaded by parent */
  signedPdfBase64?: string;
  /** How parent will pay when event has a cost */
  paymentMethod?: PaymentMethod;
  /** When teacher marks cash as received (for paymentMethod=cash) */
  cashReceivedAt?: Date;
  createdAt: Date;
}

// --- Report cards ---
export type ReportCardStatus = "draft" | "published";

export interface ReportCard {
  _id?: ObjectId;
  studentId: string;
  term: string;
  teacherId: string;
  pdfBase64: string;
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

// --- Interview slots ---
export interface InterviewSlot {
  _id?: ObjectId;
  classId: string;
  /** Start time (ISO string) */
  startAt: string;
  /** End time (ISO string). Default ~15 min after start. */
  endAt: string;
  /** When claimed: the student this slot is for */
  studentId?: string;
  /** When claimed: the guardian who claimed it (has account) */
  guardianId?: string;
  /** When teacher books for parent without account */
  manualGuardianName?: string;
  /** When teacher books for parent without account */
  manualGuardianEmail?: string;
  createdAt?: Date;
}
