"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="page-width empty-state"><h1>Let’s try that again.</h1><p>We couldn’t load this page. Your bookings are safe.</p><Button onClick={reset}>Try again</Button></div>; }
