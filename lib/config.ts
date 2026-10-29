import { resolveSiteUrl } from "@/lib/site-url";

// Run npm run db:prepare after editing this block, then review/apply its SQL.
export const bookingRules = /* rules:start */ {
  "slotMinutes": 60,
  "durations": [1, 2, 3],
  "advanceDays": 14,
  "minimumLeadHours": 1,
  "maxUpcomingBookings": 3,
  "freeCancellationHours": 12
} /* rules:end */;
export const durationLabel = bookingRules.durations.join(", ").replace(/,([^,]*)$/, " or$1");

export const venue = {
  name: process.env.NEXT_PUBLIC_COURT_NAME || "StarApple Pickleball Venue",
  shortName: "STARAPPLE",
  city: "Philippines",
  address: process.env.NEXT_PUBLIC_COURT_ADDRESS || "Find us at our pinned location",
  mapUrl: "https://maps.apple.com/place?coordinate=9.604619,124.016353&name=StarApple%20Pickleball%20Venue&map=explore",
  phone: process.env.NEXT_PUBLIC_COURT_PHONE || "+639175884377",
  email: process.env.COURT_NOTIFICATION_EMAIL || "",
  timeZone: "Asia/Manila",
};
export const siteUrl = resolveSiteUrl({
  configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
  productionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  platformUrl: process.env.URL,
  production: process.env.NODE_ENV === "production",
});
