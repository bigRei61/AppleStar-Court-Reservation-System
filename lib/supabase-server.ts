import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicSupabaseConfig } from "@/lib/supabase-config";

export async function createClient() {
  // Auth initialization reads the clock before it reads cookies.
  // Keep that third-party work out of Next's static prerender.
  await connection();
  const cookieStore = await cookies();
  const { url, key } = publicSupabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components are read-only; proxy.ts persists refreshed cookies. */ }
      },
    },
  });
}
