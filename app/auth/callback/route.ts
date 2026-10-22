import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { safeNext } from "@/lib/validation";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") === "/reset-password" || type === "recovery" ? "/reset-password" : safeNext(url.searchParams.get("next"));
  const client = await createClient();
  let success = false;
  if (code) { const { error } = await client.auth.exchangeCodeForSession(code); success = !error; }
  else if (tokenHash && type && ["signup", "recovery", "email_change", "email"].includes(type)) { const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType }); success = !error; }
  const response = NextResponse.redirect(new URL(success ? next : "/login?error=confirmation", url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
