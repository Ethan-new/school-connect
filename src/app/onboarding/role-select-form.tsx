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
        router.refresh();
      } else if (err) {
        setError(err);
      }
    });
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <button
        type="button"
        onClick={() => handleSelect("parent")}
        disabled={isPending}
        className="flex h-14 w-full items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc] dark:hover:text-black"
      >
        {isPending ? "..." : "I'm a Parent"}
      </button>
      <button
        type="button"
        onClick={() => handleSelect("teacher")}
        disabled={isPending}
        className="flex h-14 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 text-base font-medium transition-colors hover:border-transparent hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
      >
        {isPending ? "..." : "I'm a Teacher"}
      </button>
      {error && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
