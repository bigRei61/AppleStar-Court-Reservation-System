import { Suspense } from "react";
import { AuthForm, AuthStory } from "@/components/auth-form";
export const metadata = { title: "Reset password" };
export default function ResetPassword() { return <div className="auth-page"><AuthStory /><div className="auth-form-wrap"><Suspense><AuthForm mode="reset" /></Suspense></div></div>; }
