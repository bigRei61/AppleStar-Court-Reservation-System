import { venue } from "@/lib/config";
import type { Booking } from "@/lib/types";
function escape(value: string) { return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,"); }
function utc(value: string | Date) { return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
export function bookingCalendar(booking: Booking, courtName: string) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StarApple//Court Booking//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT", `UID:${booking.id}@starapple-pickleball`, `DTSTAMP:${utc(booking.created_at)}`, `DTSTART:${utc(booking.start_time)}`, `DTEND:${utc(booking.end_time)}`, `SUMMARY:${escape(`Pickleball at ${venue.name} · ${courtName}`)}`, `LOCATION:${escape(`${venue.address} ${venue.mapUrl}`)}`, `DESCRIPTION:${escape(`Pay at the court. Booking reference: ${booking.id.slice(0, 8).toUpperCase()}. All court times are in Asia/Manila. Manage your booking on the venue website.`)}`, `STATUS:${booking.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT", "END:VCALENDAR"];
  // RFC 5545 limits content lines to 75 octets; fold using UTF-8 byte lengths.
  return lines.map((line) => { let result = ""; let length = 0; for (const char of line) { const bytes = new TextEncoder().encode(char).length; if (length + bytes > 74) { result += "\r\n "; length = 1; } result += char; length += bytes; } return result; }).join("\r\n") + "\r\n";
}
