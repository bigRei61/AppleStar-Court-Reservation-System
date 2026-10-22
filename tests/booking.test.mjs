import test from "node:test";
import assert from "node:assert/strict";
import { bookingRules } from "../lib/config.ts";
import { manilaDate, dayRange, dayInstant, nextDate, canCancel, endsAt, isDateKey, lastBookingDate, overlaps } from "../lib/time.ts";
import { durationProblem, slotsForDay, slotState } from "../lib/availability.ts";
import { normalizePhone, phoneSchema, safeNext } from "../lib/validation.ts";
import { bookingCalendar } from "../lib/calendar.ts";
import { bookingError } from "../lib/booking-errors.ts";

const date = "2026-10-23";
const now = new Date("2026-10-22T23:00:00Z"); // 7 AM in Manila.
const start = dayInstant(date, "08:00").toISOString();
const data = { courts: [{ id: "court-1", name: "Court 1", is_active: true }], hours: Array.from({ length: 7 }, (_, day_of_week) => ({ day_of_week, open_time: "08:00:00", close_time: "22:00:00" })), unavailable: [], date, fetchedAt: now.toISOString() };

test("Manila dates, day bounds, and the 14-day window use UTC+8", () => {
  assert.equal(manilaDate("2026-10-22T16:01:00Z"), "2026-10-23");
  assert.deepEqual(dayRange(date), { from: "2026-10-22T16:00:00.000Z", to: "2026-10-23T16:00:00.000Z" });
  assert.equal(lastBookingDate(now), "2026-11-05");
  assert.equal(bookingRules.advanceDays, 14);
});
test("date navigation is independent of device DST and timezone", () => {
  const previous = process.env.TZ;
  try { for (const zone of ["Asia/Manila", "America/Los_Angeles", "America/New_York", "Europe/London", "Pacific/Auckland"]) { process.env.TZ = zone; assert.equal(nextDate("2026-03-08"), "2026-03-09", zone); assert.equal(nextDate("2026-11-01"), "2026-11-02", zone); assert.equal(dayInstant(date, "08:00").toISOString(), "2026-10-23T00:00:00.000Z", zone); } }
  finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test("calendar dates reject normalized impossible dates", () => { assert.equal(isDateKey("2026-02-30"), false); assert.equal(isDateKey("2026-13-01"), false); assert.equal(isDateKey("2028-02-29"), true); assert.equal(isDateKey("2026-2-01"), false); });
test("the lead-time boundary is inclusive and old slots are disabled", () => {
  assert.equal(durationProblem(data, "court-1", start, 1, now), null);
  assert.match(durationProblem(data, "court-1", start, 1, new Date(now.getTime() + 1)), /1 hour/);
  assert.equal(slotState("court-1", start, [], new Date(now.getTime() + 1)), "past");
});
test("durations, active courts, full-hour starts, and booking horizon are validated", () => {
  assert.match(durationProblem(data, "court-1", start, 4, now), /1, 2 or 3/);
  assert.match(durationProblem(data, "missing", start, 1, now), /court is unavailable/);
  assert.match(durationProblem(data, "court-1", dayInstant(date, "08:30").toISOString(), 1, now), /on the hour/);
  assert.match(durationProblem(data, "court-1", dayInstant("2026-11-06", "08:00").toISOString(), 1, now), /14 days/);
});
test("multi-hour bookings require consecutive open hours and allow back-to-back games", () => {
  const withBooking = { ...data, unavailable: [{ court_id: "court-1", start_time: endsAt(start, 1), end_time: endsAt(start, 2), kind: "booking" }] };
  assert.equal(durationProblem(withBooking, "court-1", start, 1, now), null);
  assert.match(durationProblem(withBooking, "court-1", start, 2, now), /Next hour/);
  assert.equal(slotState("court-1", endsAt(start, 1), withBooking.unavailable, now), "booked");
  assert.equal(slotState("court-1", endsAt(start, 2), withBooking.unavailable, now), "available");
  assert.equal(overlaps(start, endsAt(start, 1), endsAt(start, 1), endsAt(start, 2)), false);
});
test("closures and partial-hour blocks prevent overlapping bookings", () => {
  const closed = { ...data, unavailable: [{ court_id: "court-1", start_time: dayInstant(date, "08:30").toISOString(), end_time: dayInstant(date, "09:30").toISOString(), kind: "blocked" }] };
  assert.equal(slotState("court-1", start, closed.unavailable, now), "blocked");
  assert.match(durationProblem(closed, "court-1", start, 1, now), /no longer available/);
  assert.equal(durationProblem({ ...data, hours: [] }, "court-1", start, 1, now), "Outside opening hours");
});
test("opening hours constrain the last slot and rounded starts", () => {
  assert.equal(slotsForDay(data.hours, date).length, 14);
  assert.equal(slotsForDay(data.hours, date).at(-1), dayInstant(date, "21:00").toISOString());
  const fractional = [{ day_of_week: 5, open_time: "08:30:30", close_time: "10:00:00" }];
  assert.deepEqual(slotsForDay(fractional, date), [dayInstant(date, "09:00").toISOString()]);
  assert.match(durationProblem(data, "court-1", dayInstant(date, "21:00").toISOString(), 2, now), /Outside opening hours/);
});
test("free cancellation is allowed exactly 12 hours before, never later", () => {
  const boundary = new Date(new Date(start).getTime() - 12 * 3_600_000);
  assert.equal(canCancel(start, boundary), true);
  assert.equal(canCancel(start, new Date(boundary.getTime() + 1)), false);
});
test("Philippine mobile numbers normalize and invalid numbers fail", () => {
  assert.equal(normalizePhone("0917 123 4567"), "+639171234567");
  assert.equal(phoneSchema.parse("639171234567"), "+639171234567");
  for (const value of ["1234567890", "+14155551234", "0917", "0917abc4567"]) assert.equal(phoneSchema.safeParse(value).success, false);
});
test("auth return paths retain selections and reject external redirects", () => {
  const next = "/book?date=2026-10-23&court=court-1&review=1";
  assert.equal(safeNext(next), next);
  for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "/login?next=/login", "/auth/callback", "/\n/evil.example"]) assert.equal(safeNext(value), "/book");
});
test("calendar downloads preserve UTC instants, escape text and fold UTF-8 lines", () => {
  const booking = { id: "test-reference", start_time: start, end_time: endsAt(start, 2), created_at: now.toISOString(), status: "confirmed" };
  const calendar = bookingCalendar(booking, "Court 1, doubles; game");
  assert.match(calendar, /DTSTART:20261023T000000Z/);
  assert.match(calendar, /DTEND:20261023T020000Z/);
  assert.match(calendar.replace(/\r\n[ \t]/g, ""), /Court 1\\, doubles\\; game/);
  assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
  for (const line of calendar.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
});
test("database conflicts have plain-language errors and other details stay private", () => {
  assert.equal(bookingError({ code: "23P01", message: "private database details" }).code, "SLOT_TAKEN");
  assert.equal(bookingError({ code: "P0001", message: "BOOKING_LIMIT" }).code, "BOOKING_LIMIT");
  assert.doesNotMatch(bookingError({ message: "private database details" }).error, /private/);
});
