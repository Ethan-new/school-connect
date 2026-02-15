"use client";

import { useState, useTransition, useEffect } from "react";
import { createInterviewSlotsAction } from "@/app/actions";

function getDefaultInterviewDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

interface AddInterviewSlotsModalProps {
  classId: string;
  className: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AddInterviewSlotsModal({
  classId,
  className,
  isOpen,
  onClose,
}: AddInterviewSlotsModalProps) {
  const [date, setDate] = useState(getDefaultInterviewDate);
  const [times, setTimes] = useState<string[]>(["15:00"]);
  const [slotDuration, setSlotDuration] = useState(15);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkStartTime, setBulkStartTime] = useState("15:00");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (!isPending) {
      setDate(getDefaultInterviewDate());
      setTimes(["15:00"]);
      setError(null);
      onClose();
    }
  }

  useEffect(() => {
    if (isOpen) {
      setDate(getDefaultInterviewDate());
    }
  }, [isOpen]);

  function timeToMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }

  function slotsOverlap(t1: string, t2: string, duration: number): boolean {
    const s1 = timeToMinutes(t1);
    const s2 = timeToMinutes(t2);
    const e1 = s1 + duration;
    const e2 = s2 + duration;
    return s1 < e2 && s2 < e1;
  }

  function findOverlapOrDuplicate(
    newTime: string,
    existing: string[],
    duration: number
  ): string | null {
    for (const t of existing) {
      if (timeToMinutes(t) === timeToMinutes(newTime)) return "duplicate";
      if (slotsOverlap(newTime, t, duration)) return t;
    }
    return null;
  }

  function addTime() {
    const duration = Math.max(5, Math.min(60, slotDuration));
    const suggested = times.length > 0 ? times[times.length - 1] : "15:00";
    const [h, m] = suggested.split(":").map(Number);
    const nextMins = (h * 60 + m) + duration + bufferMinutes;
    const nextTime = `${String(Math.floor(nextMins / 60) % 24).padStart(2, "0")}:${String(nextMins % 60).padStart(2, "0")}`;
    const conflict = findOverlapOrDuplicate(nextTime, times, duration);
    if (conflict) {
      setError("That time would overlap with an existing slot. Try a later time.");
      return;
    }
    setError(null);
    setTimes((t) => [...t, nextTime]);
  }

  function addBulkSlots(count: number, startTime: string) {
    const [h, m] = startTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m) || count < 1) return;
    const duration = Math.max(5, Math.min(60, slotDuration));
    const intervalMinutes = duration + bufferMinutes;
    if (intervalMinutes < 5) return;
    const newTimes: string[] = [];
    let skipped = 0;
    for (let i = 0; i < count; i++) {
      const totalMins = (h * 60 + m) + i * intervalMinutes;
      const nh = Math.floor(totalMins / 60) % 24;
      const nm = totalMins % 60;
      const t = `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
      const conflict = findOverlapOrDuplicate(t, [...times, ...newTimes], duration);
      if (!conflict) {
        newTimes.push(t);
      } else {
        skipped++;
      }
    }
    setTimes((prev) => [...prev, ...newTimes]);
    setError(
      skipped > 0
        ? `Added ${newTimes.length} slots. Skipped ${skipped} that would overlap.`
        : null
    );
    if (newTimes.length === 0 && skipped > 0) {
      setError("All slots would overlap with existing ones. Choose a different start time.");
    }
  }

  function removeTime(idx: number) {
    if (times.length <= 1) return;
    setTimes((t) => t.filter((_, i) => i !== idx));
  }

  function updateTime(idx: number, value: string) {
    const duration = Math.max(5, Math.min(60, slotDuration));
    const others = times.filter((_, i) => i !== idx);
    const conflict = findOverlapOrDuplicate(value, others, duration);
    if (conflict) {
      setError("That time overlaps with another slot.");
      return;
    }
    setError(null);
    setTimes((t) => t.map((v, i) => (i === idx ? value : v)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!date.trim()) {
      setError("Please select a date");
      return;
    }

    const slots: { startAt: string; endAt: string }[] = [];
    const slotLen = Math.max(5, Math.min(60, slotDuration));
    for (const time of times) {
      const [h, m] = time.split(":").map(Number);
      if (isNaN(h) || isNaN(m)) continue;
      const startAt = new Date(date);
      startAt.setHours(h, m, 0, 0);
      const endAt = new Date(startAt);
      endAt.setMinutes(endAt.getMinutes() + slotLen);
      slots.push({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      });
    }

    if (slots.length === 0) {
      setError("Please add at least one valid time slot");
      return;
    }

    for (let i = 0; i < times.length; i++) {
      for (let j = i + 1; j < times.length; j++) {
        if (slotsOverlap(times[i], times[j], slotLen)) {
          setError(
            `Slots at ${times[i]} and ${times[j]} overlap. Please remove or change one.`
          );
          return;
        }
      }
    }

    startTransition(async () => {
      const result = await createInterviewSlotsAction(classId, slots);
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
          Add Interview Slots — {className}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Set the interview date and slot length, then add time slots.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <label
                htmlFor="slot-date"
                className="mb-1 block text-sm font-medium text-zinc-700"
              >
                Interview date
              </label>
            <input
              id="slot-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isPending}
              required
              min={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-500 disabled:opacity-50 [color-scheme:light]"
            />
            </div>
            <div className="w-32">
              <label
                htmlFor="slot-duration"
                className="mb-1 block text-sm font-medium text-zinc-700"
              >
                Slot length (min)
              </label>
              <input
                id="slot-duration"
                type="number"
                min={5}
                max={60}
                step={5}
                value={slotDuration}
                onChange={(e) =>
                  setSlotDuration(Math.min(60, Math.max(5, Number(e.target.value) || 15)))
                }
                disabled={isPending}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-50 [color-scheme:light]"
              />
            </div>
            <div className="w-32">
              <label
                htmlFor="buffer-minutes"
                className="mb-1 block text-sm font-medium text-zinc-700"
              >
                Buffer (min)
              </label>
              <input
                id="buffer-minutes"
                type="number"
                min={0}
                max={30}
                step={5}
                value={bufferMinutes}
                onChange={(e) =>
                  setBufferMinutes(Math.min(30, Math.max(0, Number(e.target.value) || 0)))
                }
                disabled={isPending}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-50 [color-scheme:light]"
              />
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
            <p className="mb-2 text-sm font-medium text-zinc-700">
              Quick add slots
            </p>
            <p className="mb-1 text-xs text-zinc-500">
              {slotDuration} min slots with {bufferMinutes} min buffer ={" "}
              {slotDuration + bufferMinutes} min between starts
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-xs text-zinc-500">Add</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={bulkCount}
                  onChange={(e) =>
                    setBulkCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))
                  }
                  disabled={isPending}
                  className="w-16 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50 [color-scheme:light]"
                />
              </label>
              <span className="py-1.5 text-sm text-zinc-500">slots starting at</span>
              <input
                type="time"
                value={bulkStartTime}
                onChange={(e) => setBulkStartTime(e.target.value)}
                disabled={isPending}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50 [color-scheme:light]"
              />
              <button
                type="button"
                onClick={() => addBulkSlots(bulkCount, bulkStartTime)}
                disabled={isPending}
                className="rounded-lg bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-300 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700">
                Time slots
              </label>
              <button
                type="button"
                onClick={addTime}
                disabled={isPending}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                + Add one
              </button>
            </div>
            <div className="space-y-2">
              {times.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => updateTime(idx, e.target.value)}
                    disabled={isPending}
                    className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50 [color-scheme:light]"
                  />
                  <button
                    type="button"
                    onClick={() => removeTime(idx)}
                    disabled={isPending || times.length <= 1}
                    className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-50"
                    aria-label="Remove"
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
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
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
              disabled={isPending}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? "Adding..." : "Add Slots"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
