"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectRole } from "./actions";

export function RoleSelectForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSelect(role: "parent" | "teacher") {
    setError(null);
    startTransition(async () => {
      const { success, redirectTo, error: err } = await selectRole(role);
      if (success && redirectTo) {
        router.push(redirectTo);
      } else if (err) {
        setError(err);
      }
    });
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={() => handleSelect("parent")}
        disabled={isPending}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "..." : "I'm a Parent"}
      </button>
      <button
        type="button"
        onClick={() => handleSelect("teacher")}
        disabled={isPending}
        className="flex h-11 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
      >
        {isPending ? "..." : "I'm a Teacher"}
      </button>
      {error && (
        <p className="text-center text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
