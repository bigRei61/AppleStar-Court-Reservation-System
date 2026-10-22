import { createClient } from "@/lib/supabase-server";
import { getViewer } from "@/lib/auth";
import { bookingCalendar } from "@/lib/calendar";
import { z } from "zod";
import type { Booking } from "@/lib/types";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer(); if (!viewer) return Response.json({ error: "Please log in." }, { status: 401 });
  const { id } = await params; if (!z.uuid().safeParse(id).success) return new Response("Booking not found", { status: 404 });
  const client = await createClient(); let query = client.from("bookings").select("*").eq("id", id); if (!viewer.profile?.is_admin) query = query.eq("user_id", viewer.user.id);
  const { data, error } = await query.single(); if (error || !data) return new Response("Booking not found", { status: 404 });
  const { data: court } = await client.from("courts").select("name").eq("id", data.court_id).single();
  return new Response(bookingCalendar(data as Booking, court?.name || "Your court"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="starapple-${id.slice(0,8)}.ics"`, "Cache-Control": "private, no-store" } });
}
