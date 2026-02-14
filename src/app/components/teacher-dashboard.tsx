"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  TeacherClassSerialized,
  CalendarEventSerialized,
  ClassStudentSerialized,
} from "@/lib/teacher-dashboard";
import type {
  EventPermissionStatus,
  EventPermissionStatusByStudent,
} from "@/lib/event-permission-slips";
import { AddEventModal } from "./add-event-modal";
import { EditEventModal } from "./edit-event-modal";
import { AddStudentsModal } from "./add-students-modal";
import {
  linkGuardianAction,
  unlinkGuardianAction,
  uploadEventPermissionFormAction,
  uploadPermissionSlipForStudentAction,
  markCashReceivedAction,
} from "@/app/actions";

interface TeacherDashboardProps {
  userName: string | null;
  classes: TeacherClassSerialized[];
  upcomingEvents: CalendarEventSerialized[];
  permissionSlipEvents: CalendarEventSerialized[];
  permissionSlipStatus: EventPermissionStatus[];
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) {
    return `Today at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  if (d.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEventTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateStr = start.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

function formatOccurrenceDates(dates: string[]): string {
  if (dates.length === 0) return "";
  if (dates.length === 1) {
    return new Date(dates[0] + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const formatted = dates.map((d) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  );
  if (formatted.length <= 4) {
    return formatted.join(", ");
  }
  return `${formatted[0]} – ${formatted[formatted.length - 1]} (${dates.length} dates)`;
}

function TeacherCalendarView({
  events,
  onEventClick,
  onAddEvent,
}: {
  events: CalendarEventSerialized[];
  onEventClick: (eventId: string) => void;
  onAddEvent: () => void;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startPadding; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }

  const dateKey = (d: Date) => d.toISOString().slice(0, 10);
  const eventsByDate = new Map<string, CalendarEventSerialized[]>();
  for (const event of events) {
    const dates: string[] =
      event.occurrenceDates && event.occurrenceDates.length > 1
        ? event.occurrenceDates
        : [event.startAt.slice(0, 10)];
    for (const d of dates) {
      if (!eventsByDate.has(d)) eventsByDate.set(d, []);
      eventsByDate.get(d)!.push(event);
    }
  }

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-medium text-zinc-900">{monthName}</h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))
              }
              className="rounded-lg border border-zinc-300 bg-white p-2 text-zinc-600 hover:bg-zinc-50"
              aria-label="Previous month"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              aria-label="Go to today"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))
              }
              className="rounded-lg border border-zinc-300 bg-white p-2 text-zinc-600 hover:bg-zinc-50"
              aria-label="Next month"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddEvent}
          className="flex items-center gap-2 self-start rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          Add event
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-zinc-500"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date, i) => {
            if (!date) {
              return <div key={`pad-${i}`} className="min-h-[80px] bg-zinc-50/50" />;
            }
            const key = dateKey(date);
            const dayEvents = eventsByDate.get(key) ?? [];
            const isToday =
              date.getDate() === today.getDate() &&
              date.getMonth() === today.getMonth() &&
              date.getFullYear() === today.getFullYear();

            return (
              <div
                key={key}
                className={`min-h-[80px] border-b border-r border-zinc-100 p-2 last:border-r-0 ${
                  isToday ? "bg-amber-50/80" : "bg-white"
                }`}
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                    isToday
                      ? "bg-red-600 font-medium text-white"
                      : "text-zinc-700"
                  }`}
                >
                  {date.getDate()}
                </span>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <button
                      key={`${ev.id}-${key}`}
                      type="button"
                      onClick={() => onEventClick(ev.id)}
                      className="w-full truncate rounded px-2 py-1 text-left text-xs font-medium text-zinc-800 transition-colors hover:bg-amber-100 hover:text-amber-900"
                      title={ev.title}
                    >
                      {ev.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="block px-2 text-xs text-zinc-500">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {events.length === 0 && (
          <div className="border-t border-zinc-200 p-8 text-center">
            <p className="text-zinc-600">
              No upcoming events. Add events from the Events tab.
            </p>
          </div>
        )}
      </div>
      {events.length > 0 && (
        <p className="text-sm text-zinc-500">
          Click an event to view details and manage permission slips.
        </p>
      )}
    </div>
  );
}

