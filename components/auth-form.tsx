"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ArrowRight, Check, Eye, EyeOff, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { normalizePhone, phoneSchema, safeNext } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Message } from "@/components/ui/feedback";

type Mode = "login" | "signup" | "forgot" | "reset";
type Fields = { full_name: string; phone: string; email: string; password: string; confirm: string; agree: boolean };
const emailSchema = z.email("Enter a valid email address.");
const labels = { login: ["WELCOME BACK", "Back for another game?", "Log in and make a little time for play.", "Log in"], signup: ["YOU BELONG ON COURT", "Your next game starts here.", "A few details, and you’re part of the club.", "Create account"], forgot: ["LET’S GET YOU BACK IN", "Forgot your password?", "Enter your email and we’ll send a reset link.", "Send reset link"], reset: ["A FRESH START", "Set a new password.", "Choose a password with at least 8 characters.", "Save new password"] };

export function AuthForm({ mode }: { mode: Mode }) {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [googleBusy, setGoogleBusy] = useState(false);
  const { register, handleSubmit, setError: setFieldError, control, formState: { errors, isSubmitting } } = useForm<Fields>({ defaultValues: { full_name: "", phone: "", email: "", password: "", confirm: "", agree: false } });
  const password = useWatch({ control, name: "password" }) || "";
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown((n) => n - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const callback = (destination = next) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`;

  async function submit(values: Fields) {
    setError("");
    if (mode !== "reset" && !emailSchema.safeParse(values.email.trim()).success) { setFieldError("email", { message: "Enter a valid email address." }); return; }
    if (mode === "signup") {
      if (values.full_name.trim().length < 2) { setFieldError("full_name", { message: "Enter your full name." }); return; }
      const phone = phoneSchema.safeParse(values.phone);
      if (!phone.success) { setFieldError("phone", { message: phone.error.issues[0].message }); return; }
      if (!values.agree) { setFieldError("agree", { message: "Please agree to the court rules." }); return; }
    }
    if (mode !== "forgot" && values.password.length < (mode === "login" ? 1 : 8)) { setFieldError("password", { message: mode === "login" ? "Enter your password." : "Use at least 8 characters." }); return; }
    if (mode === "reset" && values.password !== values.confirm) { setFieldError("confirm", { message: "Your passwords don’t match." }); return; }
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error: signupError } = await supabase.auth.signUp({ email: values.email.trim(), password: values.password, options: { data: { full_name: values.full_name.trim(), phone: normalizePhone(values.phone) }, emailRedirectTo: callback() } });
        if (signupError) { setError(signupError.status === 429 ? "A few too many tries. Please wait a moment and try again." : "We couldn’t create your account. Try again, or log in if you already have one."); return; }
        if (data.session) { router.push(next); router.refresh(); return; }
        setSentEmail(values.email.trim()); setSent(true); setCooldown(30);
      } else if (mode === "login") {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
        if (loginError) { setError("That email or password isn’t right. Try again or reset your password."); return; }
        const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
        router.push(params.has("next") ? next : profile?.is_admin ? "/admin" : "/book"); router.refresh();
      } else if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(values.email.trim(), { redirectTo: callback("/reset-password") });
        setSent(true);
      } else {
        const { error: resetError } = await supabase.auth.updateUser({ password: values.password });
        if (resetError) { setError("This reset link may have expired. Request a new link and try again."); return; }
        router.push("/account?password=updated"); router.refresh();
      }
    } catch { if (mode === "forgot") setSent(true); else setError("We couldn’t connect. Your details are still here—please try again."); }
  }
  async function google() {
    setGoogleBusy(true); setError("");
    try { const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } }); if (error) { setError("Google sign-in is unavailable. Please use email instead."); setGoogleBusy(false); } }
    catch { setError("We couldn’t connect to Google. Please try email instead."); setGoogleBusy(false); }
  }
  async function resend() {
    if (cooldown) return;
    setCooldown(30); setError("");
    try { const { error } = await createClient().auth.resend({ type: "signup", email: sentEmail, options: { emailRedirectTo: callback() } }); if (error) setError("We couldn’t resend yet. Please wait a moment and try again."); }
    catch { setError("We couldn’t connect. Please try again."); }
  }
  const [eyebrow, title, description, submitLabel] = labels[mode];
  if (sent) return <div className="auth-form"><div className="success-symbol" style={{ marginLeft: 0 }}><Mail size={27} /></div><p className="eyebrow">ONE LITTLE CHECK</p><h1>Check your email.</h1><p>{mode === "signup" ? <>We sent a link to <strong>{sentEmail}</strong>. Tap it to activate your account. Your court selection will be waiting.</> : "If that email has an account, we sent a reset link. Check your inbox and spam folder."}</p>{error && <Message error>{error}</Message>}{mode === "signup" ? <><Button className="full-width" variant="outline" onClick={resend} disabled={cooldown > 0}>Resend email {cooldown > 0 && `in ${cooldown}s`}</Button><Button variant="ghost" className="full-width" onClick={() => { setSent(false); setError(""); }}>Use a different email</Button></> : <Button asChild className="full-width"><Link href="/login">Back to log in</Link></Button>}</div>;
  return <div className="auth-form"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p>{params.get("error") && <Message error>That link has expired or couldn’t be verified. Please try again.</Message>}{params.get("next") === "/book" && <Message>Your court selection is saved. Log in to finish booking.</Message>}{error && <Message error>{error}</Message>}<form onSubmit={handleSubmit(submit)} noValidate>
    {mode === "signup" && <><div className="field"><label htmlFor="full_name">Full name</label><Input id="full_name" autoComplete="name" maxLength={100} placeholder="Juan dela Cruz" aria-invalid={Boolean(errors.full_name)} aria-describedby="full-name-error" {...register("full_name")} /><FieldError id="full-name-error" message={errors.full_name?.message} /></div><div className="field"><label htmlFor="phone">Mobile number</label><Input id="phone" type="tel" autoComplete="tel" placeholder="0917 123 4567" aria-invalid={Boolean(errors.phone)} aria-describedby="phone-error" {...register("phone")} /><FieldError id="phone-error" message={errors.phone?.message} /></div></>}
    {mode !== "reset" && <div className="field"><label htmlFor="email">Email address</label><Input id="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" aria-invalid={Boolean(errors.email)} aria-describedby="email-error" {...register("email")} /><FieldError id="email-error" message={errors.email?.message} /></div>}
    {mode !== "forgot" && <div className="field"><label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</label><div className="password-wrap"><Input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} aria-invalid={Boolean(errors.password)} aria-describedby="password-error password-hint" {...register("password")} /><button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><FieldError id="password-error" message={errors.password?.message} /><p id="password-hint" className="field-hint">{mode === "login" ? <Link href="/forgot-password" className="inline-link">Forgot password?</Link> : password.length === 0 ? "At least 8 characters. A longer password is stronger." : password.length < 8 ? `${8 - password.length} more characters needed` : password.length >= 12 && /[\d\W]/.test(password) ? "Strong password. You’re good to go." : "Good start. Add more words or numbers for strength."}</p></div>}
    {mode === "reset" && <div className="field"><label htmlFor="confirm">Confirm new password</label><Input id="confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" aria-invalid={Boolean(errors.confirm)} {...register("confirm")} /><FieldError message={errors.confirm?.message} /></div>}
    {mode === "signup" && <><label className="checkbox-line"><input type="checkbox" {...register("agree")} /><span>I agree to the <Link href="/rules" target="_blank" className="inline-link">court rules</Link>.</span></label><FieldError message={errors.agree?.message} /></>}
    <Button type="submit" className="full-width" disabled={isSubmitting}>{isSubmitting ? "One moment…" : submitLabel}<ArrowRight size={16} /></Button>
  </form>{(mode === "login" || mode === "signup") && process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && <><div className="auth-divider">OR KEEP IT SIMPLE</div><Button variant="outline" className="full-width" onClick={google} disabled={googleBusy}><GoogleIcon />{googleBusy ? "Connecting…" : "Continue with Google"}</Button></>}{mode === "login" ? <p className="auth-form-footer">New around here? <Link className="inline-link" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></p> : mode === "signup" ? <p className="auth-form-footer">Already part of the club? <Link className="inline-link" href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link></p> : <p className="auth-form-footer"><Link className="inline-link" href="/login">Back to log in</Link></p>}</div>;
}
function FieldError({ id, message }: { id?: string; message?: string }) { return message ? <p id={id} role="alert" className="field-error">{message}</p> : null; }
function GoogleIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.71-.06-1.39-.18-2.05H12v3.88h5.92a5.1 5.1 0 0 1-2.2 3.33v2.77h3.57c2.09-1.92 3.27-4.74 3.27-7.93Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.82l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.87 0-5.3-1.94-6.17-4.55H2.15v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.83 13.92a6.6 6.6 0 0 1 0-3.84V7.24H2.15a11 11 0 0 0 0 9.52l3.68-2.84Z"/><path fill="#EA4335" d="M12 5.53c1.62 0 3.07.56 4.21 1.65l3.16-3.16A10.6 10.6 0 0 0 12 1a11 11 0 0 0-9.85 6.24l3.68 2.84C6.7 7.47 9.13 5.53 12 5.53Z"/></svg>; }

export function AuthStory() { return <aside className="auth-story"><p className="eyebrow">THE STARAPPLE WAY</p><h2>A little play.<br />A lot of<br /><em>good energy.</em></h2><p>Your people. Your pace. Your favorite part of the day. We’ll meet you at the net.</p><div className="auth-points"><span><Check size={15} />Live court availability</span><span><Check size={15} />Book now, pay at the venue</span><span><Check size={15} />Free cancellation up to 12 hours ahead</span></div></aside>; }
