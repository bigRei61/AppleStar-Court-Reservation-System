"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { canCancel } from "@/lib/time";
import { venue } from "@/lib/config";
import { sendBookingEmail } from "@/lib/email";
import { bookingError } from "@/lib/booking-errors";
import type { ActionResult, Booking } from "@/lib/types";
import { bookingGuardsReady, bookingSetupMessage } from "@/lib/database-ready";
export async function cancelBooking(id: string): Promise<ActionResult<Booking>> {
  const viewer = await requireViewer("/bookings");
  if (!await bookingGuardsReady()) return { ok: false, code: "SETUP", error: bookingSetupMessage };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "We couldn’t find that booking." };
  const client = await createClient();
  let query = client.from("bookings").select("*").eq("id", id);
  if (!viewer.profile?.is_admin) query = query.eq("user_id", viewer.user.id);
  const { data, error } = await query.single();
  if (error || !data) return { ok: false, error: "We couldn’t find that booking." };
  const booking = data as Booking;
  if (booking.status === "cancelled") return { ok: true, data: booking };
  if (!viewer.profile?.is_admin && (booking.status === "no_show" || !canCancel(booking.start_time))) return { ok: false, error: `It’s too late to cancel online. ${venue.phone ? `Call ${venue.phone}.` : "Please contact the venue."}` };
  const { data: cancelled, error: updateError } = await client.from("bookings").update({ status: "cancelled" }).eq("id", id).eq("status", booking.status).select().single();
  if (updateError) return { ok: false, ...bookingError(updateError) };
  const { data: court } = await client.from("courts").select("name").eq("id", booking.court_id).single();
  let email = booking.user_id === viewer.user.id ? viewer.user.email : undefined;
  if (!email) { const contact = await client.rpc("booking_contact_email", { booking_id: id }); email = typeof contact.data === "string" ? contact.data : undefined; }
  const warning = await sendBookingEmail({ booking: cancelled as Booking, courtName: court?.name || "Your court", email, cancelledByPlayer: !viewer.profile?.is_admin });
  revalidatePath("/bookings"); revalidatePath(`/bookings/${id}`); revalidatePath("/admin");
  return { ok: true, data: cancelled as Booking, warning };
}
