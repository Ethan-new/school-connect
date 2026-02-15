"use client";

import { useState, useTransition } from "react";
import { createReportCardAction } from "@/app/actions";

interface AddReportCardModalProps {
  studentId: string;
  studentName: string;
  classTerm: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AddReportCardModal({
  studentId,
  studentName,
  classTerm,
  isOpen,
  onClose,
}: AddReportCardModalProps) {
  const [term, setTerm] = useState(classTerm);
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (!isPending) {
      setTerm(classTerm);
      setFile(null);
      setError(null);
      onClose();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file || file.size === 0) {
      setError("Please select a PDF file");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("File must be a PDF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5MB");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("studentId", studentId);
      formData.set("term", term.trim());
      formData.set("pdf", file);

      const result = await createReportCardAction(formData);
      if (result.success) {
        handleClose();
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
      <div className="fixed left-4 right-4 top-4 bottom-4 z-50 mx-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl sm:left-1/2 sm:right-auto sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:bottom-auto">
        <h2 className="text-lg font-semibold text-zinc-900">
          Add Report Card — {studentName}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label
              htmlFor="report-term"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Term
            </label>
            <input
              id="report-term"
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g. Term 1 2024–25"
              disabled={isPending}
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="report-pdf"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Report card PDF
            </label>
            <input
              id="report-pdf"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={isPending}
              required
              className="block w-full text-sm text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-red-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-red-800 hover:file:bg-red-200"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Maximum 5MB. PDF format only.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !file}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? "Uploading..." : "Save as Draft"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
