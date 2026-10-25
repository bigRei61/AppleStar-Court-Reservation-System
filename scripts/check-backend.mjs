import { createClient } from "@supabase/supabase-js";
import { bookingRules } from "../lib/config.ts";
try { process.loadEnvFile(".env.local"); } catch { /* Deployment environments supply variables directly. */ }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) { console.error("Missing public Supabase settings."); process.exit(1); }
const client = createClient(url, key, { auth: { persistSession: false } });
const authSettingsRequest = fetch(new URL("/auth/v1/settings", url), {
  headers: { apikey: key }, signal: AbortSignal.timeout(8000),
}).then((response) => response.ok ? response.json() : null).catch(() => null);
const checks = await Promise.all([
  client.from("courts").select("id,name,is_active"),
  client.from("operating_hours").select("day_of_week,open_time,close_time"),
  client.rpc("get_unavailable_slots", { from_ts: new Date().toISOString(), to_ts: new Date(Date.now() + 86400000).toISOString() }),
  client.rpc("starapple_booking_rules"),
]);
checks.slice(0, 3).forEach((result, index) => console.log(["Public courts", "Public opening hours", "Anonymous availability RPC"][index] + ": " + (result.error ? `FAILED (${result.error.code || "network"})` : `OK (${result.data?.length || 0} rows)`)));
const guards = checks[3];
const ready = !guards.error && guards.data?.ready && guards.data.version === 1 && Object.entries(bookingRules).every(([name, value]) => JSON.stringify(guards.data.rules?.[name]) === JSON.stringify(value));
console.log(`Booking guards: ${ready ? "READY" : "NOT READY — review/apply supabase/001_booking_guards.sql"}`);
const authSettings = await authSettingsRequest;
const immediateSignup = authSettings?.mailer_autoconfirm === true;
console.log(`Immediate signup: ${immediateSignup ? "READY — no email verification" : authSettings ? "NOT READY — turn Confirm email off in Supabase Authentication settings" : "UNKNOWN — could not read Supabase Authentication settings"}`);
console.log(`Booking email settings: ${process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL ? "configured (delivery not tested)" : "not configured"}`);
if (!ready || !immediateSignup) process.exitCode = 1;
if (checks.some((result) => result.error)) process.exitCode = 1;
