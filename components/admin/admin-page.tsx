import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { getAdminData } from "@/lib/data";
import { PageSkeleton } from "@/components/ui/feedback";
import { AdminDashboard, type AdminMode } from "@/components/admin/admin-dashboard";
async function Content({ mode }: { mode: AdminMode }) { await requireAdmin(); const data = await getAdminData(); return <AdminDashboard {...data} mode={mode} now={new Date().toISOString()} />; }
export function AdminPage({ mode }: { mode: AdminMode }) { return <Suspense fallback={<PageSkeleton />}><Content mode={mode} /></Suspense>; }
