"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Message } from "@/components/ui/feedback";
import type { ActionResult } from "@/lib/types";
export function useAdminMutation() {
  const [pending, start] = useTransition(); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const router = useRouter();
  function run(action: () => Promise<ActionResult<unknown>>, success = "Saved. You’re all set.", onSuccess?: () => void) { start(async () => { setError(""); setMessage(""); try { const result = await action(); if (!result.ok) setError(result.error); else { setMessage(result.warning || success); onSuccess?.(); router.refresh(); } } catch { setError("We couldn’t connect. Please try again."); } }); }
  return { pending, error, message, run };
}
export function MutationFeedback({ error, message }: { error: string; message: string }) { return <>{error && <Message error>{error}</Message>}{message && <Message>{message}</Message>}</>; }
