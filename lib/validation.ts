import { z } from "zod";
import { bookingRules } from "@/lib/config";
export function normalizePhone(value: string) { const digits = value.replace(/[\s()\-]/g, ""); return digits.startsWith("09") ? `+63${digits.slice(1)}` : digits.startsWith("639") ? `+${digits}` : digits; }
export const phoneSchema = z.string().transform(normalizePhone).pipe(z.string().regex(/^\+639\d{9}$/, "Enter a Philippine mobile number, like 0917 123 4567."));
export const profileSchema = z.object({ full_name: z.string().trim().min(2, "Enter your full name.").max(100), phone: phoneSchema });
export const bookingSchema = z.object({ courtId: z.uuid(), startTime: z.iso.datetime(), duration: z.number().int().refine((value) => bookingRules.durations.includes(value), "Choose an available duration."), notes: z.string().trim().max(500, "Keep notes under 500 characters.").default("") });
export function safeNext(value: string | null | undefined, fallback = "/book") { return value && value.startsWith("/") && !value.startsWith("//") && !/[\\\x00-\x20]/.test(value) && !value.startsWith("/auth/") && !/^\/(login|signup|forgot-password|reset-password)([/?#]|$)/.test(value) ? value : fallback; }
