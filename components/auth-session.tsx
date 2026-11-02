"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/supabase-config";
import { observeAuthSession } from "@/lib/auth-session";

// undefined means the browser is still reading its session cookies.
const AuthSessionContext = createContext<string | null | undefined>(undefined);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null | undefined>(() => isSupabaseConfigured() ? undefined : null);
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    return observeAuthSession(createClient(), setUserId, () => router.refresh());
  }, [router]);

  return <AuthSessionContext.Provider value={userId}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const userId = useContext(AuthSessionContext);
  return { userId, ready: userId !== undefined, signedIn: Boolean(userId) };
}
