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
      } else if (err) {
        setError(err);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3"
    >
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="e.g. ABC12"
        disabled={isPending}
        autoComplete="off"
        autoFocus
        className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center font-medium uppercase tracking-widest text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:opacity-50 [color-scheme:light]"
      />
      <button
        type="submit"
        disabled={isPending || !code.trim()}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "Joining..." : "Continue"}
      </button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </form>
  );
}
