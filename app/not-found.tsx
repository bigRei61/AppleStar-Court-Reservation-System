import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() { return <div className="page-width empty-state"><p className="eyebrow">OUT OF BOUNDS</p><h1>This page left the court.</h1><p>Let’s get you back to your next game.</p><Button asChild><Link href="/book">Book a court</Link></Button></div>; }
