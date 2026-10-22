import type { BookingStatus } from "@/lib/types";
export function StatusBadge({ status }: { status: BookingStatus }) { return <span className={`status-badge status-${status}`}>{status === "no_show" ? "No-show" : status.charAt(0).toUpperCase() + status.slice(1)}</span>; }