function StudentSubmissionsAndPaymentTable({
  students,
  eventCost,
  onMarkCashReceived,
  onRowClick,
}: {
  students: EventPermissionStatusByStudent[];
  eventCost: number;
  onMarkCashReceived: (slipId: string, received: boolean) => Promise<void>;
  onRowClick: (student: EventPermissionStatusByStudent) => void;
}) {
  const [updatingSlipId, setUpdatingSlipId] = useState<string | null>(null);
  const signed = students.filter((s) => s.status === "signed");

  async function handleToggle(
    e: React.MouseEvent,
    slipId: string,
    currentReceived: boolean
  ) {
    e.stopPropagation();
    if (!slipId) return;
    setUpdatingSlipId(slipId);
    try {
      await onMarkCashReceived(slipId, !currentReceived);
    } finally {
      setUpdatingSlipId(null);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
        <p className="text-xs font-medium text-zinc-600">
          Student submissions & payment
        </p>
        <span className="text-xs text-zinc-600">
          <span className="text-emerald-600 font-medium">{signed.length}</span>
          {" / "}
          <span className="text-zinc-700">{students.length}</span> submitted
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-b-sm bg-zinc-100">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{
            width: `${
              students.length > 0
                ? (signed.length / students.length) * 100
                : 0
            }%`,
          }}
        />
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/50">
            <th className="px-3 py-2 text-xs font-medium text-zinc-600">
              Student
            </th>
            <th className="px-3 py-2 text-xs font-medium text-zinc-600">
              Status
            </th>
            <th className="px-3 py-2 text-xs font-medium text-zinc-600">
              Payment
            </th>
            <th className="px-3 py-2 text-xs font-medium text-zinc-600">
              Cash received
            </th>
            {eventCost > 0 && (
              <th className="px-3 py-2 text-right text-xs font-medium text-zinc-600">
                Amount
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr
              key={s.studentId}
              onClick={() => onRowClick(s)}
              className={`cursor-pointer border-b border-zinc-100 last:border-0 transition-colors hover:bg-zinc-50 ${
                i % 2 === 0 ? "bg-white" : "bg-zinc-50/30"
              }`}
            >
              <td className="px-3 py-2 font-medium text-zinc-900">
                {s.studentName}
              </td>
              <td className="px-3 py-2">
                {s.status === "signed" ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Submitted{s.signedBy && ` (${s.signedBy})`}
                  </span>
                ) : s.status === "pending" ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Not submitted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-amber-600">
                    No parent linked
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                {s.paymentMethod === "online" ? (
                  <span className="text-emerald-700">Pay online</span>
                ) : s.paymentMethod === "cash" ? (
                  <span className="text-amber-700">Cash</span>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                {s.paymentMethod === "cash" && s.slipId ? (
                  <button
                    type="button"
                    onClick={(e) =>
                      handleToggle(e, s.slipId!, s.cashReceived ?? false)
                    }
                    disabled={updatingSlipId === s.slipId}
                    className="inline-flex items-center gap-1.5 text-sm"
                    title={s.cashReceived ? "Unmark cash received" : "Mark cash received"}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded border-2 ${
                        s.cashReceived
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-zinc-300 bg-white"
                      } ${updatingSlipId === s.slipId ? "opacity-50" : ""}`}
                    >
                      {s.cashReceived ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : null}
                    </span>
                    <span
                      className={
                        s.cashReceived ? "text-emerald-600" : "text-zinc-500"
                      }
                    >
                      {s.cashReceived ? "Received" : "Not yet"}
                    </span>
                  </button>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              {eventCost > 0 && (
                <td className="px-3 py-2 text-right font-medium text-zinc-800">
                  {s.status === "signed" ? `$${eventCost.toFixed(2)}` : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-1.5 font-mono text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-200"
      title="Copy class code"
    >
      <span className="tracking-widest">{code}</span>
      {copied ? (
        <span className="text-xs text-emerald-600">Copied!</span>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16V4a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}

function StudentRow({
  student,
  guardians,
  classId,
}: {
  student: ClassStudentSerialized;
  guardians: { id: string; name: string }[];
  classId: string;
}) {
  const [linkingGuardianId, setLinkingGuardianId] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const unlinkedGuardians = guardians.filter(
    (g) => !student.guardianIds.includes(g.id)
  );

  function handleLink(guardianId: string) {
    if (!guardianId) return;
    startTransition(async () => {
      const result = await linkGuardianAction(classId, student.id, guardianId);
      if (result.success) {
        setLinkingGuardianId("");
        router.refresh();
      }
    });
  }

  function handleUnlink(guardianId: string) {
    startTransition(async () => {
      const result = await unlinkGuardianAction(
        classId,
        student.id,
        guardianId
      );
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="rounded-lg bg-zinc-50 py-2 px-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-zinc-900">
          {student.name}
        </span>
        {student.grade && student.grade !== "—" && (
          <span className="text-xs text-zinc-500">
            ({student.grade})
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {student.guardianIds.length > 0 && (
          <span className="text-xs text-zinc-600">
            Linked: {student.guardianNames.join(", ")}
          </span>
        )}
        {student.guardianIds.map((gid) => {
          const g = guardians.find((x) => x.id === gid);
          return (
            <button
              key={gid}
              type="button"
              onClick={() => handleUnlink(gid)}
              disabled={isPending}
              className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 hover:bg-red-200"
              title="Unlink"
            >
              ✕ {g?.name ?? "Parent"}
            </button>
          );
        })}
        {unlinkedGuardians.length > 0 ? (
          <select
            value={linkingGuardianId}
            onChange={(e) => {
              const id = e.target.value;
              setLinkingGuardianId(id);
              if (id) handleLink(id);
            }}
            disabled={isPending}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
          >
            <option value="">+ Link parent</option>
            {unlinkedGuardians.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        ) : guardians.length === 0 ? (
          <span className="text-xs text-zinc-400">No parents in class yet</span>
        ) : null}
      </div>
    </div>
  );
}

type Tab = "classes" | "permissionslips" | "events" | "messages";

export function TeacherDashboard({
  userName,
  classes,
  upcomingEvents,
  permissionSlipEvents,
  permissionSlipStatus,
}: TeacherDashboardProps) {
  const router = useRouter();
  const statusByEvent = new Map(
    permissionSlipStatus.map((s) => [s.eventId, s])
  );
  const firstName = userName?.split(/\s+/)[0] ?? "there";
  const [activeTab, setActiveTab] = useState<Tab>("classes");
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [addStudentsClass, setAddStudentsClass] =
    useState<TeacherClassSerialized | null>(null);
  const [uploadingFormEventId, setUploadingFormEventId] = useState<
    string | null
  >(null);
  const [permissionFormFileSelected, setPermissionFormFileSelected] =
    useState(false);
  const [permissionFormPreviewExpanded, setPermissionFormPreviewExpanded] =
    useState(false);
  const [selectedPermissionSlipEventId, setSelectedPermissionSlipEventId] =
    useState<string | null>(null);
  const [selectedSubmissionStudent, setSelectedSubmissionStudent] =
    useState<EventPermissionStatusByStudent | null>(null);
  const [editingEvent, setEditingEvent] =
    useState<CalendarEventSerialized | null>(null);
  const [uploadingManualSlipFor, setUploadingManualSlipFor] = useState<
    string | null
  >(null);

  useEffect(() => {
    setPermissionFormFileSelected(false);
    setPermissionFormPreviewExpanded(false);
  }, [selectedPermissionSlipEventId]);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-6 border-b border-zinc-200 pb-2">
            <Link href="/" className="flex shrink-0 items-center">
              <Image
                src="/logo_yrdsb_desktop.svg"
                alt="York Region District School Board"
                width={140}
                height={44}
                className="h-8 w-auto"
              />
            </Link>
            <nav className="flex flex-1 items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("classes")}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === "classes"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              My Classes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("permissionslips")}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === "permissionslips"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Events
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("events")}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === "events"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("messages")}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === "messages"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Messages
            </button>
            <a
              href="/auth/logout"
              className="ml-auto text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Logout
            </a>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* My Classes tab */}
        {activeTab === "classes" && (
        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-900">
            My Classes
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {classes.map((cls) => (
              <div
                key={cls.id || cls.code}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="font-medium text-zinc-900">
                  {cls.name}
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  {cls.schoolName}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {cls.term}
                </p>
                {cls.code && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-zinc-500">
                      Class code (share with parents)
                    </p>
                    <ClassCodeButton code={cls.code} />
                  </div>
                )}
                <p className="mt-2 text-xs text-zinc-500">
                  {cls.guardianIds?.length ?? 0} parent
                  {(cls.guardianIds?.length ?? 0) !== 1 ? "s" : ""} joined
                </p>
                <div className="mt-4 border-t border-zinc-200 pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-600">
                      Students
                    </span>
                    <button
                      type="button"
                      onClick={() => setAddStudentsClass(cls)}
                      className="text-xs font-medium text-zinc-700 hover:text-zinc-900"
                    >
                      + Add students
                    </button>
                  </div>
                  {cls.students?.length > 0 ? (
                    <div className="space-y-1">
                      {cls.students.map((s) => (
                        <StudentRow
                          key={s.id}
                          student={s}
                          guardians={cls.guardians ?? []}
                          classId={cls.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      No students yet. Add students and link them to parents.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/onboarding/create-class"
            className="mt-4 inline-flex items-center text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            + Create another class
          </Link>
        </section>
        )}

        {/* Events tab - shows all events (permission slip or not) */}
        {activeTab === "permissionslips" && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900">
              Events
            </h2>
            <button
              type="button"
              onClick={() => setIsAddEventOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Add event
            </button>
          </div>
          {permissionSlipEvents.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-zinc-600">
              All upcoming events. Click one to view details. Events that require
              permission slips show submission and payment status.
            </p>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">
                      Event
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {permissionSlipEvents.map((event, i) => {
                    const status = statusByEvent.get(event.id);
                    const pending =
                      status?.students.filter((s) => s.status === "pending") ??
                      [];
                    const noParent =
                      status?.students.filter(
                        (s) => s.status === "no_parent"
                      ) ?? [];
                    const signed =
                      status?.students.filter((s) => s.status === "signed") ??
                      [];
                    const statusParts = [];
                    if (event.requiresPermissionSlip) {
                      if (pending.length) statusParts.push(`${pending.length} pending`);
                      if (noParent.length)
                        statusParts.push(`${noParent.length} no parent`);
                      if (signed.length) statusParts.push(`${signed.length} submitted`);
                    }
                    const statusText =
                      statusParts.length > 0
                        ? statusParts.join(", ")
                        : event.requiresPermissionSlip
                          ? "No students"
                          : "—";

                    return (
                      <tr
                        key={event.id}
                        onClick={() =>
                          setSelectedPermissionSlipEventId(event.id)
                        }
                        className={`cursor-pointer transition-colors ${
                          i % 2 === 0
                            ? "bg-white hover:bg-zinc-50"
                            : "bg-zinc-50/50 hover:bg-zinc-100/50"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-zinc-900">
                            {event.title}
                          </span>
                          {event.occurrenceDates &&
                            event.occurrenceDates.length > 1 && (
                              <span className="ml-2 text-xs text-zinc-500">
                                ({event.occurrenceDates.length} dates)
                              </span>
                            )}
                          {event.cost != null && event.cost > 0 && (
                            <span className="ml-2 text-xs text-zinc-500">
                              ${event.cost.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600">
                          {event.occurrenceDates &&
                          event.occurrenceDates.length > 1
                            ? formatOccurrenceDates(event.occurrenceDates)
                            : formatEventDate(event.startAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600">
                          {statusText}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Permission slip detail modal - rendered below at top level so it works from Calendar tab too */}
            {false && selectedPermissionSlipEventId && (() => {
              const event = permissionSlipEvents.find(
                (e) => e.id === selectedPermissionSlipEventId
              );
              const status = event
                ? statusByEvent.get(event.id)
                : undefined;
              const isUploading =
                uploadingFormEventId === selectedPermissionSlipEventId;
              if (!event) return null;

              async function handleUploadForm(
                e: React.FormEvent<HTMLFormElement>
              ) {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                if (
                  !formData.get("pdf") ||
                  (formData.get("pdf") as File).size === 0
                ) {
                  alert("Please select a PDF file");
                  return;
                }
                setUploadingFormEventId(event.id);
                const { success, error } =
                  await uploadEventPermissionFormAction(event.id, formData);
                setUploadingFormEventId(null);
                if (success) {
                  form.reset();
                  setPermissionFormFileSelected(false);
                  router.refresh();
                } else if (error) {
                  alert(error);
                }
              }

              const pending =
                status?.students.filter((s) => s.status === "pending") ?? [];
              const noParent =
                status?.students.filter((s) => s.status === "no_parent") ?? [];
              const signed =
                status?.students.filter((s) => s.status === "signed") ?? [];

              return (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                  onClick={() => {
                setSelectedPermissionSlipEventId(null);
                setSelectedSubmissionStudent(null);
                setPermissionFormFileSelected(false);
                setPermissionFormPreviewExpanded(false);
              }}
              role="dialog"
                  aria-modal="true"
                  aria-labelledby="permission-slip-modal-title"
                >
                  <div
                    className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
                      <h2
                        id="permission-slip-modal-title"
                        className="text-lg font-semibold text-zinc-900"
                      >
                        {event.title}
                      </h2>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingEvent(event)}
                          className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                          aria-label="Edit event"
                          title="Edit event"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPermissionSlipEventId(null);
                            setSelectedSubmissionStudent(null);
                            setPermissionFormFileSelected(false);
                            setPermissionFormPreviewExpanded(false);
                          }}
                          className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                          aria-label="Close"
                        >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-4 px-6 py-5">
                      {(status?.className ||
                        (event.classId &&
                          classes.find((c) => c.id === event.classId)?.name)) && (
                        <p className="text-sm text-zinc-500">
                          {status?.className ??
                            classes.find((c) => c.id === event.classId)?.name}
                        </p>
                      )}
                      <div className="text-sm text-zinc-600">
                        {event.occurrenceDates &&
                        event.occurrenceDates.length > 1 ? (
                          <>
                            <span>
                              {formatEventTimeRange(event.startAt, event.endAt).split(" · ")[1]}{" "}
                              (each date)
                            </span>
                            <span className="mt-2 block font-medium text-zinc-700">
                              All {event.occurrenceDates.length} dates:
                            </span>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {event.occurrenceDates.map((d) => (
                                <span
                                  key={d}
                                  className="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
                                >
                                  {new Date(d + "T12:00:00").toLocaleDateString(
                                    "en-US",
                                    {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                    }
                                  )}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          formatEventTimeRange(event.startAt, event.endAt)
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-zinc-500">
                          {event.description}
                        </p>
                      )}
                      {!event.requiresPermissionSlip &&
                        event.cost != null &&
                        event.cost > 0 && (
                          <p className="text-sm font-medium text-zinc-700">
                            Cost: ${event.cost.toFixed(2)}
                          </p>
                        )}

                      {event.requiresPermissionSlip && (
                      <>
                      {/* Permission form section */}
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                        <h3 className="text-sm font-semibold text-zinc-800">
                          Permission form
                        </h3>
                        {event.hasPermissionForm ? (
                          <p className="mt-1 text-sm text-emerald-600">
                            Form uploaded ✓
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-amber-600">
                            No form uploaded — upload a PDF for parents to sign
                          </p>
                        )}
                        <form
                          onSubmit={handleUploadForm}
                          className="mt-3 flex flex-wrap items-center gap-2"
                        >
                          <input
                            type="file"
                            name="pdf"
                            accept=".pdf,application/pdf"
                            disabled={!!uploadingFormEventId}
                            onChange={(e) =>
                              setPermissionFormFileSelected(
                                !!e.target.files?.[0]
                              )
                            }
                            className="block text-sm text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-amber-800 hover:file:bg-amber-200"
                          />
                          <button
                            type="submit"
                            disabled={
                              !!uploadingFormEventId ||
                              (event.hasPermissionForm &&
                                !permissionFormFileSelected)
                            }
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-600"
                          >
                            {isUploading
                              ? "Uploading..."
                              : event.hasPermissionForm
                                ? "Replace form"
                                : "Upload form"}
                          </button>
                        </form>
                        <p className="mt-2 text-xs text-zinc-500">
                          Parents will download this PDF to sign and return.
                        </p>
                        <div className="mt-4">
                          {event.hasPermissionForm ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setPermissionFormPreviewExpanded(
                                    !permissionFormPreviewExpanded
                                  )
                                }
                                className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                              >
                                <span>
                                  {permissionFormPreviewExpanded
                                    ? "Hide form preview"
                                    : "Show form preview"}
                                </span>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className={`shrink-0 transition-transform ${
                                    permissionFormPreviewExpanded
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                >
                                  <path d="m6 9 6 6 6-6" />
                                </svg>
                              </button>
                              {permissionFormPreviewExpanded && (
                                <div className="mt-2">
                                  <div className="h-[400px] overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                    <iframe
                                      src={`/api/event/${event.id}/permission-form`}
                                      title="Permission form preview"
                                      className="h-full w-full"
                                    />
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-zinc-500">
                              Upload a form above to preview it.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Student submissions & payment (combined) */}
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                        <h3 className="text-sm font-semibold text-zinc-800">
                          Student submissions & payment
                        </h3>
                        {event.cost != null && event.cost > 0 && (
                          <div className="mt-2 space-y-1 text-sm text-zinc-600">
                            <p>
                              Cost per student: ${event.cost.toFixed(2)}
                              {event.occurrenceDates &&
                                event.occurrenceDates.length > 1 &&
                                event.costPerOccurrence != null &&
                                event.costPerOccurrence > 0 && (
                                  <span className="text-zinc-500">
                                    {" "}
                                    ({event.occurrenceDates.length} dates × $
                                    {event.costPerOccurrence.toFixed(2)})
                                  </span>
                                )}
                            </p>
                            {signed.length > 0 && (
                              <p className="font-medium text-zinc-800">
                                Expected total: $
                                {(event.cost * signed.length).toFixed(2)}
                              </p>
                            )}
                            {(() => {
                              const payOnline = signed.filter(
                                (s) => s.paymentMethod === "online"
                              ).length;
                              const payCash = signed.filter(
                                (s) => s.paymentMethod === "cash"
                              ).length;
                              const cashReceived = signed.filter(
                                (s) =>
                                  s.paymentMethod === "cash" && s.cashReceived
                              ).length;
                              const cashOutstanding = payCash - cashReceived;
                              const awaiting = signed.length - payOnline - payCash;
                              return (
                                (payOnline > 0 ||
                                  payCash > 0 ||
                                  awaiting > 0) && (
                                  <p className="text-xs text-zinc-500">
                                    {payOnline > 0 && (
                                      <span className="text-emerald-700">
                                        {payOnline} online
                                      </span>
                                    )}
                                    {payOnline > 0 && payCash > 0 && " · "}
                                    {payCash > 0 && (
                                      <span className="text-amber-700">
                                        {payCash} cash
                                        {cashReceived > 0 &&
                                          ` (${cashReceived} received)`}
                                        {cashOutstanding > 0 &&
                                          ` (${cashOutstanding} pending)`}
                                      </span>
                                    )}
                                    {(payOnline > 0 || payCash > 0) &&
                                      awaiting > 0 &&
                                      " · "}
                                    {awaiting > 0 && (
                                      <span>{awaiting} no method</span>
                                    )}
                                  </p>
                                )
                              );
                            })()}
                          </div>
                        )}
                        {event.cost == null || event.cost === 0 ? (
                          <p className="mt-1 text-sm text-zinc-500">
                            No cost for this event.
                          </p>
                        ) : null}
                        {status && status.students.length > 0 ? (
                          <div className="mt-4">
                            <StudentSubmissionsAndPaymentTable
                              students={status.students}
                              eventCost={event.cost ?? 0}
                              onMarkCashReceived={async (slipId, received) => {
                                const { success } =
                                  await markCashReceivedAction(slipId, received);
                                if (success) router.refresh();
                              }}
                              onRowClick={setSelectedSubmissionStudent}
                            />
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-zinc-500">
                            No students in this class yet.
                          </p>
                        )}
                      </div>

                      {/* Submission detail modal (when row clicked) */}
                      {selectedSubmissionStudent && (
                        <div
                          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
                          onClick={() =>
                            setSelectedSubmissionStudent(null)
                          }
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="submission-detail-title"
                        >
                          <div
                            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex shrink-0 items-start justify-between border-b border-zinc-200 px-6 py-4">
                              <h3
                                id="submission-detail-title"
                                className="text-lg font-semibold text-zinc-900"
                              >
                                {selectedSubmissionStudent.studentName}
                              </h3>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedSubmissionStudent(null)
                                }
                                className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                                aria-label="Close"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M18 6 6 18" />
                                  <path d="m6 6 12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="flex-1 overflow-y-auto px-6 py-4">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-medium text-zinc-500">
                                    Status
                                  </p>
                                  <p className="mt-0.5 text-sm font-medium">
                                    {selectedSubmissionStudent.status ===
                                    "signed" ? (
                                      <span className="text-emerald-600">
                                        Submitted
                                      </span>
                                    ) : selectedSubmissionStudent.status ===
                                      "pending" ? (
                                      <span className="text-red-600">
                                        Not submitted
                                      </span>
                                    ) : (
                                      <span className="text-amber-600">
                                        No parent linked
                                      </span>
                                    )}
                                  </p>
                                </div>
                              {selectedSubmissionStudent.signedBy && (
                                <div>
                                  <p className="text-xs font-medium text-zinc-500">
                                    Signed by
                                  </p>
                                  <p className="mt-0.5 text-sm text-zinc-700">
                                    {selectedSubmissionStudent.signedBy}
                                  </p>
                                </div>
                              )}
                              {selectedSubmissionStudent.paymentMethod && (
                                <div>
                                  <p className="text-xs font-medium text-zinc-500">
                                    Payment
                                  </p>
                                  <p className="mt-0.5 text-sm text-zinc-700">
                                    {selectedSubmissionStudent.paymentMethod ===
                                    "online"
                                      ? "Pay online"
                                      : "Sending cash with child"}
                                  </p>
                                </div>
                              )}
                                {selectedSubmissionStudent.status ===
                                  "signed" &&
                                  selectedSubmissionStudent.slipId && (
                                    <>
                                      <div className="overflow-hidden rounded-lg border border-zinc-200">
                                        <iframe
                                          src={`/api/permission-slip/${selectedSubmissionStudent.slipId}/download?preview=1`}
                                          title="Submitted permission slip"
                                          className="h-[400px] w-full min-h-[280px] bg-white"
                                        />
                                      </div>
                                      <a
                                        href={`/api/permission-slip/${selectedSubmissionStudent.slipId}/download`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="16"
                                          height="16"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                        >
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                          <polyline points="7 10 12 15 17 10" />
                                          <line x1="12" x2="12" y1="15" y2="3" />
                                        </svg>
                                        Download PDF
                                      </a>
                                    </>
                                  )}
                                {selectedSubmissionStudent.status ===
                                  "pending" && (
                                  <p className="text-sm text-zinc-500">
                                    Awaiting submission from parent. Parents see
                                    this in their Inbox.
                                  </p>
                                )}
                                {selectedSubmissionStudent.status ===
                                  "no_parent" &&
                                  event &&
                                  status?.classId && (
                                  <div className="space-y-3 border-t border-zinc-200 pt-4">
                                    <p className="text-sm text-zinc-500">
                                      No parent is linked to this student. You
                                      can manually upload a signed permission
                                      form (e.g. from a paper copy).
                                    </p>
                                    <form
                                      onSubmit={async (e) => {
                                        e.preventDefault();
                                        const form = e.currentTarget;
                                        const formData = new FormData(form);
                                        const file = formData.get("pdf") as File | null;
                                        if (!file || file.size === 0) {
                                          alert("Please select a PDF file");
                                          return;
                                        }
                                        if (file.size > 5 * 1024 * 1024) {
                                          alert(
                                            "File is too large. Please use a PDF under 5 MB."
                                          );
                                          return;
                                        }
                                        const hasCost = event.cost != null && event.cost > 0;
                                        setUploadingManualSlipFor(
                                          selectedSubmissionStudent.studentId
                                        );
                                        try {
                                          const { success, error } =
                                            await uploadPermissionSlipForStudentAction(
                                              event.id,
                                              status.classId,
                                              selectedSubmissionStudent.studentId,
                                              formData
                                            );
                                          if (success) {
                                            form.reset();
                                            setSelectedSubmissionStudent(null);
                                            setSelectedPermissionSlipEventId(
                                              null
                                            );
                                            router.refresh();
                                          } else if (error) {
                                            alert(error);
                                          }
                                        } catch (err) {
                                          const msg =
                                            err instanceof Error
                                              ? err.message
                                              : String(err);
                                          if (
                                            msg.includes("1 MB") ||
                                            msg.includes("body size")
                                          ) {
                                            alert(
                                              "File is too large. Please use a PDF under 5 MB."
                                            );
                                          } else {
                                            alert(
                                              "Something went wrong. Please try again."
                                            );
                                          }
                                        } finally {
                                          setUploadingManualSlipFor(null);
                                        }
                                      }}
                                      className="flex flex-col gap-3"
                                    >
                                      {(event.cost != null && event.cost > 0) && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                                          <p className="mb-2 text-sm font-medium text-zinc-800">
                                            Payment method for this parent
                                          </p>
                                          <div className="flex flex-col gap-2">
                                            <label className="flex cursor-pointer items-center gap-2">
                                              <input
                                                type="radio"
                                                name="paymentMethod"
                                                value="online"
                                                required={event.cost > 0}
                                                disabled={!!uploadingManualSlipFor}
                                                className="h-4 w-4 border-zinc-300 text-amber-600 focus:ring-amber-500"
                                              />
                                              <span className="text-sm font-medium text-zinc-900">
                                                Pay online
                                              </span>
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2">
                                              <input
                                                type="radio"
                                                name="paymentMethod"
                                                value="cash"
                                                defaultChecked
                                                required={event.cost > 0}
                                                disabled={!!uploadingManualSlipFor}
                                                className="h-4 w-4 border-zinc-300 text-amber-600 focus:ring-amber-500"
                                              />
                                              <span className="text-sm font-medium text-zinc-900">
                                                Sending cash with child
                                              </span>
                                            </label>
                                          </div>
                                        </div>
                                      )}
                                      <div className="flex flex-wrap items-center gap-2">
                                        <input
                                          type="file"
                                          name="pdf"
                                          accept=".pdf,application/pdf"
                                          disabled={!!uploadingManualSlipFor}
                                          className="block text-sm text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-amber-800 hover:file:bg-amber-200"
                                        />
                                        <button
                                          type="submit"
                                          disabled={!!uploadingManualSlipFor}
                                          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                                        >
                                          {uploadingManualSlipFor ===
                                          selectedSubmissionStudent.studentId
                                            ? "Uploading..."
                                            : "Upload signed PDF"}
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center">
              <p className="text-zinc-600">
                No events yet. Add an event for your classes.
              </p>
              <button
                type="button"
                onClick={() => setIsAddEventOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                Add event
              </button>
            </div>
          )}
        </section>
        )}

        {/* Calendar tab */}
        {activeTab === "events" && (
        <section>
          <TeacherCalendarView
            events={upcomingEvents}
            onEventClick={(eventId) => {
              setSelectedPermissionSlipEventId(eventId);
            }}
            onAddEvent={() => setIsAddEventOpen(true)}
          />
        </section>
        )}

        {/* Messages tab */}
        {activeTab === "messages" && (
        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-900">
            Messages
          </h2>
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center">
            <p className="text-zinc-600">
              Direct messaging with parents coming soon.
            </p>
          </div>
        </section>
        )}

        {/* Permission slip detail modal - top level so it opens from Calendar or Events */}
        {selectedPermissionSlipEventId && (() => {
          const event =
            permissionSlipEvents.find(
              (e) => e.id === selectedPermissionSlipEventId
            ) ??
            upcomingEvents.find(
              (e) => e.id === selectedPermissionSlipEventId
            );
          const status = event
            ? statusByEvent.get(event.id)
            : undefined;
          const isUploading =
            uploadingFormEventId === selectedPermissionSlipEventId;
          if (!event) return null;

          async function handleUploadForm(
            e: React.FormEvent<HTMLFormElement>
          ) {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            if (
              !formData.get("pdf") ||
              (formData.get("pdf") as File).size === 0
            ) {
              alert("Please select a PDF file");
              return;
            }
            setUploadingFormEventId(event.id);
            const { success, error } =
              await uploadEventPermissionFormAction(event.id, formData);
            setUploadingFormEventId(null);
            if (success) {
              form.reset();
              setPermissionFormFileSelected(false);
              router.refresh();
            } else if (error) {
              alert(error);
            }
          }

          const pending =
            status?.students.filter((s) => s.status === "pending") ?? [];
          const noParent =
            status?.students.filter((s) => s.status === "no_parent") ?? [];
          const signed =
            status?.students.filter((s) => s.status === "signed") ?? [];

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => {
                setSelectedPermissionSlipEventId(null);
                setSelectedSubmissionStudent(null);
                setPermissionFormFileSelected(false);
                setPermissionFormPreviewExpanded(false);
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="permission-slip-modal-title"
            >
              <div
                className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
                  <h2
                    id="permission-slip-modal-title"
                    className="text-lg font-semibold text-zinc-900"
                  >
                    {event.title}
                  </h2>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingEvent(event)}
                      className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                      aria-label="Edit event"
                      title="Edit event"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPermissionSlipEventId(null);
                        setSelectedSubmissionStudent(null);
                        setPermissionFormFileSelected(false);
                        setPermissionFormPreviewExpanded(false);
                      }}
                      className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                      aria-label="Close"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="space-y-4 px-6 py-5">
                  {(status?.className ||
                    (event.classId &&
                      classes.find((c) => c.id === event.classId)?.name)) && (
                    <p className="text-sm text-zinc-500">
                      {status?.className ??
                        classes.find((c) => c.id === event.classId)?.name}
                    </p>
                  )}
                  <div className="text-sm text-zinc-600">
                    {event.occurrenceDates &&
                    event.occurrenceDates.length > 1 ? (
                      <>
                        <span>
                          {formatEventTimeRange(event.startAt, event.endAt).split(" · ")[1]}{" "}
                          (each date)
                        </span>
                        <span className="mt-2 block font-medium text-zinc-700">
                          All {event.occurrenceDates.length} dates:
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {event.occurrenceDates.map((d) => (
                            <span
                              key={d}
                              className="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
                            >
                              {new Date(d + "T12:00:00").toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      formatEventTimeRange(event.startAt, event.endAt)
                    )}
                  </div>
                  {event.description && (
                    <p className="text-sm text-zinc-500">
                      {event.description}
                    </p>
                  )}
                  {(event.cost != null && event.cost > 0) && (
                    <p className="text-sm font-medium text-zinc-700">
                      Cost: ${event.cost.toFixed(2)}
                    </p>
                  )}

                  {(event.requiresPermissionSlip || (event.cost != null && event.cost > 0)) && (
                  <>
                  {event.requiresPermissionSlip && (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                    <h3 className="text-sm font-semibold text-zinc-800">
                      Permission form
                    </h3>
                    {event.hasPermissionForm ? (
                      <p className="mt-1 text-sm text-emerald-600">
                        Form uploaded ✓
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-amber-600">
                        No form uploaded — upload a PDF for parents to sign
                      </p>
                    )}
                    <form
                      onSubmit={handleUploadForm}
                      className="mt-3 flex flex-wrap items-center gap-2"
                    >
                      <input
                        type="file"
                        name="pdf"
                        accept=".pdf,application/pdf"
                        disabled={!!uploadingFormEventId}
                        onChange={(e) =>
                          setPermissionFormFileSelected(
                            !!e.target.files?.[0]
                          )
                        }
                        className="block text-sm text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-amber-800 hover:file:bg-amber-200"
                      />
                      <button
                        type="submit"
                        disabled={
                          !!uploadingFormEventId ||
                          (event.hasPermissionForm &&
                            !permissionFormFileSelected)
                        }
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-600"
                      >
                        {isUploading
                          ? "Uploading..."
                          : event.hasPermissionForm
                            ? "Replace form"
                            : "Upload form"}
                      </button>
                    </form>
                    <p className="mt-2 text-xs text-zinc-500">
                      Parents will download this PDF to sign and return.
                    </p>
                    <div className="mt-4">
                      {event.hasPermissionForm ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPermissionFormPreviewExpanded(
                                !permissionFormPreviewExpanded
                              )
                            }
                            className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            <span>
                              {permissionFormPreviewExpanded
                                ? "Hide form preview"
                                : "Show form preview"}
                            </span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${permissionFormPreviewExpanded ? "rotate-180" : ""}`}>
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                          {permissionFormPreviewExpanded && (
                            <div className="mt-2">
                              <div className="h-[400px] overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                <iframe
                                  src={`/api/event/${event.id}/permission-form`}
                                  title="Permission form preview"
                                  className="h-full w-full"
                                />
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-zinc-500">
                          Upload a form above to preview it.
                        </p>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Student submissions & payment (combined) */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                    <h3 className="text-sm font-semibold text-zinc-800">
                      Student submissions & payment
                    </h3>
                    {event.cost != null && event.cost > 0 && (
                      <div className="mt-2 space-y-1 text-sm text-zinc-600">
                        <p>
                          Cost per student: ${event.cost.toFixed(2)}
                          {event.occurrenceDates &&
                            event.occurrenceDates.length > 1 &&
                            event.costPerOccurrence != null &&
                            event.costPerOccurrence > 0 && (
                              <span className="text-zinc-500">
                                {" "}
                                ({event.occurrenceDates.length} dates × $
                                {event.costPerOccurrence.toFixed(2)})
                              </span>
                            )}
                        </p>
                        {signed.length > 0 && (
                          <p className="font-medium text-zinc-800">
                            Expected total: $
                            {(event.cost * signed.length).toFixed(2)}
                          </p>
                        )}
                        {(() => {
                          const payOnline = signed.filter(
                            (s) => s.paymentMethod === "online"
                          ).length;
                          const payCash = signed.filter(
                            (s) => s.paymentMethod === "cash"
                          ).length;
                          const cashReceived = signed.filter(
                            (s) =>
                              s.paymentMethod === "cash" && s.cashReceived
                          ).length;
                          const cashOutstanding = payCash - cashReceived;
                          const awaiting = signed.length - payOnline - payCash;
                          return (
                            (payOnline > 0 ||
                              payCash > 0 ||
                              awaiting > 0) && (
                              <p className="text-xs text-zinc-500">
                                {payOnline > 0 && (
                                  <span className="text-emerald-700">
                                    {payOnline} online
                                  </span>
                                )}
                                {payOnline > 0 && payCash > 0 && " · "}
                                {payCash > 0 && (
                                  <span className="text-amber-700">
                                    {payCash} cash
                                    {cashReceived > 0 &&
                                      ` (${cashReceived} received)`}
                                    {cashOutstanding > 0 &&
                                      ` (${cashOutstanding} pending)`}
                                  </span>
                                )}
                                {(payOnline > 0 || payCash > 0) &&
                                  awaiting > 0 &&
                                  " · "}
                                {awaiting > 0 && (
                                  <span>{awaiting} no method</span>
                                )}
                              </p>
                            )
                          );
                        })()}
                      </div>
                    )}
                    {event.cost == null || event.cost === 0 ? (
                      <p className="mt-1 text-sm text-zinc-500">
                        No cost for this event.
                      </p>
                    ) : null}
                    {status && status.students.length > 0 ? (
                      <div className="mt-4">
                        <StudentSubmissionsAndPaymentTable
                          students={status.students}
                          eventCost={event.cost ?? 0}
                          onMarkCashReceived={async (slipId, received) => {
                            const { success } =
                              await markCashReceivedAction(slipId, received);
                            if (success) router.refresh();
                          }}
                          onRowClick={setSelectedSubmissionStudent}
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-500">
                        No students in this class yet.
                      </p>
                    )}
                  </div>
                  {selectedSubmissionStudent && (
                        <div
                          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
                          onClick={() =>
                            setSelectedSubmissionStudent(null)
                          }
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="submission-detail-title"
                        >
                          <div
                            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex shrink-0 items-start justify-between border-b border-zinc-200 px-6 py-4">
                              <h3
                                id="submission-detail-title"
                                className="text-lg font-semibold text-zinc-900"
                              >
                                {selectedSubmissionStudent.studentName}
                              </h3>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedSubmissionStudent(null)
                                }
                                className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                                aria-label="Close"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 6 6 18" />
                                  <path d="m6 6 12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="flex-1 overflow-y-auto px-6 py-4">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs font-medium text-zinc-500">Status</p>
                                  <p className="mt-0.5 text-sm font-medium">
                                    {selectedSubmissionStudent.status === "signed" ? (
                                      <span className="text-emerald-600">Submitted</span>
                                    ) : selectedSubmissionStudent.status === "pending" ? (
                                      <span className="text-red-600">Not submitted</span>
                                    ) : (
                                      <span className="text-amber-600">No parent linked</span>
                                    )}
                                  </p>
                                </div>
                                {selectedSubmissionStudent.signedBy && (
                                  <div>
                                    <p className="text-xs font-medium text-zinc-500">Signed by</p>
                                    <p className="mt-0.5 text-sm text-zinc-700">{selectedSubmissionStudent.signedBy}</p>
                                  </div>
                                )}
                                {selectedSubmissionStudent.paymentMethod && (
                                  <div>
                                    <p className="text-xs font-medium text-zinc-500">Payment</p>
                                    <p className="mt-0.5 text-sm text-zinc-700">
                                      {selectedSubmissionStudent.paymentMethod === "online" ? "Pay online" : "Sending cash with child"}
                                    </p>
                                  </div>
                                )}
                                {selectedSubmissionStudent.status === "signed" && selectedSubmissionStudent.slipId && (
                                  <>
                                    <div className="overflow-hidden rounded-lg border border-zinc-200">
                                      <iframe
                                        src={`/api/permission-slip/${selectedSubmissionStudent.slipId}/download?preview=1`}
                                        title="Submitted permission slip"
                                        className="h-[400px] w-full min-h-[280px] bg-white"
                                      />
                                    </div>
                                    <a
                                      href={`/api/permission-slip/${selectedSubmissionStudent.slipId}/download`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" x2="12" y1="15" y2="3" />
                                      </svg>
                                      Download PDF
                                    </a>
                                  </>
                                )}
                                {selectedSubmissionStudent.status === "pending" && (
                                  <p className="text-sm text-zinc-500">Awaiting submission from parent. Parents see this in their Inbox.</p>
                                )}
                                {selectedSubmissionStudent.status === "no_parent" && event && status?.classId && (
                                  <div className="space-y-3 border-t border-zinc-200 pt-4">
                                    <p className="text-sm text-zinc-500">No parent is linked to this student. You can manually upload a signed permission form (e.g. from a paper copy).</p>
                                    <form
                                      onSubmit={async (e) => {
                                        e.preventDefault();
                                        const form = e.currentTarget;
                                        const formData = new FormData(form);
                                        const file = formData.get("pdf") as File | null;
                                        if (!file || file.size === 0) {
                                          alert("Please select a PDF file");
                                          return;
                                        }
                                        if (file.size > 5 * 1024 * 1024) {
                                          alert("File is too large. Please use a PDF under 5 MB.");
                                          return;
                                        }
                                        setUploadingManualSlipFor(selectedSubmissionStudent.studentId);
                                        try {
                                          const { success, error } = await uploadPermissionSlipForStudentAction(event.id, status.classId, selectedSubmissionStudent.studentId, formData);
                                          if (success) {
                                            form.reset();
                                            setSelectedSubmissionStudent(null);
                                            setSelectedPermissionSlipEventId(null);
                                            router.refresh();
                                          } else if (error) {
                                            alert(error);
                                          }
                                        } catch (err) {
                                          alert("Something went wrong. Please try again.");
                                        } finally {
                                          setUploadingManualSlipFor(null);
                                        }
                                      }}
                                      className="flex flex-col gap-3"
                                    >
                                      {(event.cost != null && event.cost > 0) && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                                          <p className="mb-2 text-sm font-medium text-zinc-800">Payment method for this parent</p>
                                          <div className="flex flex-col gap-2">
                                            <label className="flex cursor-pointer items-center gap-2">
                                              <input type="radio" name="paymentMethod" value="online" required={event.cost > 0} disabled={!!uploadingManualSlipFor} className="h-4 w-4 border-zinc-300 text-amber-600 focus:ring-amber-500" />
                                              <span className="text-sm font-medium text-zinc-900">Pay online</span>
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2">
                                              <input type="radio" name="paymentMethod" value="cash" defaultChecked required={event.cost > 0} disabled={!!uploadingManualSlipFor} className="h-4 w-4 border-zinc-300 text-amber-600 focus:ring-amber-500" />
                                              <span className="text-sm font-medium text-zinc-900">Sending cash with child</span>
                                            </label>
                                          </div>
                                        </div>
                                      )}
                                      <div className="flex flex-wrap items-center gap-2">
                                        <input type="file" name="pdf" accept=".pdf,application/pdf" disabled={!!uploadingManualSlipFor} className="block text-sm text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-amber-800 hover:file:bg-amber-200" />
                                        <button type="submit" disabled={!!uploadingManualSlipFor} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                                          {uploadingManualSlipFor === selectedSubmissionStudent.studentId ? "Uploading..." : "Upload signed PDF"}
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        <AddEventModal
          classes={classes}
          isOpen={isAddEventOpen}
          onClose={() => setIsAddEventOpen(false)}
        />

        {addStudentsClass && (
          <AddStudentsModal
            classInfo={addStudentsClass}
            isOpen={!!addStudentsClass}
            onClose={() => setAddStudentsClass(null)}
          />
        )}

        <EditEventModal
          event={editingEvent}
          className={
            editingEvent && statusByEvent.get(editingEvent.id)?.className
          }
          isOpen={!!editingEvent}
          onClose={() => setEditingEvent(null)}
        />
      </main>
    </div>
  );
}
