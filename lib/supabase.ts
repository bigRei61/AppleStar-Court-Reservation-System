import { createBrowserClient } from "@supabase/ssr";
import { publicSupabaseConfig } from "@/lib/supabase-config";

export function createClient() {
  const { url, key } = publicSupabaseConfig();
  return createBrowserClient(url, key);
}
