"use client";

import { useState, useTransition } from "react";
import { bookInterviewSlotManuallyAction } from "@/app/actions";
import type { ClassStudentSerialized } from "@/lib/teacher-dashboard";
import type { InterviewSlotSerialized } from "@/lib/interview-slots";

interface BookSlotModalProps {
  slot: InterviewSlotSerialized;
  className: string;
  students: ClassStudentSerialized[];
  /** Student IDs that already have a slot in this class */
  studentIdsWithSlot: string[];
  isOpen: boolean;
  onClose: () => void;
  /** Called after successful book with updated slot info for optimistic UI */
  onSuccess?: (
    slotId: string,
    studentId: string,
    studentName: string,
    guardianName: string
  ) => void;
}

export function BookSlotModal({
  slot,
  className,
  students,
  studentIdsWithSlot,
  isOpen,
  onClose,
  onSuccess,
}: BookSlotModalProps) {
  const [studentId, setStudentId] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const availableStudents = students.filter(
    (s) => !studentIdsWithSlot.includes(s.id)
  );

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!studentId || !parentName.trim()) {
      setError("Please select a student and enter the parent name");
      return;
    }
    startTransition(async () => {
      const res = await bookInterviewSlotManuallyAction(
        slot.id,
        studentId,
        parentName.trim(),
        parentEmail.trim() || undefined
      );
      if (res.success) {
        const student = students.find((x) => x.id === studentId);
        onSuccess?.(slot.id, studentId, student?.name ?? "Student", parentName.trim());
        onClose();
      } else if (res.error) {
        setError(res.error);
      }
    });
  }

  const start = new Date(slot.startAt);
  const timeStr = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateStr = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="fixed left-4 right-4 top-4 bottom-4 z-50 mx-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2">
        <h2 className="text-lg font-semibold text-zinc-900">
          Book slot for parent without account
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {className} · {dateStr} at {timeStr}
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label
              htmlFor="book-student"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Student
            </label>
            <select
              id="book-student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={isPending}
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-50 [color-scheme:light]"
            >
              <option value="">Select a student...</option>
              {availableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              {availableStudents.length === 0 && (
                <option value="" disabled>
                  All students already have a slot
                </option>
              )}
            </select>
          </div>
          <div>
            <label
              htmlFor="book-parent-name"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Parent name
            </label>
            <input
              id="book-parent-name"
              type="text"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="e.g. Jane Smith"
              disabled={isPending}
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-500 disabled:opacity-50 [color-scheme:light]"
            />
          </div>
          <div>
            <label
              htmlFor="book-parent-email"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Parent email{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <input
              id="book-parent-email"
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="e.g. parent@example.com"
              disabled={isPending}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-500 disabled:opacity-50 [color-scheme:light]"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || availableStudents.length === 0}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? "Booking..." : "Book slot"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
