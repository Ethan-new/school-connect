"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enterClassCode } from "./actions";

export function ClassCodeForm() {
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const { success, error: err } = await enterClassCode(code);
      if (success) {
        router.push("/");
        router.refresh();
      } else if (err) {
        setError(err);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-xs flex-col gap-3"
    >
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="e.g. ABC12"
        disabled={isPending}
        autoComplete="off"
        autoFocus
        className="h-14 w-full rounded-full border border-solid border-black/8 bg-transparent px-5 text-center text-lg font-medium uppercase tracking-widest placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-black/20 disabled:opacity-50 dark:border-white/145 dark:placeholder:text-zinc-500 dark:focus:ring-white/20"
      />
      <button
        type="submit"
        disabled={isPending || !code.trim()}
        className="flex h-14 w-full items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc] dark:hover:text-black"
      >
        {isPending ? "Joining..." : "Continue"}
      </button>
      {error && (
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
