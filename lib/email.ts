import "server-only";
import { Resend } from "resend";
import { bookingCalendar } from "@/lib/calendar";
import { bookingRules, siteUrl, venue } from "@/lib/config";
import { formatDate, formatTime } from "@/lib/time";
import type { Booking } from "@/lib/types";

export async function sendBookingEmail({ booking, courtName, email, cancelledByPlayer = false }: { booking: Booking; courtName: string; email: string | undefined; cancelledByPlayer?: boolean }): Promise<string | undefined> {
  const cancelled = booking.status === "cancelled";
  const saved = cancelled ? "Your cancellation is saved." : "Your booking is saved.";
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !email) return `${saved} Email delivery isn’t available right now—keep your booking reference.`;
  const text = [`${cancelled ? "Your booking is cancelled." : "You’re booked. See you on court!"}`, "", venue.name, venue.address, `${courtName} · ${formatDate(booking.start_time)}`, `${formatTime(booking.start_time)} to ${formatTime(booking.end_time)} (Manila time)`, `Reference: ${booking.id.slice(0, 8).toUpperCase()}`, "", cancelled ? "Your time has been released for another player." : `Pay at the court. No online payment needed. Free cancellation until ${bookingRules.freeCancellationHours} hours before your game.`, `${siteUrl}/bookings/${booking.id}`, venue.mapUrl].join("\n");
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const signal = AbortSignal.timeout(8_000);
    const requests = [resend.emails.send({ from: process.env.RESEND_FROM_EMAIL, to: [email], subject: `${cancelled ? "Booking cancelled" : "You’re booked"} · ${venue.name}`, text, ...(cancelled ? {} : { attachments: [{ filename: "starapple-game.ics", content: Buffer.from(bookingCalendar(booking, courtName)).toString("base64") }] }) }, { signal, idempotencyKey: `booking-${booking.id}-${booking.status}` })];
    if (cancelledByPlayer && venue.email) requests.push(resend.emails.send({ from: process.env.RESEND_FROM_EMAIL, to: [venue.email], subject: `Player cancellation · ${courtName} · ${formatDate(booking.start_time, "d MMM")}`, text }, { signal, idempotencyKey: `admin-cancel-${booking.id}` }));
    const results = await Promise.allSettled(requests);
    const player = results[0];
    const admin = results[1];
    if (admin && (admin.status === "rejected" || admin.value.error)) console.error("Venue cancellation notification failed.");
    if (player.status === "rejected" || player.value.error) return `${saved} We couldn’t send the email. You can always find this game in My Bookings.`;
  } catch { return `${saved} We couldn’t send the email. You can always find this game in My Bookings.`; }
}
