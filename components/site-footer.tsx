import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";
export function SiteFooter() { return <footer className="site-footer"><div className="footer-inner"><div><Brand /><p>A good day starts on the court.</p></div><div className="footer-links"><Link href="/rules">Court rules <ArrowUpRight size={14} /></Link><Link href="/book">Find your next game <ArrowUpRight size={14} /></Link></div><span className="footer-location">PLAY TOGETHER. FEEL AT HOME.<br /><small>All court times are in Manila time (UTC+8).</small></span></div></footer>; }
