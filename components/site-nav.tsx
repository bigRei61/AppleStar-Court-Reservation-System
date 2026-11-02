"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, CalendarDays, House, LayoutDashboard, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/brand";
import { useAuthSession } from "@/components/auth-session";

export function SiteNav({ userId, admin = false }: { userId?: string; admin?: boolean }) {
  const path = usePathname();
  const session = useAuthSession();
  const signedIn = session.ready ? session.signedIn : Boolean(userId);
  const verifiedAdmin = admin && (!session.ready || session.userId === userId);
  return <NavContent path={path} signedIn={signedIn} admin={verifiedAdmin} />;
}
export function SiteNavFallback() { const session = useAuthSession(); return <NavContent path="" signedIn={session.signedIn} admin={false} />; }
function NavContent({ path, signedIn, admin }: { path: string; signedIn: boolean; admin: boolean }) {
  const links = [{ href: "/", label: "Home", icon: House }, { href: "/book", label: "Book a court", icon: CalendarDays }, { href: "/bookings", label: "My bookings", icon: CalendarDays }, { href: "/rules", label: "Court rules", icon: LayoutDashboard }];
  const active = (href: string) => path === href || (href !== "/" && path.startsWith(`${href}/`));
  return <><header className="site-header"><div className="nav-inner"><Brand /><nav className="desktop-nav" aria-label="Main navigation">{links.map((link) => <Link key={link.href} href={link.href} prefetch={link.href === "/bookings" ? false : undefined} className={cn(active(link.href) && "active")} aria-current={active(link.href) ? "page" : undefined}>{link.label}</Link>)}{admin && <Link href="/admin" prefetch={false} className={cn(active("/admin") && "active")}>Admin</Link>}</nav><Link href={signedIn ? "/account" : "/login"} prefetch={false} className="nav-account"><UserRound size={17} /><span>{signedIn ? "My account" : "Log in"}</span><ArrowUpRight size={15} /></Link></div></header><nav className="mobile-tabs" aria-label="Mobile navigation">{[{ href: "/", label: "Home", icon: House }, { href: "/book", label: "Book", icon: CalendarDays }, { href: "/bookings", label: "My bookings", icon: LayoutDashboard }, { href: "/account", label: "Account", icon: UserRound }, ...(admin ? [{ href: "/admin", label: "Admin", icon: LayoutDashboard }] : [])].map(({ href, label, icon: Icon }) => <Link key={href} href={href} prefetch={["/bookings", "/account", "/admin"].includes(href) ? false : undefined} className={cn(active(href) && "active")} aria-current={active(href) ? "page" : undefined}><Icon size={21} strokeWidth={1.7} /><span>{label}</span></Link>)}</nav></>;
}
