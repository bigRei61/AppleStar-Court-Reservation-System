import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, Download, MapPin } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { venue } from "@/lib/config";
import { PageHeading, PageSkeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { SelectionSummary } from "@/components/home";
import { CancelBooking } from "@/components/booking/cancel-booking";
import type { Booking } from "@/lib/types";
export const metadata = { title: "Booking details" };
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const viewer = await requireViewer(`/bookings/${id}`); if (!z.uuid().safeParse(id).success) notFound();
  const client = await createClient(); let query = client.from("bookings").select("*").eq("id", id); if (!viewer.profile?.is_admin) query = query.eq("user_id", viewer.user.id);
  const { data, error } = await query.single(); if (error || !data) notFound(); const booking = data as Booking;
  const { data: court } = await client.from("courts").select("name").eq("id", booking.court_id).single();
  const duration = (new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / 3_600_000;
  return <div className="page-width narrow"><Link className="section-link" href={viewer.profile?.is_admin ? "/admin/bookings" : "/bookings"} style={{ color: "var(--muted)", marginBottom: 25 }}><ArrowLeft size={15} />Back to bookings</Link><PageHeading eyebrow={`BOOKING · ${id.slice(0, 8).toUpperCase()}`} title={booking.status === "cancelled" ? "Until the next game." : "Your court is waiting."}>Everything you need for your time on court.</PageHeading><div className="panel"><StatusBadge status={booking.status} /><SelectionSummary court={court?.name || "Your court"} start={booking.start_time} duration={duration} />{booking.notes && <div className="aside-note"><div><strong>Your notes</strong><p>{booking.notes}</p></div></div>}<div className="review-note"><MapPin size={19} /><div><strong>{venue.name}</strong><br /><a href={venue.mapUrl} target="_blank" rel="noreferrer" className="inline-link">Get directions</a> · {venue.address}<br />Pay at the court. No online payment needed.</div></div><div className="button-row">{booking.status !== "cancelled" && <Button asChild><a href={`/api/bookings/${booking.id}/calendar`}><Download size={16} />Add to calendar</a></Button>}<CancelBooking booking={booking} now={new Date().toISOString()} admin={viewer.profile?.is_admin} /></div></div></div>;
}
export default function BookingDetails(props: { params: Promise<{ id: string }> }) { return <Suspense fallback={<PageSkeleton />}><Content {...props} /></Suspense>; }
