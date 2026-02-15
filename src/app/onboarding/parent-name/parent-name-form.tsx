"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveParentName } from "./actions";

function parseName(name: string | null): { first: string; last: string } {
  if (!name?.trim()) return { first: "", last: "" };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function ParentNameForm({
  initialName,
  redirectTo = "/onboarding/class-code",
}: {
  initialName?: string | null;
  redirectTo?: string;
} = {}) {
  const { first: initFirst, last: initLast } = parseName(initialName ?? null);
  const [firstName, setFirstName] = useState(initFirst);
  const [lastName, setLastName] = useState(initLast);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { success, error: err } = await saveParentName(
        firstName.trim(),
        lastName.trim()
      );
      if (success) {
        router.push(redirectTo);
        router.refresh();
      } else if (err) {
        setError(err);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <div>
        <label
          htmlFor="firstName"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          First name
        </label>
        <input
          id="firstName"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="e.g. Jane"
          disabled={isPending}
          required
          autoComplete="given-name"
          className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:opacity-50 [color-scheme:light]"
        />
      </div>
      <div>
        <label
          htmlFor="lastName"
          className="mb-1 block text-sm font-medium text-zinc-700"
        >
          Last name
        </label>
        <input
          id="lastName"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="e.g. Smith"
          disabled={isPending}
          required
          autoComplete="family-name"
          className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:opacity-50 [color-scheme:light]"
        />
      </div>
      <button
        type="submit"
        disabled={
          isPending || !firstName.trim() || !lastName.trim()
        }
        className="flex h-11 w-full items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Continue"}
      </button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </form>
  );
}
