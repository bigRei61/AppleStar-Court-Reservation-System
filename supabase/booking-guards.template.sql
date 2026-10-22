-- Additive guards for the existing, user-supplied StarApple schema.
-- No tables or existing constraints/policies are replaced.
-- Generated from lib/config.ts with npm run db:prepare. Review before applying.
begin;

do $$
begin
  if to_regclass('public.bookings') is null or to_regclass('public.blocked_slots') is null
     or to_regclass('public.profiles') is null or to_regclass('public.courts') is null
     or to_regclass('public.operating_hours') is null then
    raise exception 'The original venue schema must be installed first. No changes were made.';
  end if;
  if not exists(select 1 from pg_constraint where conrelid = 'public.bookings'::regclass and conname = 'no_overlapping_bookings') then
    raise exception 'The expected no_overlapping_bookings constraint is missing. Review the original schema first.';
  end if;
end $$;

grant execute on function public.get_unavailable_slots(timestamptz, timestamptz) to anon, authenticated;
-- Trigger helpers need no direct client execution. is_admin is used by RLS.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.starapple_guard_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  local_start timestamp;
  local_end timestamp;
  opens time;
  closes time;
  active boolean;
  upcoming integer;
begin
  -- One short transaction lock serializes booking/block checks across courts,
  -- including a player's simultaneous bookings on different courts.
  perform pg_advisory_xact_lock(735198142);
  if new.notes is not null and length(new.notes) > 500 then raise exception 'BOOKING_NOTES'; end if;
  if TG_OP = 'UPDATE' then
    if (to_jsonb(new) - 'status' - 'notes') is distinct from (to_jsonb(old) - 'status' - 'notes') then
      raise exception 'BOOKING_IMMUTABLE';
    end if;
    if old.status = 'cancelled' and new.status <> 'cancelled' then raise exception 'BOOKING_IMMUTABLE'; end if;
    if not public.is_admin() then
      if old.status not in ('confirmed', 'paid') or new.status <> 'cancelled' then raise exception 'BOOKING_IMMUTABLE'; end if;
      if old.start_time < clock_timestamp() + make_interval(hours => __CANCEL_HOURS__) then raise exception 'BOOKING_LIMIT_CANCEL'; end if;
    end if;
    return new;
  end if;

  if new.status <> 'confirmed' then raise exception 'BOOKING_IMMUTABLE'; end if;
  if not exists(select 1 from public.profiles p where p.id = new.user_id and length(trim(p.full_name)) >= 2 and p.phone ~ '^\+639[0-9]{9}$') then
    raise exception 'PROFILE_REQUIRED';
  end if;
  local_start := new.start_time at time zone 'Asia/Manila';
  local_end := new.end_time at time zone 'Asia/Manila';
  if extract(minute from local_start) <> 0 or extract(second from local_start) <> 0
     or extract(epoch from (new.end_time - new.start_time)) / 3600 <> all(array[__DURATIONS__]) then
    raise exception 'BOOKING_DURATION';
  end if;
  if new.start_time < clock_timestamp() + make_interval(hours => __LEAD_HOURS__) then raise exception 'BOOKING_LEAD'; end if;
  if local_start::date < (clock_timestamp() at time zone 'Asia/Manila')::date
     or local_start::date >= (clock_timestamp() at time zone 'Asia/Manila')::date + __ADVANCE_DAYS__ then
    raise exception 'BOOKING_DATE';
  end if;
  select c.is_active into active from public.courts c where c.id = new.court_id;
  if not coalesce(active, false) then raise exception 'COURT_INACTIVE'; end if;
  select h.open_time, h.close_time into opens, closes from public.operating_hours h
    where h.day_of_week = extract(dow from local_start)::integer;
  if not found or local_start::time < opens or local_end::time > closes or local_end::date <> local_start::date then
    raise exception 'BOOKING_HOURS';
  end if;
  select count(*) into upcoming from public.bookings b
    where b.user_id = new.user_id and b.status <> 'cancelled' and b.end_time > clock_timestamp();
  if upcoming >= __MAX_UPCOMING__ then raise exception 'BOOKING_LIMIT'; end if;
  if exists(select 1 from public.blocked_slots s where s.court_id = new.court_id
    and s.start_time < new.end_time and s.end_time > new.start_time) then raise exception 'BOOKING_BLOCKED'; end if;
  return new;
end $$;
revoke all on function public.starapple_guard_booking() from public, anon, authenticated;
drop trigger if exists starapple_booking_guard on public.bookings;
create trigger starapple_booking_guard before insert or update on public.bookings
  for each row execute function public.starapple_guard_booking();

create or replace function public.starapple_guard_block()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(735198142);
  if TG_OP = 'DELETE' then return old; end if;
  if exists(select 1 from public.bookings b where b.court_id = new.court_id and b.status <> 'cancelled'
    and b.start_time < new.end_time and b.end_time > new.start_time) then raise exception 'BLOCK_CONFLICT'; end if;
  return new;
end $$;
revoke all on function public.starapple_guard_block() from public, anon, authenticated;
drop trigger if exists starapple_block_guard on public.blocked_slots;
create trigger starapple_block_guard before insert or update or delete on public.blocked_slots
  for each row execute function public.starapple_guard_block();

create or replace function public.starapple_lock_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(735198142);
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.starapple_lock_schedule() from public, anon, authenticated;
drop trigger if exists starapple_court_lock on public.courts;
create trigger starapple_court_lock before insert or update or delete on public.courts
  for each row execute function public.starapple_lock_schedule();
drop trigger if exists starapple_hours_lock on public.operating_hours;
create trigger starapple_hours_lock before insert or update or delete on public.operating_hours
  for each row execute function public.starapple_lock_schedule();

-- Narrow email lookup: only the booking owner or a verified venue admin.
create or replace function public.booking_contact_email(booking_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select u.email::text from public.bookings b join auth.users u on u.id = b.user_id
  where b.id = booking_id and (b.user_id = auth.uid() or public.is_admin());
$$;
revoke all on function public.booking_contact_email(uuid) from public, anon;
grant execute on function public.booking_contact_email(uuid) to authenticated;

create or replace function public.starapple_booking_rules()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('version', 1, 'rules', '__RULES_JSON__'::jsonb, 'ready',
    (select count(*) = 4 from pg_trigger t where not t.tgisinternal and t.tgenabled = 'O'
      and ((t.tgrelid = 'public.bookings'::regclass and t.tgname = 'starapple_booking_guard')
        or (t.tgrelid = 'public.blocked_slots'::regclass and t.tgname = 'starapple_block_guard')
        or (t.tgrelid = 'public.courts'::regclass and t.tgname = 'starapple_court_lock')
        or (t.tgrelid = 'public.operating_hours'::regclass and t.tgname = 'starapple_hours_lock'))));
$$;
revoke all on function public.starapple_booking_rules() from public;
grant execute on function public.starapple_booking_rules() to anon, authenticated;
commit;
