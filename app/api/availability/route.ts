import { getAvailability } from "@/lib/data";
import { isDateKey, lastBookingDate, manilaDate } from "@/lib/time";
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") || manilaDate();
  if (!isDateKey(date) || date < manilaDate() || date > lastBookingDate()) return Response.json({ error: "Choose a day in the next 14 days." }, { status: 400 });
  try { return Response.json(await getAvailability(date), { headers: { "Cache-Control": "no-store, private" } }); }
  catch { return Response.json({ error: "We couldn’t load the court times. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
