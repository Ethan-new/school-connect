"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateEventAction, uploadEventPermissionFormAction } from "@/app/actions";
import type { CalendarEventSerialized } from "@/lib/teacher-dashboard";

interface EditEventModalProps {
  event: CalendarEventSerialized | null;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

function parseDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
}

export function EditEventModal({
  event,
  className,
  isOpen,
  onClose,
}: EditEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("14:00");
  const [requiresPermissionSlip, setRequiresPermissionSlip] = useState(false);
  const [cost, setCost] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [occurrenceDates, setOccurrenceDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [costPerOccurrence, setCostPerOccurrence] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isUploadingForm, setIsUploadingForm] = useState(false);
  const [hasPermissionForm, setHasPermissionForm] = useState(false);
  const [hasFileSelected, setHasFileSelected] = useState(false);
  const [hasSeparateDueDate, setHasSeparateDueDate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [permissionSlipDueDate, setPermissionSlipDueDate] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (isOpen && event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      const start = parseDateTime(event.startAt);
      const end = parseDateTime(event.endAt);
      setStartDate(start.date);
      setStartTime(start.time);
      setEndDate(end.date);
      setEndTime(end.time);
      setRequiresPermissionSlip(event.requiresPermissionSlip ?? false);
      const recurring = !!(event.occurrenceDates && event.occurrenceDates.length > 1);
      setIsRecurring(recurring);
      setOccurrenceDates(event.occurrenceDates ?? []);
      setCost(
        !recurring && event.cost != null && event.cost > 0
          ? String(event.cost)
          : ""
      );
      setCostPerOccurrence(
        recurring && event.costPerOccurrence != null && event.costPerOccurrence > 0
          ? String(event.costPerOccurrence)
          : ""
      );
      setHasPermissionForm(event.hasPermissionForm ?? false);
      setHasFileSelected(false);
      setHasSeparateDueDate(Boolean(event.permissionSlipDueDate));
      setPermissionSlipDueDate(event.permissionSlipDueDate ?? start.date);
      setError(null);
    }
  }, [isOpen, event]);

  function addOccurrenceDate() {
    if (newDate && !occurrenceDates.includes(newDate)) {
      setOccurrenceDates([...occurrenceDates, newDate].sort());
      setNewDate("");
    }
  }

  function removeOccurrenceDate(d: string) {
    setOccurrenceDates(occurrenceDates.filter((x) => x !== d));
  }

  /** Add minutes to HH:mm time string */
  function addMinutesToTime(time: string, minutes: number): string {
    const [h, m] = time.split(":").map(Number);
    const totalMins = h * 60 + m + minutes;
    const newH = Math.floor(totalMins / 60) % 24;
    const newM = totalMins % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  }

  /** True if timeA is strictly before timeB (HH:mm) */
  function isTimeBefore(timeA: string, timeB: string): boolean {
    const [ha, ma] = timeA.split(":").map(Number);
    const [hb, mb] = timeB.split(":").map(Number);
    return ha < hb || (ha === hb && ma < mb);
  }

  function handleStartTimeChange(newStartTime: string) {
    setStartTime(newStartTime);
    if (!isTimeBefore(newStartTime, endTime)) {
      setEndTime(addMinutesToTime(newStartTime, 60));
    }
  }

  async function handleUploadForm(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!event || !hasFileSelected || !fileInputRef.current?.files?.[0]) return;
    const file = fileInputRef.current.files[0];
    if (file.size === 0) {
      setError("Please select a PDF file");
      return;
    }
    setIsUploadingForm(true);
    setError(null);
    const formData = new FormData();
    formData.append("pdf", file);
    const { success, error: err } = await uploadEventPermissionFormAction(event.id, formData);
    setIsUploadingForm(false);
    if (success) {
      fileInputRef.current.value = "";
      setHasFileSelected(false);
      setHasPermissionForm(true);
      router.refresh();
    } else if (err) {
      setError(err);
    }
  }

  function handleClose() {
    if (!isPending && !isUploadingForm) {
      onClose();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    setError(null);

    if (isRecurring && occurrenceDates.length < 2) {
      setError("Recurring events need at least 2 dates");
      return;
    }

    const startBeforeEnd =
      isRecurring
        ? isTimeBefore(startTime, endTime)
        : startDate < endDate || (startDate === endDate && isTimeBefore(startTime, endTime));
    if (!startBeforeEnd) {
      setError("End time must be after start time");
      return;
    }

    const firstDate = isRecurring ? occurrenceDates[0] : startDate;
    const startAt = `${firstDate}T${startTime}:00`;
    const endAt = isRecurring
      ? `${firstDate}T${endTime}:00`
      : `${endDate}T${endTime}:00`;

    let costNum: number | null | undefined;
    let costPerOccNum: number | null | undefined;
    let dates: string[] | null | undefined;

    if (isRecurring) {
      costPerOccNum =
        costPerOccurrence.trim() && !Number.isNaN(parseFloat(costPerOccurrence))
          ? parseFloat(costPerOccurrence)
          : requiresPermissionSlip
            ? null
            : undefined;
      dates = occurrenceDates;
      costNum = undefined;
    } else {
      costNum =
        cost.trim() && !Number.isNaN(parseFloat(cost))
          ? parseFloat(cost)
          : requiresPermissionSlip
            ? null
            : undefined;
      costPerOccNum = undefined;
      dates = null;
    }

    const updatePayload: Parameters<typeof updateEventAction>[1] = {
      title,
      description: description.trim() || undefined,
      startAt,
      endAt,
      requiresPermissionSlip,
      permissionSlipDueDate: (requiresPermissionSlip || costNum != null || costPerOccNum != null) && hasSeparateDueDate ? (permissionSlipDueDate || null) : null,
    };
    if (isRecurring) {
      updatePayload.costPerOccurrence = costPerOccNum ?? null;
      updatePayload.occurrenceDates = dates ?? null;
      updatePayload.cost = null;
    } else {
      updatePayload.cost = costNum ?? null;
      updatePayload.costPerOccurrence = null;
      updatePayload.occurrenceDates = null;
    }

    startTransition(async () => {
      const { success, error: err } = await updateEventAction(
        event.id,
        updatePayload
      );
      if (success) {
        router.refresh();
        handleClose();
      } else if (err) {
        setError(err);
      }
    });
  }

  if (!isOpen || !event) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/50"
        aria-hidden="true"
        onClick={handleClose}
      />
      <div className="fixed left-4 right-4 top-1/2 z-[70] mx-auto max-h-[90vh] w-full max-w-md -translate-y-1/2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
        <h2 className="text-lg font-semibold text-zinc-900">Edit Event</h2>
        {className && (
          <p className="mt-1 text-sm text-zinc-500">{className}</p>
        )}
        {isRecurring && occurrenceDates.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">
              All {occurrenceDates.length} occurrence date
              {occurrenceDates.length !== 1 ? "s" : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {occurrenceDates.map((d) => (
                <span
                  key={d}
                  className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                >
                  {new Date(d + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label
              htmlFor="edit-event-title"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Title
            </label>
            <input
              id="edit-event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isPending}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="edit-event-description"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Description
            </label>
            <textarea
              id="edit-event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={isPending}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="edit-event-requires-permission-slip"
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                id="edit-event-requires-permission-slip"
                type="checkbox"
                name="requiresPermissionSlip"
                checked={requiresPermissionSlip}
                onChange={(e) => setRequiresPermissionSlip(e.target.checked)}
                disabled={isPending}
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
              />
              <span className="text-sm text-zinc-700">
                Requires permission slip
              </span>
            </label>
            {requiresPermissionSlip && (
              <>
                <p className="text-xs text-zinc-500">
                  Parents will need to sign a permission form for this event.
                </p>
                <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-800">
                    Permission form PDF
                  </h3>
                  {hasPermissionForm ? (
                    <p className="mt-1 text-sm text-emerald-600">
                      Form uploaded ✓
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-amber-600">
                      No form uploaded — upload a PDF for parents to sign
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      disabled={isUploadingForm || isPending}
                      onChange={(e) => setHasFileSelected(Boolean(e.target.files?.[0]))}
                      className="block text-sm text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-amber-800"
                    />
                    <button
                      type="button"
                      onClick={handleUploadForm}
                      disabled={isUploadingForm || isPending || !hasFileSelected}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:pointer-events-none disabled:opacity-50"
                    >
                      {isUploadingForm ? "Uploading..." : hasPermissionForm ? "Replace form" : "Upload form"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    Parents will download this PDF to sign and return.
                  </p>
                </div>
              </>
            )}
            {(requiresPermissionSlip || (isRecurring ? (costPerOccurrence && parseFloat(costPerOccurrence) > 0) : (cost && parseFloat(cost) > 0))) && (
              <div className="mt-3 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasSeparateDueDate}
                    onChange={(e) => {
                      setHasSeparateDueDate(e.target.checked);
                      if (e.target.checked && !permissionSlipDueDate) {
                        setPermissionSlipDueDate(isRecurring && occurrenceDates.length > 0 ? occurrenceDates[0] : startDate);
                      }
                    }}
                    disabled={isPending}
                    className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
                  />
                  <span className="text-sm font-medium text-zinc-700">
                    Separate due date for parents to sign and submit payment
                  </span>
                </label>
                {hasSeparateDueDate && (
                  <div>
                    <label htmlFor="edit-event-due-date" className="mb-1 block text-sm font-medium text-zinc-700">
                      Due date
                    </label>
                    <input
                      id="edit-event-due-date"
                      type="date"
                      value={permissionSlipDueDate}
                      onChange={(e) => setPermissionSlipDueDate(e.target.value)}
                      disabled={isPending}
                      className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
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
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50"
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
                        className="text-zinc-500"
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
          <div>
            <label
              htmlFor="edit-event-cost"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              {isRecurring ? "Cost per occurrence ($)" : "Cost ($)"}
            </label>
            <input
              id="edit-event-cost"
              type="number"
              min="0"
              step="0.01"
              value={isRecurring ? costPerOccurrence : cost}
              onChange={(e) =>
                isRecurring
                  ? setCostPerOccurrence(e.target.value)
                  : setCost(e.target.value)
              }
              placeholder={isRecurring ? "e.g. 5.00 or 0 for free" : "e.g. 10.50 or 0 for free"}
              disabled={isPending}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
            />
            {isRecurring && occurrenceDates.length > 0 && costPerOccurrence && !Number.isNaN(parseFloat(costPerOccurrence)) && parseFloat(costPerOccurrence) > 0 && (
              <p className="mt-0.5 text-xs text-zinc-500">
                Total: ${(parseFloat(costPerOccurrence) * occurrenceDates.length).toFixed(2)} ({occurrenceDates.length} dates × ${parseFloat(costPerOccurrence).toFixed(2)})
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              {isRecurring ? "Start time (each date)" : "Start"}
            </label>
            <div className="flex gap-2">
              {!isRecurring && (
                <input
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
                onChange={(e) => handleStartTimeChange(e.target.value)}
                required
                disabled={isPending}
                className={`rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 ${isRecurring ? "h-10 w-32" : "h-10 w-24"}`}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              {isRecurring ? "End time (each date)" : "End"}
            </label>
            <div className="flex gap-2">
              {!isRecurring && (
                <input
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
