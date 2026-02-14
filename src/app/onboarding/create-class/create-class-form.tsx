"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClass } from "./actions";

export function CreateClassForm() {
  const [schoolName, setSchoolName] = useState("");
  const [className, setClassName] = useState("");
  const [term, setTerm] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; className: string } | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { success, code, className: createdClassName, error: err } = await createClass(
        schoolName,
        className,
        term
      );
      if (success && code && createdClassName) {
        setCreated({ code, className: createdClassName });
      } else if (err) {
        setError(err);
      }
    });
  }

  if (created) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/50">
          <p className="text-center text-sm font-medium text-emerald-800 dark:text-emerald-200">
            Class created successfully
          </p>
          <p className="mt-2 text-center text-2xl font-mono font-bold tracking-widest text-emerald-900 dark:text-emerald-100">
            {created.code}
          </p>
          <p className="mt-2 text-center text-sm text-emerald-700 dark:text-emerald-300">
            Share this code with parents so they can join {created.className}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            router.push("/");
            router.refresh();
          }}
          className="flex h-14 w-full items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] dark:hover:text-black"
        >
          Continue to Dashboard
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div>
        <label htmlFor="schoolName" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          School name
        </label>
        <input
          id="schoolName"
          type="text"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          placeholder="e.g. Lincoln Elementary"
          disabled={isPending}
          required
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>
      <div>
        <label htmlFor="className" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Class name
        </label>
        <input
          id="className"
          type="text"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder="e.g. Grade 3 - Room 101"
          disabled={isPending}
          required
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>
      <div>
        <label htmlFor="term" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Term
        </label>
        <input
          id="term"
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="e.g. Fall 2025 or 2025-Q1"
          disabled={isPending}
          required
          className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="flex h-14 w-full items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc] dark:hover:text-black"
      >
        {isPending ? "Creating..." : "Create Class"}
      </button>
      {error && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
