import { bookingRules, durationLabel } from "@/lib/config";
export function bookingError(error: { code?: string; message?: string }) {
  const known: Record<string, string> = {
    BOOKING_LIMIT: `You have ${bookingRules.maxUpcomingBookings} upcoming bookings. Cancel one or wait until one has passed.`,
    BOOKING_LEAD: `Choose a time at least ${bookingRules.minimumLeadHours} hour(s) from now.`,
    BOOKING_DATE: `Choose a day in the next ${bookingRules.advanceDays} days.`,
    BOOKING_DURATION: `Choose ${durationLabel} hours, starting on the hour.`,
    BOOKING_HOURS: "That time is outside opening hours.",
    COURT_INACTIVE: "This court is no longer available. Please pick another court.",
    BOOKING_BLOCKED: "The court is closed at that time. Please choose another slot.",
    BOOKING_LIMIT_CANCEL: "It’s too late to cancel online. Please contact the court.",
    BLOCK_CONFLICT: "This block overlaps a booking. Cancel or contact the affected players first.",
    PROFILE_REQUIRED: "Add your full name and Philippine mobile number in My Account before booking.",
  };
  if (error.code === "23P01") return { code: "SLOT_TAKEN", error: "Someone just booked that time. Please pick another slot." };
  const key = Object.keys(known).find((value) => error.message === value);
  return { code: key || "SAVE_FAILED", error: key ? known[key] : "We couldn’t save that change. Please try again." };
}
