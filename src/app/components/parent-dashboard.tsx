"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  leaveClassAction,
  uploadSignedSlipAction,
  submitPaymentMethodAction,
  unsubmitSlipAction,
} from "@/app/actions";
import type {
  ParentClassSerialized,
  CalendarEventSerialized,
} from "@/lib/parent-dashboard";
import type { PermissionSlipTask, InboxItem } from "@/lib/event-permission-slips";

import type { ReportCardSerialized } from "@/lib/report-cards";
import type { ParentInterviewClass } from "@/lib/interview-slots";
import type { ParentConversationSummary } from "@/lib/messaging";
import {
  claimInterviewSlotAction,
  unclaimInterviewSlotAction,
  markInboxItemAsReadAction,
} from "@/app/actions";
import { ParentMessageThreadModal } from "./parent-message-thread-modal";

interface ParentDashboardProps {
  userName: string | null;
  classes: ParentClassSerialized[];
  upcomingEvents: CalendarEventSerialized[];
  permissionSlipTasks: PermissionSlipTask[];
  inboxItems: InboxItem[];
  reportCards: ReportCardSerialized[];
  interviewData: ParentInterviewClass[];
  conversations: ParentConversationSummary[];
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

function formatDueDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarView({
  events,
}: {
  events: CalendarEventSerialized[];
}) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const prevMonth = () =>
    setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setViewDate(new Date(year, month + 1, 1));

  const eventsByDate = new Map<string, CalendarEventSerialized[]>();
  for (const event of events) {
    const dates: string[] =
      event.occurrenceDates && event.occurrenceDates.length > 1
        ? event.occurrenceDates
        : [event.startAt.slice(0, 10)];
    for (const dateStr of dates) {
      const d = new Date(dateStr + "T12:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate().toString();
        if (!eventsByDate.has(key)) eventsByDate.set(key, []);
        eventsByDate.get(key)!.push(event);
      }
    }
  }

