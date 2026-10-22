"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBooking } from "@/app/bookings/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Message } from "@/components/ui/feedback";
import { canCancel, formatDate, formatTime } from "@/lib/time";
import { venue } from "@/lib/config";
import type { Booking } from "@/lib/types";
export function CancelBooking({ booking, now, admin = false }: { booking: Booking; now: string; admin?: boolean }) {
  const [open, setOpen] = useState(false); const [pending, start] = useTransition(); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const router = useRouter();
  if (booking.status === "cancelled" || booking.status === "no_show" || new Date(booking.end_time) <= new Date(now)) return null;
  if (!admin && !canCancel(booking.start_time, new Date(now))) return <p className="muted small" style={{ maxWidth: 245, margin: 0, fontSize: 11 }}>Too late to cancel online. {venue.phone ? <a href={`tel:${venue.phone}`} className="inline-link">Call {venue.phone}</a> : <a href={venue.mapUrl} target="_blank" rel="noreferrer" className="inline-link">Contact the venue</a>}.</p>;
  return <>{message && <Message>{message}</Message>}<Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Cancel booking</Button><Dialog open={open} onOpenChange={(value) => { if (!pending) setOpen(value); }}><DialogContent><DialogTitle>Can’t make this one?</DialogTitle><DialogDescription className="dialog-description">Cancel your {formatTime(booking.start_time)} game on {formatDate(booking.start_time, "EEEE, d MMMM")}? Your court time will become available to other players.</DialogDescription>{error && <Message error>{error}</Message>}<div className="button-row"><Button variant="destructive" disabled={pending} onClick={() => start(async () => { setError(""); try { const result = await cancelBooking(booking.id); if (!result.ok) setError(result.error); else { setOpen(false); setMessage(result.warning || "Your booking is cancelled. We’ll see you for the next one."); router.refresh(); } } catch { setError("We couldn’t cancel. Please check your bookings and try again."); } })}>{pending ? "Cancelling…" : "Yes, cancel booking"}</Button><Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Keep my booking</Button></div></DialogContent></Dialog></>;
}
