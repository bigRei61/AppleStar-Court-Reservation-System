import { Suspense } from "react";
import { AuthForm, AuthStory } from "@/components/auth-form";
export const metadata = { title: "Forgot password" };
export default function ForgotPassword() { return <div className="auth-page"><AuthStory /><div className="auth-form-wrap"><Suspense><AuthForm mode="forgot" /></Suspense></div></div>; }
