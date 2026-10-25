"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Download, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { bookingRules } from "@/lib/config";
import { dayInstant, formatDate, formatTime, isDateKey, lastBookingDate, manilaDate, nextDate } from "@/lib/time";
import { durationProblem, hoursForDay, slotsForDay, slotState } from "@/lib/availability";
import { availabilityReader } from "@/lib/availability-client";
import { confirmBooking } from "@/app/book/actions";
import { BookingAside, SelectionSummary } from "@/components/home";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Message, PageHeading } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import type { Availability, Booking } from "@/lib/types";
import { useClientReady } from "@/lib/client-ready";
import { PageSkeleton } from "@/components/ui/feedback";

type Selection = { date: string; courtId: string; startTime: string; duration: number; notes: string; review: boolean };
const STORAGE_KEY = "starapple-booking-selection";
export function BookingFlow() {
  const ready = useClientReady();
  return ready ? <BookingClient /> : <PageSkeleton />;
}
function readSelection(params: ReturnType<typeof useSearchParams>): Selection {
  const first = manilaDate(); const last = lastBookingDate(); let saved: Partial<Selection> = {};
  try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}"); } catch { /* Storage is optional. */ }
  const requested = params.get("date") || saved.date || first;
  const date = isDateKey(requested) && requested >= first && requested <= last ? requested : first;
  const start = params.get("start") || saved.startTime || "";
  const duration = Number(params.get("duration") || saved.duration || 1);
  return { date, courtId: params.get("court") || saved.courtId || "", startTime: start && !Number.isNaN(Date.parse(start)) && manilaDate(start) === date ? start : "", duration: bookingRules.durations.includes(duration) ? duration : 1, notes: typeof saved.notes === "string" ? saved.notes.slice(0, 500) : "", review: params.get("review") === "1" || Boolean(saved.review && saved.date === date) };
}
function BookingClient() {
  const params = useSearchParams(); const router = useRouter();
  const [initial] = useState(() => readSelection(params));
  const [date, setDate] = useState(initial.date); const [today] = useState(() => manilaDate()); const [lastDate] = useState(() => lastBookingDate());
  const [data, setData] = useState<Availability | null>(() => availabilityReader.peek(initial.date) || null); const [loading, setLoading] = useState(() => !availabilityReader.peek(initial.date)); const [error, setError] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");
  const [courtId, setCourtId] = useState(initial.courtId); const [startTime, setStartTime] = useState(initial.startTime); const [duration, setDuration] = useState(initial.duration); const [notes, setNotes] = useState(initial.notes);
  const [review, setReview] = useState(initial.review); const [signedIn, setSignedIn] = useState(false); const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<Booking | null>(null); const [warning, setWarning] = useState(""); const [filter, setFilter] = useState("all");
  const [highlightAlternatives, setHighlightAlternatives] = useState(false); const [lookingAhead, setLookingAhead] = useState(false);
  const [clock, setClock] = useState<Date>(() => new Date()); const requestNumber = useRef(0);
  useEffect(() => {
    let unsubscribe = () => {};
    try { const client = createClient(); const { data: listener } = client.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session))); unsubscribe = () => listener.subscription.unsubscribe(); } catch { /* Availability can still be browsed. */ }
    return unsubscribe;
  }, []);

  const load = useCallback(async (selectedDate: string, quiet = false) => {
    const number = ++requestNumber.current;
    try { const result = await availabilityReader.load(selectedDate, quiet); if (number === requestNumber.current) { setData(result); setAvailabilityError(""); setClock(new Date()); setCourtId((current) => result.courts.some((court) => court.id === current) ? current : result.courts[0]?.id || ""); } }
    catch { if (number === requestNumber.current) setAvailabilityError("We couldn’t update court times. Please retry. Your selection is saved."); }
    finally { if (number === requestNumber.current) setLoading(false); }
  }, []);
  // Fetch external availability; state updates happen after the network request resolves.
  useEffect(() => {
    if (!date || success) return;
    // Results update state asynchronously after the shared request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(date);
    const refresh = () => { if (document.visibilityState !== "hidden") { setClock(new Date()); void load(date, true); } };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [date, load, success]);
  useEffect(() => { if (!date || success) return; try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ date, courtId, startTime, duration, notes, review })); } catch { /* Flow remains usable without storage. */ } }, [date, courtId, startTime, duration, notes, review, success]);
  const selectDay = (value: string) => {
    if (value === date) return;
    requestNumber.current++;
    const cached = availabilityReader.peek(value);
    setLoading(!cached); setData(cached || null); setDate(value); setStartTime(""); setReview(false); setHighlightAlternatives(false); setFilter("all"); setError(""); setAvailabilityError("");
  };
  const selectedCourt = data?.courts.find((court) => court.id === courtId);
  const problem = data && startTime ? durationProblem(data, courtId, startTime, duration, clock || new Date(data.fetchedAt)) : null;
  const dates = today ? Array.from({ length: bookingRules.advanceDays }, (_, i) => nextDate(today, i)) : [];
  const slots = data ? slotsForDay(data.hours, date) : [];
  const available = data && clock ? slots.some((slot) => data.courts.some((court) => slotState(court.id, slot, data.unavailable, clock) === "available")) : false;
  const displayedSlots = slots.filter((slot) => { const hour = Number(formatDate(slot, "H")); return filter === "all" || (filter === "morning" && hour < 12) || (filter === "afternoon" && hour >= 12 && hour < 18) || (filter === "evening" && hour >= 18); });
  async function nextOpenDay() {
    setLookingAhead(true);
    try { for (let candidate = nextDate(date); candidate <= lastDate; candidate = nextDate(candidate)) { const next = await availabilityReader.load(candidate); if (slotsForDay(next.hours, candidate).some((slot) => next.courts.some((court) => slotState(court.id, slot, next.unavailable) === "available"))) { selectDay(candidate); return; } } setError("There are no open times in the next 14 days. Please check back soon."); }
    catch { setError("We couldn’t check the next days. Please try again."); } finally { setLookingAhead(false); }
  }
  function submit() {
    const returnPath = `/book?${new URLSearchParams({ date, court: courtId, start: startTime, duration: String(duration), review: "1" })}`;
    if (!signedIn) { setReview(true); try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ date, courtId, startTime, duration, notes, review: true })); } catch {} router.push(`/login?next=${encodeURIComponent(returnPath)}`); return; }
    startTransition(async () => {
      setError("");
      try { const result = await confirmBooking({ courtId, startTime, duration, notes });
        if (!result.ok) {
          if (result.code === "AUTH") { router.push(`/login?next=${encodeURIComponent(returnPath)}`); return; }
          if (result.code === "PROFILE") { router.push(`/account?complete=1&next=${encodeURIComponent(returnPath)}`); return; }
          setError(result.error);
          if (result.code === "SLOT_TAKEN" || result.code === "BOOKING_BLOCKED") { availabilityReader.invalidate(date); setReview(false); setHighlightAlternatives(true); await load(date, true); setError("Someone just booked or closed that time. Here are the nearest open slots—please pick another."); }
          return;
        }
        availabilityReader.invalidate(date); setSuccess(result.data); setWarning(result.warning || ""); setReview(false); try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      } catch { setError("We couldn’t confirm your booking. Your selection is saved. Check My Bookings before retrying if your connection dropped."); }
    });
  }
  if (success) return <div className="page-width"><div className="booking-success"><div className="success-symbol"><Check size={31} /></div><p className="eyebrow" style={{ justifyContent: "center" }}>IT’S A DATE</p><h1>You’re booked.<br />See you on court!</h1><p className="muted">Good games are better with good company.</p><p className="booking-reference">REFERENCE · {success.id.slice(0, 8).toUpperCase()}</p><div className="panel"><SelectionSummary court={selectedCourt?.name || "Your court"} start={success.start_time} duration={duration} /><div className="review-note"><ShieldCheck size={18} />Pay at the court. No online payment needed.</div></div>{warning && <Message>{warning}</Message>}<div className="button-row"><Button asChild><Link href="/bookings">View my bookings <ArrowRight size={16} /></Link></Button><Button asChild variant="outline"><a href={`/api/bookings/${success.id}/calendar`}><Download size={16} />Add to calendar</a></Button></div><Button variant="ghost" onClick={() => { setSuccess(null); setData(null); setLoading(true); setStartTime(""); setNotes(""); void load(date, true); }}>Book another game <ArrowUpRight size={14} /></Button></div></div>;
  return <div className="page-width booking-page"><PageHeading eyebrow="MAKE A LITTLE TIME FOR PLAY" title="Your next game starts here.">Pick a day. Find your time. We’ll save you a court.</PageHeading><div className="booking-layout"><div><section className="booking-section"><div className="step-heading"><span className="step-number">01</span><h2>Pick your day</h2><label className="date-picker"><span className="sr-only">Choose a date</span><input aria-label="Choose a date" type="date" value={date} min={today} max={lastDate} onChange={(e) => { if (isDateKey(e.target.value)) selectDay(e.target.value); }} /></label></div><div className="date-strip" role="group" aria-label="Choose your game day">{dates.map((day) => { const closed = data && !hoursForDay(data.hours, day); return <button key={day} type="button" className={cn("date-chip", date === day && "active")} aria-pressed={date === day} disabled={Boolean(closed)} onClick={() => selectDay(day)} aria-label={`${formatDate(dayInstant(day), "EEEE, d MMMM")}${closed ? ", closed" : ""}`}><span>{day === today ? "Today" : formatDate(dayInstant(day), "EEE")}</span><strong>{formatDate(dayInstant(day), "d")}</strong><small>{closed ? "Closed" : formatDate(dayInstant(day), "MMM")}</small></button>; })}</div></section><section className="booking-section"><div className="step-heading"><span className="step-number">02</span><h2>Find your time</h2><span className="muted small" style={{ marginLeft: "auto", fontSize: 10 }}>MANILA TIME · UTC+8</span></div><div className="booking-toolbar"><div className="segmented" role="group" aria-label="Filter time of day">{["all", "morning", "afternoon", "evening"].map((value) => <button key={value} type="button" aria-pressed={filter === value} className={cn(filter === value && "active")} onClick={() => setFilter(value)}>{value === "all" ? "All times" : value.charAt(0).toUpperCase() + value.slice(1)}</button>)}</div><div className="legend"><span><i className="legend-dot" />Available</span><span><i className="legend-dot taken" />Booked</span><span><LockKeyhole size={10} />Closed</span></div></div>{(availabilityError || error) && <Message error>{availabilityError || error}<div className="button-row" style={{ marginTop: 10 }}><Button size="sm" variant="outline" onClick={() => { setLoading(!data); setAvailabilityError(""); void load(date, true); }}><RefreshCw size={13} />Retry</Button><Link href="/bookings" className="inline-link">My bookings</Link></div></Message>}
      {loading ? <div role="status" aria-label="Loading court times">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton slot-skeleton" />)}</div> : data && !available ? <EmptyState title={slots.length ? "Fully booked. Try another day." : "A little rest for the courts today."}><p>{slots.length ? "The good news: there are more games ahead." : "We’re closed on this day. Let’s find you another time."}</p><Button onClick={nextOpenDay} disabled={lookingAhead || date >= lastDate}>{lookingAhead ? "Finding your next game…" : "Find the next open day"}</Button></EmptyState> : data && <><div className="court-tabs segmented" role="group" aria-label="Choose a court">{data.courts.map((court) => <button key={court.id} className={cn(court.id === courtId && "active")} aria-pressed={court.id === courtId} onClick={() => { setCourtId(court.id); setStartTime(""); }}>{court.name}</button>)}</div><div className="time-grid" style={{ "--courts": data.courts.length } as React.CSSProperties}>{data.courts.map((court) => <div key={court.id} className={cn("court-column", court.id === courtId && "mobile-selected")}><h3><CalendarDays size={14} />{court.name}</h3>{displayedSlots.map((slot) => { const state = slotState(court.id, slot, data.unavailable, clock || new Date(data.fetchedAt)); const selected = startTime === slot && courtId === court.id; return <div key={slot} className="slot-group"><button className={cn("slot full-width", state, selected && "selected", highlightAlternatives && state === "available" && "alternative")} disabled={state !== "available"} aria-pressed={selected} aria-label={`${court.name}, ${formatTime(slot)}, ${state === "past" ? "too soon to book" : state}`} onClick={() => { setCourtId(court.id); setStartTime(slot); setDuration(1); setHighlightAlternatives(false); }}><strong>{formatTime(slot)}</strong><span>{selected ? <><Check size={12} />Selected</> : state === "available" ? "Available" : state === "booked" ? "Booked" : state === "blocked" ? <><LockKeyhole size={11} />Closed</> : "Too soon"}</span></button>{selected && <div className="duration-choices" role="group" aria-label="How long would you like to play?">{bookingRules.durations.map((hours) => { const hint = durationProblem(data, court.id, slot, hours, clock || new Date(data.fetchedAt)); return <button key={hours} className={cn("duration-chip", duration === hours && "active")} title={hint || `${hours} hours`} aria-label={`${hours} ${hours === 1 ? "hour" : "hours"}${hint ? `: ${hint}` : ""}`} aria-pressed={duration === hours} disabled={Boolean(hint)} onClick={() => setDuration(hours)}>{hours} {hours === 1 ? "hr" : "hrs"}</button>; })}</div>}</div>; })}</div>)}</div>{displayedSlots.length === 0 && <p className="muted small">No times in this part of the day. Choose another filter.</p>}<p className="muted small" aria-live="polite" style={{ fontSize: 10, marginTop: 18 }}>Court times refresh every 30 seconds. {data.unavailable.length ? "Taken times are shown without player details." : "Pick an open time to get started."}</p></>}
      </section></div><BookingAside /></div><div className="sticky-summary"><div className="sticky-summary-inner"><div><strong>{startTime && selectedCourt ? `${selectedCourt.name} · ${formatTime(startTime)}` : "A good game is a few taps away."}</strong><p>{startTime ? `${formatDate(startTime, "EEE, d MMM")} · ${duration} ${duration === 1 ? "hour" : "hours"} · Pay at the court` : "Choose a day and an available time."}</p></div><Button disabled={!startTime || !data || Boolean(problem) || loading} onClick={() => setReview(true)}>Review booking <ArrowRight size={15} /></Button></div></div><Dialog open={review} onOpenChange={(open) => { if (!pending) setReview(open); }}><DialogContent><DialogTitle>One more thing. Then, game on.</DialogTitle><DialogDescription className="dialog-description">Check your details and make it official.</DialogDescription>{startTime && selectedCourt && <SelectionSummary court={selectedCourt.name} start={startTime} duration={duration} />}<div className="review-note"><ShieldCheck size={18} /><div><strong>Pay at the court.</strong><br />No online payment needed. Free cancellation until 12 hours before your game.</div></div><div className="field"><label htmlFor="booking-notes">Anything we should know? <span className="muted">(optional)</span></label><Textarea id="booking-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="4 players, a couple of us are beginners…" /></div>{problem && <Message error>{problem}. Please choose another time.</Message>}{error && <Message error>{error}</Message>}<Button className="full-width" disabled={pending || Boolean(problem) || !data || !startTime} onClick={submit}>{pending ? "Saving your court…" : signedIn ? "Confirm booking" : "Log in to confirm"}<ArrowRight size={16} /></Button></DialogContent></Dialog></div>;
}