  const leadingEmpty = Array(startOffset).fill(null);
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const totalCells = leadingEmpty.length + daysInMonth;
  const trailingEmpty = Array((7 - (totalCells % 7)) % 7).fill(null);
  const allCells = [...leadingEmpty, ...dayNumbers, ...trailingEmpty];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded p-2 text-zinc-600 hover:bg-zinc-100"
          aria-label="Previous month"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-900">
          {monthName}
        </h2>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded p-2 text-zinc-600 hover:bg-zinc-100"
          aria-label="Next month"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-zinc-200">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="bg-zinc-100 py-2 text-center text-xs font-medium text-zinc-600"
            >
              {day}
            </div>
          ))}
          {allCells.map((cell, i) => {
            if (cell === null) {
              return (
                <div
                  key={`empty-${i}`}
                  className="min-h-[80px] bg-zinc-50"
                />
              );
            }
            const dayEvents = eventsByDate.get(cell.toString()) ?? [];
            const isToday =
              year === today.getFullYear() &&
              month === today.getMonth() &&
              cell === today.getDate();
            return (
              <div
                key={cell}
                className={`min-h-[80px] overflow-y-auto p-1 ${
                  isToday ? "bg-amber-50/80" : "bg-white"
                }`}
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                    isToday
                      ? "bg-red-600 font-medium text-white"
                      : "text-zinc-900"
                  }`}
                >
                  {cell}
                </span>
                <div className="mt-1 space-y-1">
                  {dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 line-clamp-2"
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatSlotDateTime(startAt: string): string {
  const d = new Date(startAt);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ParentInterviewClassSection({
  item,
  onClaim,
  onUnclaim,
}: {
  item: import("@/lib/interview-slots").ParentInterviewClass;
  onClaim: (slotId: string, studentId: string) => Promise<void>;
  onUnclaim: (slotId: string) => Promise<void>;
}) {
  const [claimingSlotId, setClaimingSlotId] = useState<string | null>(null);
  const availableSlots = item.slots.filter((s) => !s.isClaimed);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="font-medium text-zinc-900">{item.className}</h3>
      <p className="mt-0.5 text-sm text-zinc-600">{item.schoolName}</p>
      <div className="mt-4 space-y-3">
        {item.children.map((child) => (
          <div
            key={child.id}
            className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-800">
                {child.name}
                {item.teacherName && (
                  <span className="ml-1 font-normal text-zinc-600">
                    (with {item.teacherName})
                  </span>
                )}
              </span>
              {child.claimedSlotId ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-600">
                    {child.claimedSlotStartAt
                      ? formatSlotDateTime(child.claimedSlotStartAt)
                      : "Slot claimed"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUnclaim(child.claimedSlotId!)}
                    className="text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <select
                  value=""
                  onChange={(e) => {
                    const slotId = e.target.value;
                    if (slotId) {
                      setClaimingSlotId(slotId);
                      onClaim(slotId, child.id).finally(() =>
                        setClaimingSlotId(null)
                      );
                    }
                  }}
                  disabled={
                    claimingSlotId !== null || availableSlots.length === 0
                  }
                  className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50 [color-scheme:light]"
                >
                  <option value="">
                    {availableSlots.length === 0
                      ? "No slots available"
                      : "Select a time..."}
                  </option>
                  {availableSlots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSlotDateTime(s.startAt)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Tab = "inbox" | "calendar" | "mystudent" | "reportcards" | "interviews" | "messages";

export function ParentDashboard({
  userName,
  classes,
  upcomingEvents,
  permissionSlipTasks,
  inboxItems,
  reportCards,
  interviewData,
  conversations,
}: ParentDashboardProps) {
  const firstName = userName?.split(/\s+/)[0] ?? "there";
  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [isPending, startTransition] = useTransition();
  const [uploadingSlipId, setUploadingSlipId] = useState<string | null>(null);
  const [unsubmittingSlipId, setUnsubmittingSlipId] = useState<string | null>(null);
  const [openMenuClassId, setOpenMenuClassId] = useState<string | null>(null);
  const [expandedInboxId, setExpandedInboxId] = useState<string | null>(null);
  const [readItemIds, setReadItemIds] = useState<Set<string>>(() => new Set());
  const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(
    () => new Set()
  );
  const [selectedMessageConversation, setSelectedMessageConversation] =
    useState<ParentConversationSummary | null>(null);
  const router = useRouter();

  const taskMap = new Map(permissionSlipTasks.map((t) => [t.id, t]));

  useEffect(() => {
    if (!expandedInboxId) return;
    const item = inboxItems.find((i) => i.id === expandedInboxId);
    const isInformational =
      item &&
      !item.requiresPermissionSlip &&
      (item.cost == null || item.cost === 0);
    setReadItemIds((prev) => new Set(prev).add(expandedInboxId));
    if (isInformational) {
      setCompletedItemIds((prev) => new Set(prev).add(expandedInboxId));
    }
    markInboxItemAsReadAction(expandedInboxId).then((res) => {
      if (res.success) router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inboxItems excluded to prevent re-render loop (router.refresh updates it, causing effect to re-run)
  }, [expandedInboxId]);

  async function handlePaymentOnly(slipId: string, paymentMethod: "online" | "cash") {
    if (uploadingSlipId) return;
    setUploadingSlipId(slipId);
    try {
      const { success, error } = await submitPaymentMethodAction(slipId, paymentMethod);
      setUploadingSlipId(null);
      if (success) {
        setExpandedInboxId(null);
        router.refresh();
      } else if (error) {
        alert(error);
      }
    } catch {
      setUploadingSlipId(null);
      alert("Something went wrong. Please try again.");
    }
  }

  function handleUploadSlip(
    e: React.FormEvent<HTMLFormElement>,
    slipId: string
  ) {
    e.preventDefault();
    if (uploadingSlipId) return;
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
    setUploadingSlipId(slipId);
    startTransition(async () => {
      try {
        const { success, error } = await uploadSignedSlipAction(slipId, formData);
        setUploadingSlipId(null);
        if (success) {
          form.reset();
          setExpandedInboxId(null);
          router.refresh();
        } else if (error) {
          alert(error);
        }
      } catch (err) {
        setUploadingSlipId(null);
        const msg =
          err instanceof Error
            ? err.message
            : String(err);
        if (
          msg.includes("1 MB") ||
          msg.includes("1MB") ||
          msg.includes("body size") ||
          msg.includes("bodySizeLimit")
        ) {
          alert(
            "File is too large. Please use a PDF under 5 MB. If you need a larger file, try compressing it first."
          );
        } else {
          alert("Something went wrong. Please try again.");
        }
      }
    });
  }

  function handleUnsubmit(slipId: string) {
    if (isPending || unsubmittingSlipId) return;
    if (
      !confirm(
        "Are you sure you want to unsubmit? You'll need to upload a new signed PDF."
      )
    )
      return;
    setUnsubmittingSlipId(slipId);
    startTransition(async () => {
      const { success, error } = await unsubmitSlipAction(slipId);
      setUnsubmittingSlipId(null);
      if (success) {
        setExpandedInboxId(null);
        router.refresh();
      } else if (error) {
        alert(error);
      }
    });
  }

  function handleLeave(classId: string) {
    if (isPending) return;
    if (
      !confirm(
        "Are you sure you want to leave this class? You can rejoin later with the class code."
      )
    )
      return;
    startTransition(async () => {
      const { success, error } = await leaveClassAction(classId);
      if (success) {
        router.refresh();
      } else if (error) {
        alert(error);
      }
    });
  }

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
              onClick={() => setActiveTab("inbox")}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === "inbox"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Inbox
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("calendar")}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === "calendar"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mystudent")}
              className={`border-b-2 pb-2 text-sm font-medium transition-colors ${
                activeTab === "mystudent"
                  ? "border-red-600 text-red-600"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              My Student
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
        {/* Inbox tab */}
        {activeTab === "inbox" && (
          <section>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">
                      Status:
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">
                      Subject:
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-600">
                      Due By:
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inboxItems.length > 0 ? (
                    inboxItems.map((item, i) => (
                      <tr
                        key={item.id}
                        onClick={() => setExpandedInboxId(item.id)}
                        className={`cursor-pointer transition-colors ${
                          i % 2 === 0
                            ? "bg-white hover:bg-zinc-50"
                            : "bg-zinc-50/50 hover:bg-zinc-100/50"
                        }`}
                      >
                        <td className="px-4 py-3">
                          {(() => {
                            const displayStatus =
                              item.status === "completed" ||
                              completedItemIds.has(item.id)
                                ? "completed"
                                : readItemIds.has(item.id) || item.status === "read"
                                  ? "read"
                                  : item.status;
                            return displayStatus === "completed" ? (
                              <span className="flex items-center gap-2 text-sm text-emerald-600">
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
                                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                  <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                Completed
                              </span>
                            ) : displayStatus === "unread" ? (
                              <span className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                Unread
                              </span>
                            ) : (
                              <span className="flex items-center gap-2 text-sm text-amber-600">
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                                Read
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-zinc-900">
                            {item.eventTitle}
                            {item.status !== "completed" &&
                              (item.requiresPermissionSlip ||
                                (item.cost ?? 0) > 0) && (
                              <span className="text-red-600">
                                {" "}
                                - {item.requiresPermissionSlip
                                  ? "Signature Required*"
                                  : "Payment Required*"}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600">
                          {formatDueDate(
                            item.permissionSlipDueDate ?? item.eventStartAt
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-12 text-center text-zinc-600"
                      >
                        No items in your inbox. When your teacher adds events
                        for your child&apos;s class, they&apos;ll appear here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Event detail modal */}
            {expandedInboxId && (() => {
              const item = inboxItems.find((i) => i.id === expandedInboxId);
              const task = item ? taskMap.get(item.id) : undefined;
              if (!item) return null;
              return (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                  onClick={() => setExpandedInboxId(null)}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="event-detail-title"
                >
                  <div
                    className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
                      <h2
                        id="event-detail-title"
                        className="text-lg font-semibold text-zinc-900"
                      >
                        {item.eventTitle}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setExpandedInboxId(null)}
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
                      {(item.studentName || item.className) && (
                        <p className="text-sm text-zinc-600">
                          {item.studentName && item.className
                            ? `For ${item.studentName} · ${item.className}`
                            : item.studentName ?? item.className}
                        </p>
                      )}
                      <p className="text-sm text-zinc-600">
                        {item.permissionSlipDueDate ? (
                          <>
                            <span className="font-medium">Due by </span>
                            {formatDueDate(item.permissionSlipDueDate)}
                          </>
                        ) : (
                          formatEventTimeRange(
                            item.eventStartAt,
                            item.eventEndAt
                          )
                        )}
                      </p>
                      {item.eventDescription && (
                        <p className="text-sm text-zinc-500">
                          {item.eventDescription}
                        </p>
                      )}
                      {(item.cost != null && item.cost > 0) && (
                        <p className="text-sm font-medium text-zinc-700">
                          Cost: ${item.cost.toFixed(2)}
                        </p>
                      )}
                      {item.permissionSlipDueDate && (item.requiresPermissionSlip || (item.cost ?? 0) > 0) && (
                        <p className="text-sm font-medium text-amber-700">
                          Due by {formatDueDate(item.permissionSlipDueDate)} (sign and submit payment)
                        </p>
                      )}
                      {item.status !== "completed" && task && !item.requiresPermissionSlip && (item.cost ?? 0) > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                          <p className="mb-3 text-sm font-medium text-zinc-700">
                            How will you pay the ${item.cost!.toFixed(2)}?
                          </p>
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => handlePaymentOnly(task.id, "online")}
                              disabled={!!uploadingSlipId}
                              className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                            >
                              <span className="h-4 w-4 rounded-full border-2 border-amber-500" />
                              Pay online
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePaymentOnly(task.id, "cash")}
                              disabled={!!uploadingSlipId}
                              className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
                            >
                              <span className="h-4 w-4 rounded-full border-2 border-amber-500" />
                              Sending cash with my child
                            </button>
                          </div>
                          {uploadingSlipId === task.id && (
                            <p className="mt-2 text-xs text-zinc-500">Saving...</p>
                          )}
                        </div>
                      )}
                      {item.status !== "completed" && task && item.requiresPermissionSlip && !item.hasPermissionForm && (
                        <p className="text-sm text-zinc-500">
                          Your teacher is still preparing the permission form.
                          Please check back later.
                        </p>
                      )}
                      {item.status !== "completed" && task && item.requiresPermissionSlip && item.hasPermissionForm && (
                        <>
                          <div className="overflow-hidden rounded-lg border border-zinc-200">
                            <iframe
                              src={`/api/permission-slip/${task.id}/download?preview=1`}
                              title="Permission slip preview"
                              className="h-[400px] w-full min-h-[280px] bg-white"
                            />
                          </div>
                          <p className="text-xs text-zinc-500">
                            Review the form above, sign it, then upload the signed
                            copy below.
                          </p>
                          <form
                            onSubmit={(e) => handleUploadSlip(e, task.id)}
                            className="flex flex-col gap-4"
                          >
                            {(task.cost != null && task.cost > 0) && (
                              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                                <p className="mb-2 text-sm font-medium text-zinc-700">
                                  How will you pay the ${task.cost.toFixed(2)}?
                                </p>
                                <div className="flex flex-col gap-2">
                                  <label className="flex cursor-pointer items-center gap-2">
                                    <input
                                      type="radio"
                                      name="paymentMethod"
                                      value="online"
                                      required={task.cost > 0}
                                      disabled={!!uploadingSlipId}
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
                                      required={task.cost > 0}
                                      disabled={!!uploadingSlipId}
                                      className="h-4 w-4 border-zinc-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-sm font-medium text-zinc-900">
                                      Sending cash with my child
                                    </span>
                                  </label>
                                </div>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-3">
                              <a
                                href={`/api/permission-slip/${task.id}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
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
                              <input
                                type="file"
                                name="pdf"
                                accept=".pdf,application/pdf"
                                required
                                disabled={!!uploadingSlipId}
                                className="block text-sm text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-amber-800 hover:file:bg-amber-200"
                              />
                              <button
                                type="submit"
                                disabled={!!uploadingSlipId}
                                className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                              >
                                {uploadingSlipId === task.id
                                  ? "Uploading..."
                                  : "Upload signed PDF"}
                              </button>
                            </div>
                          </form>
                        </>
                      )}
                      {item.status === "completed" && (
                        <>
                          {item.paymentMethod && (
                            <p className="text-sm text-zinc-600">
                              Payment:{" "}
                              {item.paymentMethod === "online"
                                ? "Pay online"
                                : "Sending cash with child"}
                            </p>
                          )}
                          {item.requiresPermissionSlip && item.hasPermissionForm && (
                            <>
                              <div className="overflow-hidden rounded-lg border border-zinc-200">
                                <iframe
                                  src={`/api/permission-slip/${item.id}/download?preview=1`}
                                  title="Signed permission slip"
                                  className="h-[400px] w-full min-h-[280px] bg-white"
                                />
                              </div>
                              <p className="flex items-center gap-2 text-sm text-emerald-600">
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
                                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                  <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                You&apos;ve signed this permission slip.
                              </p>
                              <div className="flex flex-wrap gap-3">
                                <a
                                  href={`/api/permission-slip/${item.id}/download`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
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
                                  Download signed PDF
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleUnsubmit(item.id)}
                                  disabled={!!unsubmittingSlipId}
                                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                                >
                                  {unsubmittingSlipId === item.id
                                    ? "Unsubmitting..."
                                    : "Unsubmit"}
                                </button>
                              </div>
                            </>
                          )}
                          {item.requiresPermissionSlip && !item.hasPermissionForm && (
                            <p className="flex items-center gap-2 text-sm text-emerald-600">
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
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                              Completed.
                            </p>
                          )}
                          {!item.requiresPermissionSlip && (item.cost ?? 0) > 0 && (
                            <>
                              <p className="flex items-center gap-2 text-sm text-emerald-600">
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
                                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                  <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                                You&apos;ve confirmed your payment method.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleUnsubmit(item.id)}
                                disabled={!!unsubmittingSlipId}
                                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                              >
                                {unsubmittingSlipId === item.id
                                  ? "Unsubmitting..."
                                  : "Change payment method"}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* Calendar tab */}
        {activeTab === "calendar" && (
          <section>
            <CalendarView events={upcomingEvents} />
          </section>
        )}

        {/* Report cards tab */}
        {activeTab === "reportcards" && (
          <section>
            <h2 className="mb-4 text-lg font-medium text-zinc-900">
              Report Cards
            </h2>
            {reportCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center">
                <p className="text-zinc-600">
                  No published report cards yet. Report cards will appear here
                  once your teacher publishes them.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reportCards.map((rc) => (
                  <div
                    key={rc.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-900">
                          {rc.studentName} — {rc.term}
                        </p>
                        {rc.publishedAt && (
                          <p className="mt-0.5 text-xs text-zinc-500">
                            Published{" "}
                            {new Date(rc.publishedAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </p>
                        )}
                      </div>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Published
                      </span>
                    </div>
                    <div className="mt-3 border-t border-zinc-100 pt-3">
                      <div className="overflow-hidden rounded-lg border border-zinc-200">
                        <iframe
                          src={`/api/report-card/${rc.id}/download?preview=1`}
                          title={`Report card ${rc.term}`}
                          className="h-[400px] w-full min-h-[280px] bg-white"
                        />
                      </div>
                      <a
                        href={`/api/report-card/${rc.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
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
                    </div>
                  </div>
                ))}
              </div>
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
              Claim one time slot per child. Select your child and choose an
              available slot.
            </p>
            {interviewData.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center">
                <p className="text-zinc-600">
                  No interview slots available yet. Check back when your teacher
                  adds them.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {interviewData.map((item) => (
                  <ParentInterviewClassSection
                    key={item.classId}
                    item={item}
                    onClaim={async (slotId, studentId) => {
                      const res = await claimInterviewSlotAction(
                        slotId,
                        studentId
                      );
                      if (res.success) router.refresh();
                      else if (res.error) alert(res.error);
                    }}
                    onUnclaim={async (slotId) => {
                      const res = await unclaimInterviewSlotAction(slotId);
                      if (res.success) router.refresh();
                      else if (res.error) alert(res.error);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Messages tab */}
        {activeTab === "messages" && (
          <section>
            <h2 className="mb-4 text-lg font-medium text-zinc-900">
              Messages
            </h2>
            {conversations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center">
                <p className="text-zinc-600">
                  No messages yet. When your teacher sends you a message about
                  your child, it will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <ul className="divide-y divide-zinc-200">
                  {conversations.map((conv) => (
                    <li key={conv.conversationId}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMessageConversation(conv)
                        }
                        className="grid w-full grid-cols-[1fr_auto_2rem] items-center gap-4 px-4 py-3 text-left hover:bg-zinc-50"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-zinc-900">
                            {conv.teacherName} — {conv.studentName}
                          </span>
                          {conv.lastMessagePreview ? (
                            <p className="mt-0.5 truncate text-sm text-zinc-500">
                              {conv.lastMessagePreview}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-sm text-zinc-400">
                              Start conversation
                            </p>
                          )}
                        </div>
                        {conv.messageCount ? (
                          <span className="text-xs text-zinc-500">
                            {conv.messageCount} message
                            {conv.messageCount !== 1 ? "s" : ""}
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
                  ))}
                </ul>
              </div>
            )}
            {selectedMessageConversation && (
              <ParentMessageThreadModal
                conversationId={selectedMessageConversation.conversationId}
                teacherName={selectedMessageConversation.teacherName}
                studentName={selectedMessageConversation.studentName}
                isOpen={true}
                onClose={() => {
                  setSelectedMessageConversation(null);
                  router.refresh();
                }}
              />
            )}
          </section>
        )}

        {/* My Student tab */}
        {activeTab === "mystudent" && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-zinc-900">
                My Classes
              </h2>
              <Link
                href="/onboarding/class-code"
                className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                Add class
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {classes.map((cls) => (
                <div
                  key={cls.id || cls.code}
                  className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-zinc-900">
                        {cls.name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        {cls.schoolName}
                      </p>
                      {cls.children && cls.children.length > 0 && (
                        <p className="mt-1 text-sm text-zinc-600">
                          {cls.children.length === 1 ? "My child" : "My children"}: {cls.children.map((c) => c.name).join(", ")}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-zinc-500">
                        {cls.term}
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuClassId(
                            openMenuClassId === cls.id ? null : cls.id
                          )
                        }
                        disabled={isPending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                        aria-label="Class options"
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
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="12" cy="5" r="1" />
                          <circle cx="12" cy="19" r="1" />
                        </svg>
                      </button>
                      {openMenuClassId === cls.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            aria-hidden="true"
                            onClick={() => setOpenMenuClassId(null)}
                          />
                          <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuClassId(null);
                                handleLeave(cls.id);
                              }}
                              disabled={isPending}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Leave class
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
