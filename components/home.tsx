"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { manilaDate, lastBookingDate, dayInstant, formatDate, formatTime } from "@/lib/time";
import { slotsForDay, slotState, hoursForDay } from "@/lib/availability";
import type { Availability } from "@/lib/types";
import { useClientReady } from "@/lib/client-ready";

export function QuickBook() {
  const ready = useClientReady();
  return ready ? <QuickBookFields /> : <div className="quick-book" aria-label="Loading date picker" style={{ minHeight: 110 }} />;
}
function QuickBookFields() {
  const [date, setDate] = useState(() => manilaDate());
  const [duration, setDuration] = useState("1");
  const [today] = useState(() => manilaDate());
  const [last] = useState(() => lastBookingDate());
  return <div className="quick-book"><div className="quick-book-intro"><CalendarDays size={30} strokeWidth={1.4} /><div><strong>Make time for a game.</strong><p>Your court is a few taps away.</p></div></div><div className="quick-field"><label htmlFor="quick-date">Pick your day</label><input id="quick-date" aria-label="Pick your day" type="date" min={today} max={last} value={date} onChange={(e) => setDate(e.target.value)} /></div><div className="quick-field"><label htmlFor="quick-duration">Time on court</label><select id="quick-duration" value={duration} onChange={(e) => setDuration(e.target.value)}><option value="1">1 hour of play</option><option value="2">2 hours of play</option><option value="3">3 hours of play</option></select></div><Button asChild size="lg"><Link href={`/book?date=${date}&duration=${duration}`}>Find a court <ArrowUpRight size={17} /></Link></Button></div>;
}

export function TodayPreview() {
  const [data, setData] = useState<Availability | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    async function load() { try { const response = await fetch(`/api/availability?date=${manilaDate()}`, { cache: "no-store" }); if (response.ok && live) setData(await response.json()); } catch { /* Keep the booking link available during outages. */ } finally { if (live) setLoaded(true); } }
    void load(); const timer = setInterval(load, 30_000); return () => { live = false; clearInterval(timer); };
  }, []);
  if (!loaded) return <div className="today-grid" role="status" aria-label="Loading today’s times">{[0,1,2,3].map((i) => <div className="skeleton" style={{ height: 157 }} key={i} />)}</div>;
  const openings = data ? slotsForDay(data.hours, data.date).flatMap((start) => data.courts.filter((court) => slotState(court.id, start, data.unavailable) === "available").map((court) => ({ start, court }))).slice(0, 4) : [];
  if (!openings.length) return <div className="today-unavailable"><span>{data ? "That’s a wrap for today. Your next game is waiting." : "A little planning. A lot more playing."}</span><Link href="/book" className="section-link">{data ? "Explore upcoming days" : "See live court times"} <ArrowRight size={17} /></Link></div>;
  return <div className="today-grid" aria-live="polite">{openings.map(({ start, court }) => <Link key={`${court.id}-${start}`} href={`/book?date=${data!.date}&court=${court.id}&start=${encodeURIComponent(start)}`} className="today-slot"><small>{court.name} · 1 hour</small><strong>{formatTime(start)}</strong><div className="today-slot-bottom"><span><i className="live-dot" />Available today</span><ArrowUpRight size={17} /></div></Link>)}</div>;
}

export function VenueHours() {
  const [text, setText] = useState("Check opening hours when you book");
  useEffect(() => { fetch(`/api/availability?date=${manilaDate()}`).then((r) => r.ok ? r.json() : null).then((data: Availability | null) => { if (!data) return; const hours = hoursForDay(data.hours, data.date); setText(hours ? `Today · ${formatTime(dayInstant(data.date, hours.open_time))} – ${formatTime(dayInstant(data.date, hours.close_time))}` : "Closed today · See other days"); }).catch(() => {}); }, []);
  return <span>{text}</span>;
}

export function BookingAside() { return <aside className="booking-aside"><div className="panel"><p className="eyebrow">GOOD TO KNOW</p><h3>Less planning.<br />More playing.</h3>{[{ icon: CalendarDays, title: "Your time, your court", text: "Book 1, 2 or 3 hours. Plan your next game up to 14 days ahead." }, { icon: Check, title: "Pay when you play", text: "Cash, card or GCash at the court. No online payment needed." }, { icon: Clock3, title: "Plans can change", text: "Cancel for free until 12 hours before your game." }, { icon: MapPin, title: "Always Manila time", text: "Every time shown is Philippine time (UTC+8), wherever you are." }].map(({ icon: Icon, title, text }) => <div className="aside-note" key={title}><Icon size={19} strokeWidth={1.6} /><div><strong>{title}</strong><p>{text}</p></div></div>)}</div></aside>; }

export function SelectionSummary({ court, start, duration }: { court: string; start: string; duration: number }) { return <div className="summary-lines"><div className="summary-line"><MapPin size={19} /><div><small>Your court</small><strong>{court}</strong></div></div><div className="summary-line"><CalendarDays size={19} /><div><small>Your day · Manila time</small><strong>{formatDate(start)}</strong></div></div><div className="summary-line"><Clock3 size={19} /><div><small>{duration} {duration === 1 ? "hour" : "hours"} of play</small><strong>{formatTime(start)} – {formatTime(new Date(new Date(start).getTime() + duration * 3_600_000))}</strong></div></div></div>; }
