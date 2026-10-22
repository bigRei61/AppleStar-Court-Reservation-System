"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock3, House, LayoutList, LockKeyhole, Square, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
export function AdminNav() { const path = usePathname(); return <nav className="admin-nav" aria-label="Venue management">{[{ href: "/admin", label: "Today", icon: House }, { href: "/admin/calendar", label: "Calendar", icon: CalendarDays }, { href: "/admin/bookings", label: "All bookings", icon: LayoutList }, { href: "/admin/blocks", label: "Block times", icon: LockKeyhole }, { href: "/admin/courts", label: "Courts", icon: Square }, { href: "/admin/hours", label: "Opening hours", icon: Clock3 }, { href: "/admin/players", label: "Players", icon: UsersRound }].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn(path === href && "active")} aria-current={path === href ? "page" : undefined}><Icon size={14} />{label}</Link>)}</nav>; }
