import { addMinutes } from "date-fns";
import { bookingRules, durationLabel } from "@/lib/config";
import { dayInstant, endsAt, formatDate, lastBookingDate, manilaDate, overlaps, weekday } from "@/lib/time";
import type { Availability, OperatingHours, UnavailableSlot } from "@/lib/types";

export function hoursForDay(hours: OperatingHours[], date: string) { return hours.find((row) => row.day_of_week === weekday(date)); }
export function slotsForDay(hours: OperatingHours[], date: string) {
  const day = hoursForDay(hours, date);
  if (!day || day.open_time >= day.close_time) return [];
  const slots: string[] = [];
  const close = dayInstant(date, day.close_time);
  let current = dayInstant(date, day.open_time);
  if (formatDate(current, "mm:ss") !== "00:00") current = new Date(Math.ceil(current.getTime() / 3_600_000) * 3_600_000);
  while (addMinutes(current, bookingRules.slotMinutes) <= close) {
    slots.push(current.toISOString());
    current = addMinutes(current, bookingRules.slotMinutes);
  }
  return slots;
}
export function slotState(courtId: string, start: string, unavailable: UnavailableSlot[], now = new Date()) {
  if (new Date(start).getTime() < now.getTime() + bookingRules.minimumLeadHours * 3_600_000) return "past";
  const conflict = unavailable.find((s) => String(s.court_id) === courtId && overlaps(start, endsAt(start, 1), s.start_time, s.end_time));
  return conflict ? (conflict.kind === "blocked" ? "blocked" : "booked") : "available";
}
export function durationProblem(data: Availability, courtId: string, start: string, duration: number, now = new Date()): string | null {
  if (!bookingRules.durations.includes(duration)) return `Choose ${durationLabel} hours.`;
  const date = manilaDate(start);
  if (date < manilaDate(now) || date > lastBookingDate(now)) return `Choose a day in the next ${bookingRules.advanceDays} days.`;
  if (!data.courts.some((c) => String(c.id) === courtId && c.is_active)) return "This court is unavailable.";
  const hours = hoursForDay(data.hours, date);
  if (!hours || new Date(start) < dayInstant(date, hours.open_time) || new Date(endsAt(start, duration)) > dayInstant(date, hours.close_time)) return "Outside opening hours";
  if (formatDate(start, "mm:ss") !== "00:00" || new Date(start).getUTCMilliseconds() !== 0) return "Choose a time on the hour.";
  for (let hour = 0; hour < duration; hour++) {
    const state = slotState(courtId, endsAt(start, hour), data.unavailable, now);
    if (state === "past") return `Book at least ${bookingRules.minimumLeadHours} hour${bookingRules.minimumLeadHours === 1 ? "" : "s"} ahead`;
    if (state !== "available") return hour === 0 ? "This time is no longer available" : "Next hour is taken or closed";
  }
  return null;
}
