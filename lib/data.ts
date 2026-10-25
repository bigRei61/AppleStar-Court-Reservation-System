import "server-only";
import { createClient } from "@/lib/supabase-server";
import { createPublicClient } from "@/lib/supabase-public";
import { dayRange } from "@/lib/time";
import type { AdminData, Availability, Booking, Court, OperatingHours } from "@/lib/types";
export async function getAvailability(date: string): Promise<Availability> {
  const client = createPublicClient();
  const signal = AbortSignal.timeout(5000);
  const { from, to } = dayRange(date);
  const [courts, hours, unavailable] = await Promise.all([
    client.from("courts").select("id,name,is_active").eq("is_active", true).order("name").abortSignal(signal),
    client.from("operating_hours").select("day_of_week,open_time,close_time").order("day_of_week").abortSignal(signal),
    client.rpc("get_unavailable_slots", { from_ts: from, to_ts: to }).abortSignal(signal),
  ]);
  if (courts.error || hours.error || unavailable.error) {
    console.error("Availability read failed", { courts: courts.error?.message, hours: hours.error?.message, unavailable: unavailable.error?.message });
    throw new Error("We couldn’t load the court times. Please try again.");
  }
  return { courts: courts.data as Court[], hours: hours.data as OperatingHours[], unavailable: unavailable.data || [], date, fetchedAt: new Date().toISOString() };
}
export async function getPlayerBookings(userId: string) {
  const client = await createClient();
  const [bookings, courts] = await Promise.all([client.from("bookings").select("*").eq("user_id", userId).order("start_time", { ascending: false }), client.from("courts").select("id,name,is_active").order("name")]);
  if (bookings.error || courts.error) throw new Error("We couldn’t load your bookings. Please try again.");
  return { bookings: bookings.data as Booking[], courts: courts.data as Court[] };
}
export async function getAdminData() {
  const client = await createClient();
  async function allRows<T>(table: string, columns: string, order: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from(table).select(columns).order(order).order("id").range(offset, offset + 999);
      if (error) throw new Error("We couldn’t load the venue dashboard. Please try again.");
      rows.push(...data as unknown as T[]); if (data.length < 1000) return rows;
    }
  }
  const [courts, hours, bookings, blocks, profiles] = await Promise.all([
    allRows<AdminData["courts"][number]>("courts", "*", "name"), allRows<AdminData["hours"][number]>("operating_hours", "*", "day_of_week"),
    allRows<AdminData["bookings"][number]>("bookings", "*", "start_time"), allRows<AdminData["blocks"][number]>("blocked_slots", "*", "start_time"),
    allRows<AdminData["profiles"][number]>("profiles", "id,full_name,phone,is_admin,created_at", "full_name"),
  ]);
  return { courts, hours, bookings, blocks, profiles };
}
