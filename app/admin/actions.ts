"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { getAvailability } from "@/lib/data";
import { durationProblem } from "@/lib/availability";
import { bookingSchema, profileSchema } from "@/lib/validation";
import { dayInstant, endsAt, isDateKey, manilaDate, overlaps } from "@/lib/time";
import { bookingError } from "@/lib/booking-errors";
import { sendBookingEmail } from "@/lib/email";
import type { ActionResult, Booking } from "@/lib/types";
import { bookingGuardsReady, bookingSetupMessage } from "@/lib/database-ready";
function refreshAdmin() { revalidatePath("/admin", "layout"); revalidatePath("/bookings"); }

export async function setBookingStatus(id: string, status: "paid" | "no_show"): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success || !["paid", "no_show"].includes(status)) return { ok: false, error: "Choose a valid booking and status." };
  const client = await createClient();
  const { data, error } = await client.from("bookings").update({ status }).eq("id", id).neq("status", "cancelled").select("id").single();
  if (error || !data) return { ok: false, error: "We couldn’t update that booking. It may have been cancelled." };
  refreshAdmin(); revalidatePath(`/bookings/${id}`); return { ok: true, data: undefined };
}
export async function saveCourt(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: z.uuid().optional(), name: z.string().trim().min(1, "Enter a court name.").max(60), is_active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const client = await createClient(); const { id, ...values } = parsed.data;
  const result = id ? await client.from("courts").update(values).eq("id", id).select("id").single() : await client.from("courts").insert(values).select("id").single();
  if (result.error) return { ok: false, error: "We couldn’t save the court. Please try again." };
  refreshAdmin(); return { ok: true, data: undefined };
}
export async function saveHours(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ day_of_week: z.number().int().min(0).max(6), closed: z.boolean(), open_time: z.string().regex(/^\d{2}:\d{2}$/), close_time: z.string().regex(/^\d{2}:\d{2}$/) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a day and valid opening hours." };
  const { day_of_week, closed, open_time, close_time } = parsed.data;
  if (!closed && (open_time >= close_time || open_time > "23:59" || close_time > "23:59" || Number(open_time.slice(3)) > 59 || Number(close_time.slice(3)) > 59)) return { ok: false, error: "Closing time must be later than opening time, on the same day." };
  const client = await createClient(); const result = closed ? await client.from("operating_hours").delete().eq("day_of_week", day_of_week) : await client.from("operating_hours").upsert({ day_of_week, open_time, close_time }, { onConflict: "day_of_week" });
  if (result.error) return { ok: false, error: "We couldn’t save these hours. Please try again." };
  refreshAdmin(); return { ok: true, data: undefined };
}
export async function createBlock(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (!await bookingGuardsReady()) return { ok: false, code: "SETUP", error: bookingSetupMessage };
  const parsed = z.object({ court_id: z.string(), date_from: z.string(), date_to: z.string(), start_time: z.string().regex(/^\d{2}:\d{2}$/), end_time: z.string().regex(/^\d{2}:\d{2}$/), reason: z.enum(["League", "Lessons", "Maintenance", "Private event"]) }).safeParse(input);
  if (!parsed.success || !isDateKey(parsed.data.date_from) || !isDateKey(parsed.data.date_to)) return { ok: false, error: "Choose the court, dates, and times to close." };
  const values = parsed.data; const start = dayInstant(values.date_from, values.start_time); const end = dayInstant(values.date_to, values.end_time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || end <= new Date()) return { ok: false, error: "Choose an end time after the start, in the future." };
  const client = await createClient(); const { data: courts, error: courtError } = await client.from("courts").select("id").eq("is_active", true);
  if (courtError || !courts?.length) return { ok: false, error: "No active courts are available." };
  const ids: string[] = values.court_id === "all" ? courts.map((court) => court.id) : courts.filter((court) => court.id === values.court_id).map((court) => court.id);
  if (!ids.length) return { ok: false, error: "Choose an active court." };
  const { data: bookings, error: conflictError } = await client.from("bookings").select("id,court_id,start_time,end_time").in("court_id", ids).neq("status", "cancelled").lt("start_time", end.toISOString()).gt("end_time", start.toISOString());
  if (conflictError) return { ok: false, error: "We couldn’t check existing bookings. Please try again." };
  if (bookings?.some((booking) => overlaps(start.toISOString(), end.toISOString(), booking.start_time, booking.end_time))) return { ok: false, code: "BLOCK_CONFLICT", error: "This block overlaps a booking. Cancel or contact the affected players first." };
  const { error } = await client.from("blocked_slots").insert(ids.map((court_id) => ({ court_id, start_time: start.toISOString(), end_time: end.toISOString(), reason: values.reason })));
  if (error) return { ok: false, ...bookingError(error) };
  refreshAdmin(); return { ok: true, data: undefined };
}
export async function deleteBlock(id: string): Promise<ActionResult> {
  await requireAdmin(); if (!z.uuid().safeParse(id).success) return { ok: false, error: "Choose a valid block." };
  const client = await createClient(); const { error } = await client.from("blocked_slots").delete().eq("id", id);
  if (error) return { ok: false, error: "We couldn’t remove that block. Please try again." };
  refreshAdmin(); return { ok: true, data: undefined };
}
export async function savePlayer(input: unknown): Promise<ActionResult> {
  await requireAdmin(); const parsed = profileSchema.extend({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, ...values } = parsed.data; const client = await createClient(); const { error } = await client.from("profiles").update(values).eq("id", id);
  if (error) return { ok: false, error: "We couldn’t save that player. Please try again." };
  refreshAdmin(); return { ok: true, data: undefined };
}
export async function createWalkIn(input: unknown): Promise<ActionResult<Booking>> {
  await requireAdmin(); const parsed = bookingSchema.extend({ userId: z.uuid() }).safeParse(input);
  if (!await bookingGuardsReady()) return { ok: false, code: "SETUP", error: bookingSetupMessage };
  if (!parsed.success) return { ok: false, error: "Choose an existing player, court, and available time." };
  const { courtId, startTime, duration, notes, userId } = parsed.data;
  let availability; try { availability = await getAvailability(manilaDate(startTime)); } catch { return { ok: false, error: "We couldn’t check that time. Please try again." }; }
  const problem = durationProblem(availability, courtId, startTime, duration); if (problem) return { ok: false, error: problem };
  const client = await createClient(); const { data: profile } = await client.from("profiles").select("id").eq("id", userId).single();
  if (!profile) return { ok: false, error: "Choose a player with an existing account." };
  const { data, error } = await client.from("bookings").insert({ user_id: userId, court_id: courtId, start_time: startTime, end_time: endsAt(startTime, duration), status: "confirmed", notes: notes || null }).select().single();
  if (error) return { ok: false, ...bookingError(error) };
  const booking = data as Booking; const contact = await client.rpc("booking_contact_email", { booking_id: booking.id });
  const warning = await sendBookingEmail({ booking, courtName: availability.courts.find((court) => court.id === courtId)?.name || "Your court", email: typeof contact.data === "string" ? contact.data : undefined });
  refreshAdmin(); return { ok: true, data: booking, warning };
}
