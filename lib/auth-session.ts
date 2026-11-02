import type { SupabaseClient } from "@supabase/supabase-js";

// Keep SDK callbacks synchronous: another Auth call inside them can deadlock.
export function observeAuthSession(
  client: SupabaseClient,
  onSession: (userId: string | null) => void,
  onIdentityChange: () => void,
) {
  let previous: string | null | undefined;
  let refresh: ReturnType<typeof setTimeout> | undefined;
  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user.id ?? null;
    onSession(userId);
    if (previous !== undefined && previous !== userId) {
      clearTimeout(refresh);
      refresh = setTimeout(onIdentityChange, 0);
    }
    previous = userId;
  });
  return () => {
    clearTimeout(refresh);
    subscription.unsubscribe();
  };
}
