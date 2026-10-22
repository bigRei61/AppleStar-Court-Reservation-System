import { Suspense } from "react";
import { AuthForm, AuthStory } from "@/components/auth-form";
export const metadata = { title: "Create account" };
export default function Signup() { return <div className="auth-page"><AuthStory /><div className="auth-form-wrap"><Suspense fallback={<p>Getting your account ready…</p>}><AuthForm mode="signup" /></Suspense></div></div>; }
