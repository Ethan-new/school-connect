"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addStudentsAction } from "@/app/actions";
import type { TeacherClassSerialized } from "@/lib/teacher-dashboard";

interface AddStudentsModalProps {
  classInfo: TeacherClassSerialized;
  isOpen: boolean;
  onClose: () => void;
}

export function AddStudentsModal({
  classInfo,
  isOpen,
  onClose,
}: AddStudentsModalProps) {
  const [namesInput, setNamesInput] = useState("");
  const [grade, setGrade] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClose() {
    if (!isPending) {
      setNamesInput("");
      setGrade("");
      setError(null);
      onClose();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const names = namesInput
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length === 0) {
      setError("Please enter at least one student name");
      return;
    }

    startTransition(async () => {
      const result = await addStudentsAction(classInfo.id, names, grade || undefined);
      if (result.success) {
        handleClose();
        router.refresh();
      } else if (result.error) {
        setError(result.error);
      }
    });
  }

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        aria-hidden="true"
        onClick={handleClose}
      />
      <div className="fixed left-4 right-4 top-1/2 z-50 mx-auto max-h-[90vh] w-full max-w-md -translate-y-1/2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Add Students
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {classInfo.name} — enter one name per line or comma-separated.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label
              htmlFor="student-names"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Student names
            </label>
            <textarea
              id="student-names"
              value={namesInput}
              onChange={(e) => setNamesInput(e.target.value)}
              placeholder="e.g.&#10;Alice Smith&#10;Bob Jones&#10;Charlie Brown"
              rows={5}
              disabled={isPending}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label
              htmlFor="student-grade"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Grade (optional)
            </label>
            <input
              id="student-grade"
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g. 3rd, K, 10"
              disabled={isPending}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isPending ? "Adding..." : "Add Students"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
