"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { CancelBooking } from "@/components/booking/cancel-booking";
import { formatDate, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Booking, Court } from "@/lib/types";
export function PlayerBookings({ bookings, courts, now }: { bookings: Booking[]; courts: Court[]; now: string }) {
  const [tab, setTab] = useState("upcoming");
  const upcoming = bookings.filter((booking) => new Date(booking.end_time) > new Date(now) && ["confirmed", "paid"].includes(booking.status)).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const upcomingIds = new Set(upcoming.map((booking) => booking.id)); const past = bookings.filter((booking) => !upcomingIds.has(booking.id)); const list = tab === "upcoming" ? upcoming : past;
  return <><div className="segmented" role="group" aria-label="Booking history"><button className={cn(tab === "upcoming" && "active")} aria-pressed={tab === "upcoming"} onClick={() => setTab("upcoming")}>Upcoming ({upcoming.length})</button><button className={cn(tab === "past" && "active")} aria-pressed={tab === "past"} onClick={() => setTab("past")}>Past & cancelled ({past.length})</button></div>{!list.length ? <EmptyState title={tab === "upcoming" ? "Your next game is waiting." : "Your court stories start here."}><p>{tab === "upcoming" ? "No upcoming bookings yet. Let’s put a little play in your day." : "Your past games and cancelled bookings will appear here."}</p><Button asChild><Link href="/book">Book your first game <ArrowUpRight size={16} /></Link></Button></EmptyState> : <div className="booking-list">{list.map((booking) => <article className="booking-card" key={booking.id}><div className="booking-date-box"><span>{formatDate(booking.start_time, "MMM")}</span><strong>{formatDate(booking.start_time, "d")}</strong><span>{formatDate(booking.start_time, "EEE")}</span></div><div className="booking-card-info"><Link href={`/bookings/${booking.id}`}><h3>{courts.find((court) => court.id === booking.court_id)?.name || "Your court"}</h3></Link><p>{formatTime(booking.start_time)} – {formatTime(booking.end_time)} · Manila time</p><p>#{booking.id.slice(0, 8).toUpperCase()}</p></div><div className="booking-card-actions"><StatusBadge status={booking.status} /><Button size="sm" variant="outline" asChild><Link href={`/bookings/${booking.id}`}>View details</Link></Button>{tab === "upcoming" && <CancelBooking booking={booking} now={now} />}</div></article>)}</div>}</>;
}
