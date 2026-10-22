"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { profileSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";
export async function saveProfile(input: unknown): Promise<ActionResult> {
  const viewer = await requireViewer("/account");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const client = await createClient();
  const { error } = await client.from("profiles").update(parsed.data).eq("id", viewer.user.id);
  if (error) return { ok: false, error: "We couldn’t save your details. Please try again." };
  revalidatePath("/account"); return { ok: true, data: undefined };
}
export async function changePassword(password: string): Promise<ActionResult> {
  await requireViewer("/account");
  if (typeof password !== "string" || password.length < 8) return { ok: false, error: "Use a password with at least 8 characters." };
  const client = await createClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) return { ok: false, error: "We couldn’t change your password. Try signing in again, or use Forgot password." };
  return { ok: true, data: undefined };
}
export async function signOut() { const client = await createClient(); await client.auth.signOut(); revalidatePath("/", "layout"); redirect("/login"); }
