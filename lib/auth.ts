import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase-config";
import type { Profile } from "@/lib/types";
export const getViewer = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase.from("profiles").select("id,full_name,phone,is_admin").eq("id", user.id).single();
  return { user, profile: profile as Profile | null };
});
export async function requireViewer(path = "/bookings") {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(path)}`);
  return viewer;
}
export async function requireAdmin() {
  const viewer = await requireViewer("/admin");
  if (!viewer.profile?.is_admin) redirect("/bookings");
  return viewer;
}
