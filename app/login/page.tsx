import { Suspense } from "react";
import { AuthForm, AuthStory } from "@/components/auth-form";
export const metadata = { title: "Log in" };
export default function Login() { return <div className="auth-page"><AuthStory /><div className="auth-form-wrap"><Suspense fallback={<p>Getting your account ready…</p>}><AuthForm mode="login" /></Suspense></div></div>; }
