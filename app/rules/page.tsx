import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHeading } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { venue, bookingRules } from "@/lib/config";
export const metadata: Metadata = { title: "Court rules" };
export default function RulesPage() { return <div className="page-width narrow"><PageHeading eyebrow="A GOOD GAME STARTS HERE" title="A few simple court rules.">A little consideration goes a long way. Let’s keep every game safe, friendly, and fun.</PageHeading>{[
  { title: "Make time for your game", content: <p>Reserve {bookingRules.durations.join(", ")} hours, starting on the hour. You can book the next {bookingRules.advanceDays} days, at least {bookingRules.minimumLeadHours} hour before play. Each player can have up to {bookingRules.maxUpcomingBookings} upcoming bookings. Opening hours are shown for each day when you book.</p> },
  { title: "Pay when you play", content: <p>Payment is collected at the venue by cash, card reader, or GCash. There’s no online payment. Contact the venue for current court rates.</p> },
  { title: "Plans change. Let us know.", content: <p>Cancel free from My Bookings until {bookingRules.freeCancellationHours} hours before your start time. Inside that window, online cancellation is closed. {venue.phone ? <a className="inline-link" href={`tel:${venue.phone}`}>Call {venue.phone}</a> : <a className="inline-link" href={venue.mapUrl} target="_blank" rel="noreferrer">Contact the venue</a>} if you need help. A cancelled booking immediately releases the time for another player.</p> },
  { title: "Come ready to play", content: <ul><li>Arrive 10 minutes early and finish on time for the next group.</li><li>Wear non-marking court shoes. Bring your paddle, pickleballs, water, and a towel.</li><li>Check with the venue before your visit if you need to borrow equipment.</li><li>Warm up, stay hydrated, and take breaks when you need them.</li></ul> },
  { title: "Share the good energy", content: <ul><li>Respect players, staff, and the court. Everyone is welcome.</li><li>Wait for a pause before crossing another court.</li><li>Keep food, glass, and anything that could damage the surface off the court.</li><li>Pick up your belongings and leave the court ready for the next game.</li></ul> },
].map((rule, i) => <section className="rules-section" key={rule.title}><span>0{i + 1}</span><div><h2>{rule.title}</h2>{rule.content}</div></section>)}<div className="button-row" style={{ marginTop: 30 }}><Button asChild><Link href="/book">Book a court <ArrowUpRight size={17} /></Link></Button></div></div>; }
