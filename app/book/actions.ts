"use server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { getAvailability } from "@/lib/data";
import { bookingSchema, profileSchema } from "@/lib/validation";
import { durationProblem } from "@/lib/availability";
import { bookingRules } from "@/lib/config";
import { endsAt, manilaDate } from "@/lib/time";
import { bookingError } from "@/lib/booking-errors";
import { sendBookingEmail } from "@/lib/email";
import type { ActionResult, Booking } from "@/lib/types";
import { bookingGuardsReady, bookingSetupMessage } from "@/lib/database-ready";
export async function confirmBooking(input: unknown): Promise<ActionResult<Booking>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, code: "AUTH", error: "Log in to confirm your booking." };
  if (!await bookingGuardsReady()) return { ok: false, code: "SETUP", error: bookingSetupMessage };
  if (!profileSchema.safeParse(viewer.profile).success) return { ok: false, code: "PROFILE", error: "Add your name and mobile number before booking." };
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check your court, time, and notes, then try again." };
  const { courtId, startTime, duration, notes } = parsed.data;
  let availability;
  try { availability = await getAvailability(manilaDate(startTime)); } catch { return { ok: false, error: "We couldn’t check that time. Your selection is saved—please try again." }; }
  const problem = durationProblem(availability, courtId, startTime, duration);
  if (problem) return { ok: false, code: problem.includes("no longer") || problem.includes("taken") ? "SLOT_TAKEN" : "INVALID_SLOT", error: problem };
  const client = await createClient();
  const { count, error: countError } = await client.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", viewer.user.id).neq("status", "cancelled").gt("end_time", new Date().toISOString());
  if (countError) return { ok: false, error: "We couldn’t check your upcoming games. Please try again." };
  if ((count || 0) >= bookingRules.maxUpcomingBookings) return { ok: false, code: "BOOKING_LIMIT", error: `You have ${bookingRules.maxUpcomingBookings} upcoming bookings. Cancel one or wait until one has passed.` };
  const { data, error } = await client.from("bookings").insert({ user_id: viewer.user.id, court_id: courtId, start_time: startTime, end_time: endsAt(startTime, duration), status: "confirmed", notes: notes || null }).select().single();
  if (error) return { ok: false, ...bookingError(error) };
  const booking = data as Booking;
  revalidatePath("/bookings"); revalidatePath("/admin");
  const warning = await sendBookingEmail({ booking, courtName: availability.courts.find((court) => court.id === courtId)?.name || "Your court", email: viewer.user.email });
  return { ok: true, data: booking, warning };
}
