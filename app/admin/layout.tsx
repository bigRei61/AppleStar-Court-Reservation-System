import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageSkeleton } from "@/components/ui/feedback";
async function Guard({ children }: { children: React.ReactNode }) { await requireAdmin(); return <div className="page-width"><p className="eyebrow">STARAPPLE · VENUE DESK</p><AdminNav />{children}</div>; }
export default function AdminLayout({ children }: { children: React.ReactNode }) { return <Suspense fallback={<PageSkeleton />}><Guard>{children}</Guard></Suspense>; }
