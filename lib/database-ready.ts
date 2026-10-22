import "server-only";
import { bookingRules } from "@/lib/config";
import { createClient } from "@/lib/supabase-server";
export const bookingSetupMessage = "We’re preparing online bookings. Please check back shortly or contact the venue.";
export async function bookingGuardsReady() {
  const client = await createClient(); const { data, error } = await client.rpc("starapple_booking_rules");
  if (error || !data?.ready || data.version !== 1) return false;
  return Object.entries(bookingRules).every(([key, value]) => JSON.stringify(data.rules?.[key]) === JSON.stringify(value));
}
