import { Suspense } from "react";
import { requireViewer } from "@/lib/auth";
import { PageHeading, PageSkeleton } from "@/components/ui/feedback";
import { AccountForm } from "@/components/account-form";
export const metadata = { title: "My account" };
async function Content() { const viewer = await requireViewer("/account"); return <div className="page-width"><PageHeading eyebrow="YOUR CORNER OF THE CLUB" title="My account">Keep your details up to date. We’ll take care of the court.</PageHeading><AccountForm profile={viewer.profile} email={viewer.user.email || ""} /></div>; }
export default function Account() { return <Suspense fallback={<PageSkeleton />}><Content /></Suspense>; }
