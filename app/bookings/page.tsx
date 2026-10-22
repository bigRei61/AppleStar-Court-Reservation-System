import { Suspense } from "react";
import { requireViewer } from "@/lib/auth";
import { getPlayerBookings } from "@/lib/data";
import { PageHeading, PageSkeleton } from "@/components/ui/feedback";
import { PlayerBookings } from "@/components/booking/player-bookings";
export const metadata = { title: "My bookings" };
async function Content() { const viewer = await requireViewer("/bookings"); const data = await getPlayerBookings(viewer.user.id); return <div className="page-width"><PageHeading eyebrow="GOOD TIMES, ALL IN ONE PLACE" title="My bookings">Your upcoming games and the ones worth coming back for.</PageHeading><PlayerBookings {...data} now={new Date().toISOString()} /></div>; }
export default function BookingsPage() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
