"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  TeacherClassSerialized,
  CalendarEventSerialized,
  ClassStudentSerialized,
  TeacherInterviewClass,
  StudentWithGuardians,
} from "@/lib/teacher-dashboard";
import type { ReportCardSerialized } from "@/lib/report-cards";
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
  publishReportCardAction,
} from "@/app/actions";
import { AddReportCardModal } from "./add-report-card-modal";
import { AddInterviewSlotsModal } from "./add-interview-slots-modal";
import { BookSlotModal } from "./book-slot-modal";
import {
  deleteInterviewSlotAction,
  deleteAllInterviewSlotsForClassAction,
  unbookInterviewSlotAction,
} from "@/app/actions";
import { MessageThreadModal } from "./message-thread-modal";

interface TeacherDashboardProps {
  userName: string | null;
  classes: TeacherClassSerialized[];
  upcomingEvents: CalendarEventSerialized[];
  permissionSlipEvents: CalendarEventSerialized[];
  permissionSlipStatus: EventPermissionStatus[];
  reportCards: ReportCardSerialized[];
  interviewSlotsByClass: TeacherInterviewClass[];
  studentsWithGuardians: StudentWithGuardians[];
  conversationSummaries: Record<
    string,
    {
      conversationId: string;
      lastMessageAt: string;
      lastMessagePreview: string | null;
      messageCount: number;
    }
  >;
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
  const isAllDay =
    start.getHours() === 0 &&
    start.getMinutes() === 0 &&
    (end.getHours() === 23 || (end.getHours() === 0 && end.getMinutes() === 0 && end.getDate() > start.getDate()));
  const timeStr = isAllDay
    ? "All day"
    : `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return `${dateStr} · ${timeStr}`;
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
  classes,
  onEventClick,
}: {
  events: CalendarEventSerialized[];
  classes: { id: string; name: string }[];
  onEventClick: (eventId: string) => void;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [classFilterOpen, setClassFilterOpen] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string> | null>(null);

  const filteredEvents =
    selectedClassIds === null
      ? events
      : selectedClassIds.size === 0
        ? []
        : events.filter(
            (e) => !e.classId || selectedClassIds.has(e.classId)
          );

  const selectedCount =
    selectedClassIds === null
      ? classes.length
      : selectedClassIds.size;

  function toggleClass(classId: string) {
    setSelectedClassIds((prev) => {
      const next = new Set(prev ?? classes.map((c) => c.id));
      if (next.has(classId)) {
        next.delete(classId);
        return next;
      }
      next.add(classId);
      return next.size === classes.length ? null : next;
    });
  }

  function selectAllClasses() {
    setSelectedClassIds(null);
  }

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

  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const eventSortKey = (ev: CalendarEventSerialized, cellDateStr: string): number => {
    let timePart = "12:00:00";
    if (ev.startAt.includes("T")) {
      const afterT = ev.startAt.slice(11);
      const match = afterT.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (match) {
        const [, h = "12", m = "00", s] = match;
        timePart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${(s ?? "00").padStart(2, "0")}`;
      }
    }
    const sortStr = `${cellDateStr}T${timePart}`;
    const ts = new Date(sortStr).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  };
  const eventsByDate = new Map<string, CalendarEventSerialized[]>();
  for (const event of filteredEvents) {
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

  const filterLabel =
    selectedClassIds === null || selectedClassIds.size === classes.length
      ? "All classes"
      : selectedClassIds.size === 0
        ? "No classes"
        : `${selectedCount} class${selectedCount !== 1 ? "es" : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
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
        {classes.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setClassFilterOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              {filterLabel}
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
                className={classFilterOpen ? "rotate-180" : ""}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {classFilterOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden="true"
                  onClick={() => setClassFilterOpen(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-zinc-200 bg-white py-2 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      selectAllClasses();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    <span
                      className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                        selectedClassIds === null || selectedClassIds.size === classes.length
                          ? "border-red-600 bg-red-600"
                          : "border-zinc-300"
                      }`}
                    >
                      {(selectedClassIds === null || selectedClassIds.size === classes.length) && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    All classes
                  </button>
                  {classes.map((cls) => {
                    const isSelected =
                      selectedClassIds === null ||
                      selectedClassIds.has(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => toggleClass(cls.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                      >
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                            isSelected
                              ? "border-red-600 bg-red-600"
                              : "border-zinc-300"
                          }`}
                        >
                          {isSelected && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                        </span>
                        {cls.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
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
            const dayEventsRaw = eventsByDate.get(key) ?? [];
            const dayEvents = [...dayEventsRaw].sort(
              (a, b) => eventSortKey(a, key) - eventSortKey(b, key)
            );
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
        {filteredEvents.length === 0 && (
          <div className="border-t border-zinc-200 p-8 text-center">
            <p className="text-zinc-600">
              No upcoming events. Add events from the Events tab.
            </p>
          </div>
        )}
      </div>
      {filteredEvents.length > 0 && (
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
  onLink,
  onUnlink,
}: {
  student: ClassStudentSerialized;
  guardians: { id: string; name: string }[];
  classId: string;
  onLink: (guardianId: string) => void;
  onUnlink: (guardianId: string) => void;
}) {
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState("");

  const unlinkedGuardians = guardians.filter(
    (g) => !student.guardianIds.includes(g.id)
  );

  const filteredGuardians = linkSearchQuery.trim()
    ? unlinkedGuardians.filter((g) =>
        g.name.toLowerCase().includes(linkSearchQuery.toLowerCase().trim())
      )
    : unlinkedGuardians;

  function handleLink(guardianId: string) {
    if (!guardianId) return;
    setLinkDropdownOpen(false);
    setLinkSearchQuery("");
    onLink(guardianId);
  }

  function handleUnlink(guardianId: string) {
    const g = guardians.find((x) => x.id === guardianId);
    const name = g?.name ?? "this parent";
    if (!confirm(`Remove link between ${student.name} and ${name}? This can be undone by linking again.`)) return;
    onUnlink(guardianId);
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
        {student.guardianIds.map((gid) => {
          const g = guardians.find((x) => x.id === gid);
          return (
            <button
              key={gid}
              type="button"
              onClick={() => handleUnlink(gid)}
              className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
              title="Unlink"
            >
              ✕ {g?.name ?? "Parent"}
            </button>
          );
        })}
        {unlinkedGuardians.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setLinkDropdownOpen((o) => !o)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 hover:bg-zinc-50"
            >
              + Link parent
            </button>
            {linkDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden="true"
                  onClick={() => {
                    setLinkDropdownOpen(false);
                    setLinkSearchQuery("");
                  }}
                />
                <div className="absolute left-0 top-full z-20 mt-1 min-w-[200px] max-w-[280px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-zinc-100 px-2 pb-2">
                    <input
                      type="text"
                      value={linkSearchQuery}
                      onChange={(e) => setLinkSearchQuery(e.target.value)}
                      placeholder="Search parents..."
                      className="w-full rounded border border-zinc-200 px-2 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-300"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {filteredGuardians.length > 0 ? (
                      filteredGuardians.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleLink(g.id)}
                          className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          {g.name}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-xs text-zinc-500">
                        {linkSearchQuery.trim()
                          ? "No parents match your search"
                          : "No parents to link"}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : guardians.length === 0 ? (
          <span className="text-xs text-zinc-400">No parents in class yet</span>
        ) : null}
      </div>
    </div>
  );
}

type Tab = "classes" | "permissionslips" | "events" | "messages" | "reportcards" | "interviews";

export function TeacherDashboard({
  userName,
  classes,
  upcomingEvents,
  permissionSlipEvents,
  permissionSlipStatus,
  reportCards,
  interviewSlotsByClass,
  studentsWithGuardians,
  conversationSummaries,
}: TeacherDashboardProps) {
  const router = useRouter();
  const [classesState, setClassesState] = useState(classes);
  const [slotsByClass, setSlotsByClass] = useState(interviewSlotsByClass);
  const [permissionSlipStatusState, setPermissionSlipStatusState] =
    useState(permissionSlipStatus);
  useEffect(() => {
    setClassesState(classes);
  }, [classes]);
  useEffect(() => {
    setSlotsByClass(interviewSlotsByClass);
  }, [interviewSlotsByClass]);

  function handleLinkGuardian(classId: string, studentId: string, guardianId: string) {
    const guardian = classesState.find((c) => c.id === classId)?.guardians?.find((g) => g.id === guardianId);
    const guardianName = guardian?.name ?? "Parent";
    const prev = classesState;
    setClassesState((arr) =>
      arr.map((cls) =>
        cls.id !== classId
          ? cls
          : {
              ...cls,
              students: cls.students.map((s) =>
                s.id !== studentId
                  ? s
                  : {
                      ...s,
                      guardianIds: [...s.guardianIds, guardianId],
                      guardianNames: [...s.guardianNames, guardianName],
                    }
              ),
            }
      )
    );
    linkGuardianAction(classId, studentId, guardianId).then((res) => {
      if (!res.success && res.error) {
        setClassesState(prev);
        alert(res.error);
      }
    });
  }

  function handleUnlinkGuardian(classId: string, studentId: string, guardianId: string) {
    const prev = classesState;
    setClassesState((arr) =>
      arr.map((cls) =>
        cls.id !== classId
          ? cls
          : {
              ...cls,
              students: cls.students.map((s) =>
                s.id !== studentId
                  ? s
                  : {
                      ...s,
                      guardianIds: s.guardianIds.filter((id) => id !== guardianId),
                      guardianNames: s.guardianIds
                        .map((id, i) => (id === guardianId ? null : s.guardianNames[i] ?? ""))
                        .filter((n): n is string => n !== null),
                    }
              ),
            }
      )
    );
    unlinkGuardianAction(classId, studentId, guardianId).then((res) => {
      if (!res.success && res.error) {
        setClassesState(prev);
        alert(res.error);
      }
    });
  }
  useEffect(() => {
    setPermissionSlipStatusState(permissionSlipStatus);
  }, [permissionSlipStatus]);
  const statusByEvent = new Map(
    permissionSlipStatusState.map((s) => [s.eventId, s])
  );
  const firstName = userName?.split(/\s+/)[0] ?? "there";
  const [activeTab, setActiveTab] = useState<Tab>("classes");
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [addStudentsClass, setAddStudentsClass] =
    useState<TeacherClassSerialized | null>(null);
  const [viewAllStudentsClassId, setViewAllStudentsClassId] = useState<string | null>(null);
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
  const [selectedReportCardStudent, setSelectedReportCardStudent] = useState<{
    id: string;
    name: string;
    classTerm: string;
  } | null>(null);
  const [addReportCardStudent, setAddReportCardStudent] = useState<{
    id: string;
    name: string;
    classTerm: string;
  } | null>(null);
  const [publishPendingReportCardId, setPublishPendingReportCardId] =
    useState<string | null>(null);
  const [bookSlotFor, setBookSlotFor] = useState<{
    slot: import("@/lib/interview-slots").InterviewSlotSerialized;
    classId: string;
    className: string;
    studentIdsWithSlot: string[];
  } | null>(null);
  const [openSlotMenuId, setOpenSlotMenuId] = useState<string | null>(null);
  const [openRemoveAllMenuClassId, setOpenRemoveAllMenuClassId] = useState<string | null>(null);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);
  const [deletingAllSlotsForClassId, setDeletingAllSlotsForClassId] = useState<string | null>(null);
  const [unbookingSlotId, setUnbookingSlotId] = useState<string | null>(null);
  const [selectedMessageStudent, setSelectedMessageStudent] = useState<{
    studentId: string;
    studentName: string;
    schoolId: string;
  } | null>(null);
  const [selectedMessageGuardian, setSelectedMessageGuardian] = useState<{
    guardianId: string;
    guardianName: string;
    conversationId: string | null;
  } | null>(null);
  const [addSlotsClass, setAddSlotsClass] = useState<{
    classId: string;
    className: string;
  } | null>(null);

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
            <button
              type="button"
              onClick={() => setActiveTab("reportcards")}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === "reportcards"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Report Cards
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("interviews")}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === "interviews"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Interviews
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900">
              My Classes
            </h2>
            <Link
              href="/onboarding/create-class"
              className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Create new class
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {classesState.map((cls) => (
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
                    <p className="text-xs text-zinc-500">
                      {cls.students.length} student{cls.students.length !== 1 ? "s" : ""}.{" "}
                      <button
                        type="button"
                        onClick={() => setViewAllStudentsClassId(cls.id)}
                        className="font-medium text-zinc-700 hover:text-zinc-900"
                      >
                        View all
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-500">
                      No students yet. Add students and link them to parents.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Events tab - shows all events (permission slip or not), grouped by class */}
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
          <div className="space-y-6">
            <p className="text-sm text-zinc-600">
              Upcoming events by class. Click one to view details. Events that require
              permission slips show submission and payment status.
            </p>
            {classesState.map((cls) => {
              const classEvents = permissionSlipEvents.filter(
                (e) => e.classId === cls.id
              );
              if (classEvents.length === 0) return null;
              return (
                <div
                  key={cls.id}
                  className="rounded-xl border border-zinc-200 bg-white overflow-hidden"
                >
                  <h3 className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 font-medium text-zinc-900">
                    {cls.name}
                  </h3>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50/70">
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
                      {classEvents.map((event, i) => {
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
              );
            })}
            {permissionSlipEvents.some((e) => !e.classId) && (
              <div
                className="rounded-xl border border-zinc-200 bg-white overflow-hidden"
              >
                <h3 className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 font-medium text-zinc-900">
                  All classes
                </h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/70">
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
                    {permissionSlipEvents
                      .filter((e) => !e.classId)
                      .map((event, i) => {
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
            )}
          </div>
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
            classes={classesState.map((c) => ({ id: c.id, name: c.name }))}
            onEventClick={(eventId) => {
              setSelectedPermissionSlipEventId(eventId);
            }}
          />
        </section>
        )}

        {/* Messages tab */}
        {activeTab === "messages" && (
        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-900">
            Messages
          </h2>
          {studentsWithGuardians.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center">
              <p className="text-zinc-600">
                No students with linked parents yet. Link parents to students in
                My Classes to message them.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <ul className="divide-y divide-zinc-200">
                {studentsWithGuardians.map((swg) => {
                  const guardianCount = swg.guardians.length;
                  const schoolId =
                    classes.find((c) =>
                      c.studentIds?.includes(swg.studentId)
                    )?.schoolId ?? "";
                  const onClick = () => {
                    const student = {
                      studentId: swg.studentId,
                      studentName: swg.studentName,
                      schoolId,
                    };
                    setSelectedMessageStudent(student);
                    if (guardianCount === 1) {
                      const g = swg.guardians[0];
                      const key = `${g.guardianId}:${swg.studentId}`;
                      const sum = conversationSummaries[key];
                      setSelectedMessageGuardian({
                        guardianId: g.guardianId,
                        guardianName: g.guardianName,
                        conversationId: sum?.conversationId ?? null,
                      });
                    } else {
                      setSelectedMessageGuardian(null);
                    }
                  };
                  return (
                    <li key={swg.studentId}>
                      <button
                        type="button"
                        onClick={onClick}
                        className="grid w-full grid-cols-[1fr_7.5rem_2rem] items-center gap-4 px-4 py-3 text-left hover:bg-zinc-50"
                      >
                        <span className="min-w-0 truncate font-medium text-zinc-900">
                          {swg.studentName}
                        </span>
                        <span className="text-right text-sm text-zinc-500">
                          {guardianCount} parent{guardianCount !== 1 ? "s" : ""}
                        </span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="shrink-0 text-zinc-400"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {selectedMessageStudent && !selectedMessageGuardian && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setSelectedMessageStudent(null)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="messages-modal-title"
            >
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
                  <h2
                    id="messages-modal-title"
                    className="text-lg font-semibold text-zinc-900"
                  >
                    Messages — {selectedMessageStudent.studentName}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedMessageStudent(null)}
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
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
                <ul className="divide-y divide-zinc-200">
                  {(() => {
                    const swg = studentsWithGuardians.find(
                      (s) => s.studentId === selectedMessageStudent.studentId
                    );
                    if (!swg) return null;
                    return swg.guardians.map((g) => {
                      const key = `${g.guardianId}:${swg.studentId}`;
                      const sum = conversationSummaries[key];
                      return (
                        <li key={g.guardianId}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedMessageGuardian({
                                guardianId: g.guardianId,
                                guardianName: g.guardianName,
                                conversationId: sum?.conversationId ?? null,
                              })
                            }
                            className="grid w-full grid-cols-[1fr_auto_2rem] items-center gap-4 px-6 py-3 text-left hover:bg-zinc-50"
                          >
                            <div className="min-w-0">
                              <span className="font-medium text-zinc-900">
                                {g.guardianName}
                              </span>
                              {sum?.lastMessagePreview ? (
                                <p className="mt-0.5 truncate text-sm text-zinc-500">
                                  {sum.lastMessagePreview}
                                </p>
                              ) : (
                                <p className="mt-0.5 text-sm text-zinc-400">
                                  Start conversation
                                </p>
                              )}
                            </div>
                            {sum?.messageCount ? (
                              <span className="text-xs text-zinc-500">
                                {sum.messageCount} message
                                {sum.messageCount !== 1 ? "s" : ""}
                              </span>
                            ) : null}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="shrink-0 text-zinc-400"
                            >
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </button>
                        </li>
                      );
                    });
                  })()}
                </ul>
              </div>
            </div>
          )}
          {selectedMessageStudent && selectedMessageGuardian && (
            <MessageThreadModal
              guardianId={selectedMessageGuardian.guardianId}
              guardianName={selectedMessageGuardian.guardianName}
              studentId={selectedMessageStudent.studentId}
              studentName={selectedMessageStudent.studentName}
              schoolId={selectedMessageStudent.schoolId}
              existingConversationId={
                selectedMessageGuardian.conversationId
              }
              isOpen={true}
              onClose={() => {
                setSelectedMessageGuardian(null);
                setSelectedMessageStudent(null);
                router.refresh();
              }}
            />
          )}
        </section>
        )}

        {/* Report cards tab */}
        {activeTab === "reportcards" && (
        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-900">
            Report Cards
          </h2>
          {(() => {
            const students = (() => {
              const seen = new Set<string>();
              const out: { id: string; name: string; classTerm: string }[] = [];
              for (const cls of classes) {
                for (const s of cls.students) {
                  if (!seen.has(s.id)) {
                    seen.add(s.id);
                    out.push({ id: s.id, name: s.name, classTerm: cls.term });
                  }
                }
              }
              return out.sort((a, b) => a.name.localeCompare(b.name));
            })();
            const cardsByStudent = new Map<string, ReportCardSerialized[]>();
            for (const rc of reportCards) {
              const list = cardsByStudent.get(rc.studentId) ?? [];
              list.push(rc);
              cardsByStudent.set(rc.studentId, list);
            }
            return (
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <ul className="divide-y divide-zinc-200">
                  {students.map((stu) => {
                    const cards = cardsByStudent.get(stu.id) ?? [];
                    return (
                      <li key={stu.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedReportCardStudent({
                              id: stu.id,
                              name: stu.name,
                              classTerm: stu.classTerm,
                            })
                          }
                          className="grid w-full grid-cols-[1fr_7.5rem_2rem] items-center gap-4 px-4 py-3 text-left hover:bg-zinc-50"
                        >
                          <span className="min-w-0 truncate font-medium text-zinc-900">
                            {stu.name}
                          </span>
                          <span className="text-right text-sm text-zinc-500">
                            {cards.length} report card{cards.length !== 1 ? "s" : ""}
                          </span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="shrink-0 text-zinc-400"
                          >
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}
          {selectedReportCardStudent && !addReportCardStudent && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setSelectedReportCardStudent(null)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-cards-modal-title"
            >
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
                  <h2
                    id="report-cards-modal-title"
                    className="text-lg font-semibold text-zinc-900"
                  >
                    Report Cards — {selectedReportCardStudent.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedReportCardStudent(null)}
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
                <div className="space-y-4 px-6 py-5">
                  <button
                    type="button"
                    onClick={() =>
                      setAddReportCardStudent(selectedReportCardStudent)
                    }
                    className="w-full rounded-lg border border-dashed border-zinc-300 py-3 text-sm font-medium text-red-600 hover:border-red-300 hover:bg-red-50/50"
                  >
                    + Add report card
                  </button>
                  {(() => {
                    const cards = reportCards.filter(
                      (rc) => rc.studentId === selectedReportCardStudent.id
                    );
                    if (cards.length === 0) {
                      return (
                        <p className="py-4 text-center text-sm text-zinc-500">
                          No report cards yet.
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-3">
                        {cards.map((rc) => (
                          <div
                            key={rc.id}
                            className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-zinc-800">
                                {rc.term}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                  rc.status === "published"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {rc.status}
                              </span>
                            </div>
                            <div className="mt-2 overflow-hidden rounded border border-zinc-200">
                              <iframe
                                src={`/api/report-card/${rc.id}/download?preview=1`}
                                title={`Report card ${rc.term}`}
                                className="h-[280px] w-full min-h-[200px] bg-white"
                              />
                            </div>
                            <div className="mt-2 flex gap-2">
                              <a
                                href={`/api/report-card/${rc.id}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
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
                            </div>
                            {rc.status === "draft" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPublishPendingReportCardId(rc.id);
                                  publishReportCardAction(rc.id).then(
                                    (res) => {
                                      setPublishPendingReportCardId(null);
                                      if (res.success) router.refresh();
                                      else if (res.error) alert(res.error);
                                    }
                                  );
                                }}
                                disabled={!!publishPendingReportCardId}
                                className="mt-2 rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-200 disabled:opacity-50"
                              >
                                {publishPendingReportCardId === rc.id
                                  ? "Publishing..."
                                  : "Publish"}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
          {addReportCardStudent && (
            <AddReportCardModal
              studentId={addReportCardStudent.id}
              studentName={addReportCardStudent.name}
              classTerm={addReportCardStudent.classTerm}
              isOpen={true}
              onClose={() => {
                setAddReportCardStudent(null);
                router.refresh();
              }}
            />
          )}
        </section>
        )}

        {/* Interviews tab */}
        {activeTab === "interviews" && (
        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-900">
            Parent-Teacher Interviews
          </h2>
          <p className="mb-4 text-sm text-zinc-600">
            Add time slots for interviews. Parents can claim one slot per child.
          </p>
          {slotsByClass.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No slots yet. Add slots from your classes below.
            </p>
          ) : (
            <div className="space-y-6">
              {slotsByClass.map(({ classId, className, slots }) => (
                <div
                  key={classId}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-medium text-zinc-900">{className}</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setAddSlotsClass({ classId, className })
                      }
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      + Add slots
                    </button>
                  </div>
                  {slots.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No slots yet.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-zinc-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-zinc-50">
                            <th className="px-3 py-2 text-left font-medium text-zinc-700">
                              Time
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-zinc-700">
                              Status
                            </th>
                            <th className="px-3 py-2 text-right font-medium text-zinc-700">
                              <div className="flex items-center justify-end gap-1">
                                <span>Actions</span>
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenRemoveAllMenuClassId(
                                        openRemoveAllMenuClassId === classId ? null : classId
                                      )
                                    }
                                    disabled={deletingAllSlotsForClassId !== null}
                                    className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                                    aria-label="Actions menu"
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
                                      <circle cx="12" cy="12" r="1" />
                                      <circle cx="12" cy="5" r="1" />
                                      <circle cx="12" cy="19" r="1" />
                                    </svg>
                                  </button>
                                  {openRemoveAllMenuClassId === classId && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-10"
                                        aria-hidden="true"
                                        onClick={() => setOpenRemoveAllMenuClassId(null)}
                                      />
                                      <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            setOpenRemoveAllMenuClassId(null);
                                            if (
                                              !confirm(
                                                `Remove all ${slots.length} time slots for ${className}? This cannot be undone.`
                                              )
                                            )
                                              return;
                                            setDeletingAllSlotsForClassId(classId);
                                            const prev = slotsByClass;
                                            const res = await deleteAllInterviewSlotsForClassAction(classId);
                                            setDeletingAllSlotsForClassId(null);
                                            if (!res.success && res.error) {
                                              setSlotsByClass(prev);
                                              alert(res.error);
                                              return;
                                            }
                                            setSlotsByClass((arr) =>
                                              arr.map((c) =>
                                                c.classId !== classId
                                                  ? c
                                                  : { ...c, slots: [] }
                                              )
                                            );
                                            router.refresh();
                                          }}
                                          disabled={deletingAllSlotsForClassId !== null}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                                        >
                                          {deletingAllSlotsForClassId === classId ? (
                                            <>
                                              <svg
                                                className="h-4 w-4 shrink-0 animate-spin"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                              >
                                                <circle
                                                  className="opacity-25"
                                                  cx="12"
                                                  cy="12"
                                                  r="10"
                                                  stroke="currentColor"
                                                  strokeWidth="4"
                                                />
                                                <path
                                                  className="opacity-75"
                                                  fill="currentColor"
                                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                              </svg>
                                              Removing...
                                            </>
                                          ) : (
                                            "Remove all time slots"
                                          )}
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {slots.map((s) => {
                            const start = new Date(s.startAt);
                            const end = new Date(s.endAt);
                            const timeStr = `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
                            const dateStr = start.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            });
                            const cls = classes.find((c) => c.id === classId);
                            const students = cls?.students ?? [];
                            const studentIdsWithSlot = slots
                              .filter((x) => x.studentId)
                              .map((x) => x.studentId!);
                            return (
                              <tr
                                key={s.id}
                                className="border-b border-zinc-100 last:border-0"
                              >
                                <td className="px-3 py-2 font-medium text-zinc-900">
                                  {dateStr} · {timeStr}
                                </td>
                                <td className="px-3 py-2">
                                  {s.isClaimed ? (
                                    <span className="text-zinc-600">
                                      <span className="text-zinc-500">
                                        Parent:
                                      </span>{" "}
                                      {s.guardianName}
                                      <span className="mx-1.5 text-zinc-400">
                                        ·
                                      </span>
                                      <span className="text-zinc-500">
                                        Student:
                                      </span>{" "}
                                      {s.studentName}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-400">
                                      Available
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="relative flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenSlotMenuId(
                                          openSlotMenuId === s.id ? null : s.id
                                        )
                                      }
                                      className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                                      aria-label="Slot options"
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
                                        <circle cx="12" cy="12" r="1" />
                                        <circle cx="12" cy="5" r="1" />
                                        <circle cx="12" cy="19" r="1" />
                                      </svg>
                                    </button>
                                    {openSlotMenuId === s.id && (
                                      <>
                                        <div
                                          className="fixed inset-0 z-10"
                                          aria-hidden="true"
                                          onClick={() =>
                                            setOpenSlotMenuId(null)
                                          }
                                        />
                                        <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                                          {s.isClaimed ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setOpenSlotMenuId(null);
                                                const prev = slotsByClass;
                                                setSlotsByClass((arr) =>
                                                  arr.map((c) =>
                                                    c.classId !== classId
                                                      ? c
                                                      : {
                                                          ...c,
                                                          slots: c.slots.map(
                                                            (slot) =>
                                                              slot.id !== s.id
                                                                ? slot
                                                                : {
                                                                    ...slot,
                                                                    isClaimed: false,
                                                                    studentId: undefined,
                                                                    studentName: undefined,
                                                                    guardianId: undefined,
                                                                    guardianName: undefined,
                                                                  }
                                                          ),
                                                        }
                                                  )
                                                );
                                                setUnbookingSlotId(s.id);
                                                unbookInterviewSlotAction(s.id).then(
                                                  (res) => {
                                                    setUnbookingSlotId(null);
                                                    if (!res.success && res.error) {
                                                      setSlotsByClass(prev);
                                                      alert(res.error);
                                                    }
                                                  }
                                                );
                                              }}
                                              disabled={unbookingSlotId !== null}
                                              className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                                            >
                                              {unbookingSlotId === s.id
                                                ? "Freeing..."
                                                : "Free slot"}
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setOpenSlotMenuId(null);
                                                setBookSlotFor({
                                                  slot: s,
                                                  classId,
                                                  className,
                                                  studentIdsWithSlot,
                                                });
                                              }}
                                              className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                                            >
                                              Book for parent
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenSlotMenuId(null);
                                              if (
                                                !confirm(
                                                  "Remove this time slot? This cannot be undone."
                                                )
                                              )
                                                return;
                                              const prev = slotsByClass;
                                              setSlotsByClass((arr) =>
                                                arr.map((c) =>
                                                  c.classId !== classId
                                                    ? c
                                                    : {
                                                        ...c,
                                                        slots: c.slots.filter(
                                                          (slot) => slot.id !== s.id
                                                        ),
                                                      }
                                                )
                                              );
                                              setDeletingSlotId(s.id);
                                              deleteInterviewSlotAction(s.id).then(
                                                (res) => {
                                                  setDeletingSlotId(null);
                                                  if (!res.success && res.error) {
                                                    setSlotsByClass(prev);
                                                    alert(res.error);
                                                  }
                                                }
                                              );
                                            }}
                                            disabled={deletingSlotId !== null}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                                          >
                                            {deletingSlotId === s.id ? (
                                              <>
                                                <svg
                                                  className="h-4 w-4 shrink-0 animate-spin"
                                                  xmlns="http://www.w3.org/2000/svg"
                                                  fill="none"
                                                  viewBox="0 0 24 24"
                                                  aria-hidden="true"
                                                >
                                                  <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                  />
                                                  <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                  />
                                                </svg>
                                                Removing...
                                              </>
                                            ) : (
                                              "Remove slot"
                                            )}
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {slotsByClass.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-zinc-700">
                Add slots to a class
              </p>
              <div className="flex flex-wrap gap-2">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() =>
                      setAddSlotsClass({
                        classId: cls.id,
                        className: cls.name,
                      })
                    }
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    + {cls.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {addSlotsClass && (
            <AddInterviewSlotsModal
              classId={addSlotsClass.classId}
              className={addSlotsClass.className}
              isOpen={true}
              onClose={() => {
                setAddSlotsClass(null);
                router.refresh();
              }}
            />
          )}
          {bookSlotFor && (
            <BookSlotModal
              slot={bookSlotFor.slot}
              className={bookSlotFor.className}
              students={
                classes.find((c) => c.id === bookSlotFor.classId)?.students ??
                []
              }
              studentIdsWithSlot={bookSlotFor.studentIdsWithSlot}
              isOpen={true}
              onClose={() => setBookSlotFor(null)}
              onSuccess={(slotId, studentId, studentName, guardianName) => {
                const { classId } = bookSlotFor;
                setSlotsByClass((arr) =>
                  arr.map((c) =>
                    c.classId !== classId
                      ? c
                      : {
                          ...c,
                          slots: c.slots.map((slot) =>
                            slot.id !== slotId
                              ? slot
                              : {
                                  ...slot,
                                  isClaimed: true,
                                  studentId,
                                  studentName,
                                  guardianName,
                                }
                          ),
                        }
                  )
                );
              }}
            />
          )}
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
          const eventForForm = event;

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
            setUploadingFormEventId(eventForForm.id);
            const { success, error } =
              await uploadEventPermissionFormAction(eventForForm.id, formData);
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
                          !!uploadingFormEventId || !permissionFormFileSelected
                        }
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:pointer-events-none disabled:opacity-50"
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
                            const prev = permissionSlipStatusState;
                            setPermissionSlipStatusState((arr) =>
                              arr.map((ev) =>
                                ev.eventId !== event.id
                                  ? ev
                                  : {
                                      ...ev,
                                      students: ev.students.map((stu) =>
                                        stu.slipId !== slipId
                                          ? stu
                                          : {
                                              ...stu,
                                              cashReceived: received,
                                            }
                                      ),
                                    }
                              )
                            );
                            const { success, error } =
                              await markCashReceivedAction(slipId, received);
                            if (!success && error) {
                              setPermissionSlipStatusState(prev);
                              alert(error);
                            }
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

        {viewAllStudentsClassId && (() => {
          const cls = classesState.find((c) => c.id === viewAllStudentsClassId);
          if (!cls) return null;
          return (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/50"
                aria-hidden="true"
                onClick={() => setViewAllStudentsClassId(null)}
              />
              <div className="fixed left-4 right-4 top-4 bottom-4 z-50 mx-auto max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2">
                <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    All Students — {cls.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setViewAllStudentsClassId(null)}
                    className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                    aria-label="Close"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
                <div className="max-h-[calc(90vh-5rem)] overflow-y-auto p-6">
                  <div className="space-y-2">
                    {cls.students?.map((s) => (
                      <StudentRow
                        key={s.id}
                        student={s}
                        guardians={cls.guardians ?? []}
                        classId={cls.id}
                        onLink={(guardianId) =>
                          handleLinkGuardian(cls.id, s.id, guardianId)
                        }
                        onUnlink={(guardianId) =>
                          handleUnlinkGuardian(cls.id, s.id, guardianId)
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        <EditEventModal
          event={editingEvent}
          className={
            editingEvent ? statusByEvent.get(editingEvent.id)?.className : undefined
          }
          isOpen={!!editingEvent}
          onClose={() => setEditingEvent(null)}
        />
      </main>
    </div>
  );
}
