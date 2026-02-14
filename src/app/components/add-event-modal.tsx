"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createEventAction } from "@/app/actions";
import type { TeacherClassSerialized } from "@/lib/teacher-dashboard";

interface AddEventModalProps {
  classes: TeacherClassSerialized[];
  isOpen: boolean;
  onClose: () => void;
}

export function AddEventModal({ classes, isOpen, onClose }: AddEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("14:00");
  const [scope, setScope] = useState<string>("");
  const [requiresPermissionSlip, setRequiresPermissionSlip] = useState(false);
  const [cost, setCost] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [occurrenceDates, setOccurrenceDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [costPerOccurrence, setCostPerOccurrence] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const scopeOptions = classes.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.schoolName})`,
    schoolId: c.schoolId,
    classId: c.id as string,
  }));

  useEffect(() => {
    if (isOpen && classes.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      setStartDate(today);
      setEndDate(today);
      setScope(classes[0].id);
    }
  }, [isOpen, classes]);

  function resetForm() {
    setTitle("");
    setDescription("");
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setEndDate(today);
    setStartTime("09:00");
    setEndTime("14:00");
    setScope(scopeOptions[0]?.value ?? "");
    setRequiresPermissionSlip(false);
    setCost("");
    setIsRecurring(false);
    setOccurrenceDates([]);
    setNewDate("");
    setCostPerOccurrence("");
    setError(null);
  }

  function addOccurrenceDate() {
    if (newDate && !occurrenceDates.includes(newDate)) {
      setOccurrenceDates([...occurrenceDates, newDate].sort());
      setNewDate("");
    }
  }

  function removeOccurrenceDate(d: string) {
    setOccurrenceDates(occurrenceDates.filter((x) => x !== d));
  }

  function handleClose() {
    if (!isPending) {
      resetForm();
      onClose();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const selected = scopeOptions.find((o) => o.value === scope);
    if (!selected) {
      setError("Please select a class");
      return;
    }

    if (isRecurring && occurrenceDates.length < 2) {
      setError("Recurring events need at least 2 dates");
      return;
    }

    const firstDate = isRecurring
      ? occurrenceDates[0]
      : startDate;
    const startAt = `${firstDate}T${startTime}:00`;
    const endAt = isRecurring
      ? `${firstDate}T${endTime}:00`
      : `${endDate}T${endTime}:00`;

    startTransition(async () => {
      let costNum: number | undefined;
      let costPerOccNum: number | undefined;
      let dates: string[] | undefined;

      if (isRecurring) {
        costPerOccNum =
          costPerOccurrence.trim() && !Number.isNaN(parseFloat(costPerOccurrence))
            ? parseFloat(costPerOccurrence)
            : undefined;
        dates = occurrenceDates;
      } else {
        costNum =
          cost.trim() && !Number.isNaN(parseFloat(cost))
            ? parseFloat(cost)
            : undefined;
      }

      const { success, error: err } = await createEventAction({
        schoolId: selected.schoolId,
        classId: selected.classId,
        title,
        description: description.trim() || undefined,
        startAt,
        endAt,
        visibility: "class",
        requiresPermissionSlip,
        cost: costNum,
        costPerOccurrence: costPerOccNum,
        occurrenceDates: dates,
      });
      if (success) {
        router.refresh();
        handleClose();
      } else if (err) {
        setError(err);
      }
    });
  }

  if (!isOpen) return null;

  const defaultScope = scope || scopeOptions[0]?.value;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        aria-hidden="true"
        onClick={handleClose}
      />
      <div className="fixed left-4 right-4 top-1/2 z-50 mx-auto max-h-[90vh] w-full max-w-md -translate-y-1/2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
        <h2 className="text-lg font-semibold text-zinc-900">
          Add Event
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Field trips, picture day, and more. Parents in the class will see this.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="event-title" className="mb-1 block text-sm font-medium text-zinc-700">
              Title
            </label>
            <input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Field Trip - Science Museum"
              required
              disabled={isPending}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="event-description" className="mb-1 block text-sm font-medium text-zinc-700">
              Description
            </label>
            <textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Permission slips required. Bring lunch."
              rows={2}
              disabled={isPending}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="event-scope" className="mb-1 block text-sm font-medium text-zinc-700">
              Class
            </label>
            <select
              id="event-scope"
              value={defaultScope}
              onChange={(e) => setScope(e.target.value)}
              required
              disabled={isPending}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
            >
              {scopeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={requiresPermissionSlip}
                onChange={(e) => setRequiresPermissionSlip(e.target.checked)}
                disabled={isPending}
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
              />
              <span className="text-sm text-zinc-700">
                Requires permission slip (parents will see this as a task)
              </span>
            </label>
          <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => {
                  setIsRecurring(e.target.checked);
                  if (!e.target.checked) setOccurrenceDates([]);
                }}
                disabled={isPending}
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
              />
              <span className="text-sm text-zinc-700">
                Recurring (e.g. pizza lunch every Friday)
              </span>
            </label>
          {isRecurring && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Occurrence dates
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  disabled={isPending}
                  className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={addOccurrenceDate}
                  disabled={isPending || !newDate}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {occurrenceDates.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {occurrenceDates.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-sm text-zinc-800"
                    >
                      {new Date(d + "T12:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      <button
                        type="button"
                        onClick={() => removeOccurrenceDate(d)}
                        disabled={isPending}
                        className="text-zinc-500 hover:text-zinc-700"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-zinc-500">
                Add at least 2 dates. Same time applies to each.
              </p>
            </div>
          )}
          {requiresPermissionSlip && (
            <div>
              <label
                htmlFor={isRecurring ? "event-cost-per-occurrence" : "event-cost"}
                className="mb-1 block text-sm font-medium text-zinc-700"
              >
                {isRecurring ? "Cost per occurrence ($)" : "Cost ($)"}
              </label>
              <input
                id={isRecurring ? "event-cost-per-occurrence" : "event-cost"}
                type="number"
                min="0"
                step="0.01"
                value={isRecurring ? costPerOccurrence : cost}
                onChange={(e) =>
                  isRecurring
                    ? setCostPerOccurrence(e.target.value)
                    : setCost(e.target.value)
                }
                placeholder={isRecurring ? "e.g. 5.00" : "e.g. 10.50"}
                disabled={isPending}
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
              />
              {isRecurring && occurrenceDates.length > 0 && costPerOccurrence && !Number.isNaN(parseFloat(costPerOccurrence)) && (
                <p className="mt-0.5 text-xs text-zinc-500">
                  Total: ${(parseFloat(costPerOccurrence) * occurrenceDates.length).toFixed(2)} ({occurrenceDates.length} dates × ${parseFloat(costPerOccurrence).toFixed(2)})
                </p>
              )}
              <p className="mt-0.5 text-xs text-zinc-500">
                Parents will choose to pay online or send cash with their child.
              </p>
            </div>
          )}
          <div>
            <label htmlFor="event-start-date" className="mb-1 block text-sm font-medium text-zinc-700">
              {isRecurring ? "Start time (each date)" : "Start"}
            </label>
            <div className="flex gap-2">
              {!isRecurring && (
                <input
                  id="event-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={isPending}
                  className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                />
              )}
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                disabled={isPending}
                className={`rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 ${isRecurring ? "h-10 w-32" : "h-10 w-24"}`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="event-end-date" className="mb-1 block text-sm font-medium text-zinc-700">
              {isRecurring ? "End time (each date)" : "End"}
            </label>
            <div className="flex gap-2">
              {!isRecurring && (
                <input
                  id="event-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  disabled={isPending}
                  className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                />
              )}
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                disabled={isPending}
                className={`rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 ${isRecurring ? "h-10 w-32" : "h-10 w-24"}`}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
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
              {isPending ? "Adding..." : "Add Event"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
