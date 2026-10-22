-- Supabase grants new functions to anon/authenticated by default.
-- Trigger functions are invoked by their triggers, never directly by clients.
revoke all on function public.starapple_guard_booking() from public, anon, authenticated;
revoke all on function public.starapple_guard_block() from public, anon, authenticated;
revoke all on function public.starapple_lock_schedule() from public, anon, authenticated;
