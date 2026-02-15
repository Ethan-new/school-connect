"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createEventAction, uploadEventPermissionFormAction } from "@/app/actions";
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
  const [hasStartEndTime, setHasStartEndTime] = useState(false);
  const [hasMultipleDates, setHasMultipleDates] = useState(false);
  const [occurrenceDates, setOccurrenceDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [costPerOccurrence, setCostPerOccurrence] = useState<string>("");
  const [hasSeparateDueDate, setHasSeparateDueDate] = useState(false);
  const [permissionSlipDueDate, setPermissionSlipDueDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const permissionFormInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const scopeOptions = useMemo(
    () =>
      classes.map((c) => ({
        value: c.id,
        label: `${c.name} (${c.schoolName})`,
        schoolId: c.schoolId,
        classId: c.id as string,
      })),
    [classes]
  );

  useEffect(() => {
    if (isOpen && classes.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      /* eslint-disable react-hooks/set-state-in-effect -- Reset form defaults when modal opens */
      setStartDate(today);
      setEndDate(today);
      setPermissionSlipDueDate(today);
      setHasSeparateDueDate(false);
      setScope(classes[0].id);
      /* eslint-enable react-hooks/set-state-in-effect */
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
    setHasStartEndTime(false);
    setCost("");
    setHasMultipleDates(false);
    setOccurrenceDates([]);
    setHasSeparateDueDate(false);
    setPermissionSlipDueDate("");
    setNewDate("");
    setCostPerOccurrence("");
    setError(null);
    if (permissionFormInputRef.current) {
      permissionFormInputRef.current.value = "";
    }
  }

  function addOccurrenceDate() {
    if (newDate && !occurrenceDates.includes(newDate)) {
      const updated = [...occurrenceDates, newDate].sort();
      setOccurrenceDates(updated);
      setNewDate("");
      if (updated.length === 1 && (!permissionSlipDueDate || permissionSlipDueDate === startDate)) {
        setPermissionSlipDueDate(updated[0]);
      }
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

    if (hasMultipleDates && occurrenceDates.length < 2) {
      setError("Multiple dates events need at least 2 dates");
      return;
    }


    if (hasStartEndTime) {
      const startBeforeEnd =
        isRecurring
          ? isTimeBefore(startTime, endTime)
          : startDate < endDate || (startDate === endDate && isTimeBefore(startTime, endTime));
      if (!startBeforeEnd) {
        setError("End time must be after start time");
        return;
      }
    }

    const firstDate = isRecurring
      ? occurrenceDates[0]
      : startDate;
    const lastDate = isRecurring
      ? occurrenceDates[occurrenceDates.length - 1]
      : endDate;
    const startAt = hasStartEndTime
      ? `${firstDate}T${startTime}:00`
      : `${firstDate}T00:00:00`;
    const endAt = hasStartEndTime
      ? (isRecurring ? `${firstDate}T${endTime}:00` : `${endDate}T${endTime}:00`)
      : (isRecurring ? `${firstDate}T23:59:59` : `${lastDate}T23:59:59`);

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

      const needsDueDate = requiresPermissionSlip || costNum != null || costPerOccNum != null;
      const dueDateForSlip = needsDueDate && hasSeparateDueDate && permissionSlipDueDate
        ? permissionSlipDueDate
        : undefined;

      const { success, eventId, error: err } = await createEventAction({
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
        permissionSlipDueDate: dueDateForSlip,
      });
      if (success && eventId) {
        const pdfFile = permissionFormInputRef.current?.files?.[0];
        if (requiresPermissionSlip && pdfFile && pdfFile.size > 0 && pdfFile.type === "application/pdf") {
          const formData = new FormData();
          formData.append("pdf", pdfFile);
          const uploadResult = await uploadEventPermissionFormAction(eventId, formData);
          if (!uploadResult.success && uploadResult.error) {
            setError(`Event created but form upload failed: ${uploadResult.error}`);
            return;
          }
        }
        router.refresh();
        handleClose();
      } else if (success) {
        router.refresh();
        handleClose();
      } else if (err) {
        setError(err);
      }
    });
  }

  if (!isOpen) return null;

  const defaultScope = scope || scopeOptions[0]?.value;
  const isRecurring = hasMultipleDates && occurrenceDates.length > 1;

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
          <div className="space-y-1">
            <label
              htmlFor="event-requires-permission-slip"
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                id="event-requires-permission-slip"
                type="checkbox"
                name="requiresPermissionSlip"
                checked={requiresPermissionSlip}
                onChange={(e) => setRequiresPermissionSlip(e.target.checked)}
                disabled={isPending}
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
              />
              <span className="text-sm text-zinc-700">
                Requires permission slip (parents will see this as a task)
              </span>
            </label>
            {requiresPermissionSlip && (
              <>
                <p className="text-xs text-zinc-500">
                  Parents will need to sign a permission form for this event.
                </p>
                <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-800">
                    Permission form PDF (optional)
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Upload now or add later when editing the event.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      ref={permissionFormInputRef}
                      type="file"
                      name="permissionFormPdf"
                      accept=".pdf,application/pdf"
                      disabled={isPending}
                      className="block text-sm text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-amber-800 hover:file:bg-amber-200 disabled:opacity-50"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={hasStartEndTime}
                onChange={(e) => setHasStartEndTime(e.target.checked)}
                disabled={isPending}
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
              />
              <span className="text-sm text-zinc-700">
                Specify start and end times
              </span>
            </label>
          {/* Date: single by default, or occurrence dates when multiple */}
          {!hasMultipleDates && (
            <div>
              <label htmlFor="event-date" className="mb-1 block text-sm font-medium text-zinc-700">
                {hasStartEndTime ? "Start" : "Date"}
              </label>
              <div className="flex gap-2">
                <input
                  id="event-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const d = e.target.value;
                    setStartDate(d);
                    setEndDate(d);
                    if (!permissionSlipDueDate || permissionSlipDueDate === startDate) {
                      setPermissionSlipDueDate(d);
                    }
                  }}
                  required
                  disabled={isPending}
                  className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                />
                {hasStartEndTime && (
                  <>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      required
                      disabled={isPending}
                      className="h-10 w-24 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                    />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      disabled={isPending}
                      className="h-10 w-24 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                    />
                  </>
                )}
              </div>
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={hasMultipleDates}
                onChange={(e) => {
                  setHasMultipleDates(e.target.checked);
                  if (!e.target.checked) setOccurrenceDates([]);
                }}
                disabled={isPending}
                className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
              />
              <span className="text-sm text-zinc-700">
                Multiple dates (e.g. pizza lunch every Friday)
              </span>
            </label>
          {hasMultipleDates && (
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
              {hasStartEndTime && (
                <div className="mt-3 flex gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">Start time</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      required
                      disabled={isPending}
                      className="h-10 w-32 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">End time</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      disabled={isPending}
                      className="h-10 w-32 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
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
              placeholder={isRecurring ? "e.g. 5.00 or 0 for free" : "e.g. 10.50 or 0 for free"}
              disabled={isPending}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
            />
            {isRecurring && occurrenceDates.length > 0 && costPerOccurrence && !Number.isNaN(parseFloat(costPerOccurrence)) && parseFloat(costPerOccurrence) > 0 && (
              <p className="mt-0.5 text-xs text-zinc-500">
                Total: ${(parseFloat(costPerOccurrence) * occurrenceDates.length).toFixed(2)} ({occurrenceDates.length} dates × ${parseFloat(costPerOccurrence).toFixed(2)})
              </p>
            )}
            {requiresPermissionSlip &&
              ((isRecurring && costPerOccurrence && parseFloat(costPerOccurrence) > 0) ||
                (!isRecurring && cost && parseFloat(cost) > 0)) && (
                <p className="mt-0.5 text-xs text-zinc-500">
                  Parents will choose to pay online or send cash with their child.
                </p>
              )}
          </div>
          {(requiresPermissionSlip || (hasMultipleDates ? (costPerOccurrence && parseFloat(costPerOccurrence) > 0) : (cost && parseFloat(cost) > 0))) && (
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasSeparateDueDate}
                  onChange={(e) => {
                    setHasSeparateDueDate(e.target.checked);
                    if (e.target.checked && !permissionSlipDueDate) {
                      setPermissionSlipDueDate(hasMultipleDates && occurrenceDates.length > 0 ? occurrenceDates[0] : startDate);
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
                  <label htmlFor="event-due-date" className="mb-1 block text-sm font-medium text-zinc-700">
                    Due date
                  </label>
                  <input
                    id="event-due-date"
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
