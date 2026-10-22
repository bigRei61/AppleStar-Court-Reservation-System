import { Suspense } from "react";
import { BookingFlow } from "@/components/booking/booking-flow";
import { PageSkeleton } from "@/components/ui/feedback";
export const metadata = { title: "Book a court" };
export default function BookPage() { return <Suspense fallback={<PageSkeleton />}><BookingFlow /></Suspense>; }
