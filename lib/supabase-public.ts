import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "@/lib/supabase-config";

// Public schedules never depend on a player's cookies or token refresh.
export function createPublicClient() {
  const { url, key } = publicSupabaseConfig();
  return createClient(url, key, {
    // A null session token uses the public API key and never initializes Auth.
    accessToken: async () => null,
  });
}
