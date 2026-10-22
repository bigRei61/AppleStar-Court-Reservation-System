import { addHours } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { bookingRules, venue } from "@/lib/config";

export function manilaDate(date: Date | string = new Date()) { return formatInTimeZone(date, venue.timeZone, "yyyy-MM-dd"); }
export function formatDate(date: Date | string, pattern = "EEEE, d MMMM") { return formatInTimeZone(date, venue.timeZone, pattern); }
export function formatTime(date: Date | string) { return formatDate(date, "h:mm a"); }
export function dayInstant(date: string, time = "00:00") { return fromZonedTime(`${date}T${time.length === 5 ? `${time}:00` : time}`, venue.timeZone); }
export function nextDate(date: string, days = 1) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
export function dayRange(date: string) { return { from: dayInstant(date).toISOString(), to: dayInstant(nextDate(date)).toISOString() }; }
export function weekday(date: string) { return Number(formatDate(dayInstant(date), "i")) % 7; }
export function lastBookingDate(now = new Date()) { return nextDate(manilaDate(now), bookingRules.advanceDays - 1); }
export function endsAt(start: string, hours: number) { return addHours(new Date(start), hours).toISOString(); }
export function canCancel(start: string, now = new Date()) { return new Date(start).getTime() - now.getTime() >= bookingRules.freeCancellationHours * 3_600_000; }
export function overlaps(start: string, end: string, otherStart: string, otherEnd: string) { return new Date(start) < new Date(otherEnd) && new Date(end) > new Date(otherStart); }
export function isDateKey(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dayInstant(value).getTime()) && manilaDate(dayInstant(value)) === value; }
