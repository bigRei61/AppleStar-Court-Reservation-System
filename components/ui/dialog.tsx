"use client";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Primitive.Portal><Primitive.Overlay className="dialog-overlay" /><Primitive.Content className={cn("dialog-content", className)}>{children}<Primitive.Close className="dialog-x" aria-label="Close"><X size={20} /></Primitive.Close></Primitive.Content></Primitive.Portal>;
}
