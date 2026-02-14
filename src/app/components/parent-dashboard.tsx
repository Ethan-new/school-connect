"use client";

import { useState, useTransition } from "react";
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

interface ParentDashboardProps {
  userName: string | null;
  classes: ParentClassSerialized[];
  upcomingEvents: CalendarEventSerialized[];
  permissionSlipTasks: PermissionSlipTask[];
  inboxItems: InboxItem[];
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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatOccurrenceDates(dates: string[]): string {
  if (dates.length <= 3) {
    return dates
      .map((d) =>
        new Date(d + "T12:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      )
      .join(", ");
  }
  const first = new Date(dates[0] + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const last = new Date(dates[dates.length - 1] + "T12:00:00").toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" }
  );
  return `${first} – ${last} (${dates.length} dates)`;
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

type Tab = "inbox" | "calendar" | "mystudent";

export function ParentDashboard({
  userName,
  classes,
  upcomingEvents,
  permissionSlipTasks,
  inboxItems,
}: ParentDashboardProps) {
  const firstName = userName?.split(/\s+/)[0] ?? "there";
  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [isPending, startTransition] = useTransition();
  const [uploadingSlipId, setUploadingSlipId] = useState<string | null>(null);
  const [unsubmittingSlipId, setUnsubmittingSlipId] = useState<string | null>(null);
  const [openMenuClassId, setOpenMenuClassId] = useState<string | null>(null);
  const [expandedInboxId, setExpandedInboxId] = useState<string | null>(null);
  const router = useRouter();

  const taskMap = new Map(permissionSlipTasks.map((t) => [t.id, t]));

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
                          {item.status === "unread" ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="h-2 w-2 rounded-full bg-red-500" />
                              Unread
                            </span>
                          ) : (
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
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-zinc-900">
                            {item.eventTitle}
                            {item.status === "unread" && (
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
                          {item.occurrenceDates &&
                          item.occurrenceDates.length > 1
                            ? formatOccurrenceDates(item.occurrenceDates)
                            : formatDueDate(item.eventStartAt)}
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
                        that require permission slips or payment, they&apos;ll appear here.
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
                        {item.occurrenceDates &&
                        item.occurrenceDates.length > 1 ? (
                          <>
                            {formatEventTimeRange(
                              item.eventStartAt,
                              item.eventEndAt
                            ).split(" · ")[1]}
                            {" · "}
                            <span className="font-medium">
                              All {item.occurrenceDates.length} dates:
                            </span>{" "}
                            {formatOccurrenceDates(item.occurrenceDates)}
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
                      {item.status === "unread" && task && !item.requiresPermissionSlip && (item.cost ?? 0) > 0 && (
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
                      {item.status === "unread" && task && item.requiresPermissionSlip && !item.hasPermissionForm && (
                        <p className="text-sm text-zinc-500">
                          Your teacher is still preparing the permission form.
                          Please check back later.
                        </p>
                      )}
                      {item.status === "unread" && task && item.requiresPermissionSlip && item.hasPermissionForm && (
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

        {/* My Student tab */}
        {activeTab === "mystudent" && (
          <section>
            <h2 className="mb-4 text-lg font-medium text-zinc-900">
              My Classes
            </h2>
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
            <Link
              href="/onboarding/class-code"
              className="mt-4 inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              + Add another class
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
