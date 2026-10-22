-- Regression checks use a subtransaction that ALWAYS rolls fixtures back.
-- No emails are sent, no real accounts are read, and no test rows persist.
-- An unexpected failure aborts the whole statement and rolls all fixtures back.
do $tests$
declare
  player_a uuid := gen_random_uuid();
  player_b uuid := gen_random_uuid();
  court_a uuid;
  court_b uuid;
  first_booking uuid;
  late_booking uuid;
  test_day date := (clock_timestamp() at time zone 'Asia/Manila')::date + 2;
  starts timestamptz;
  late_start timestamptz;
  affected integer;
  report jsonb := '[]'::jsonb;
begin
  begin
    select id into court_a from public.courts where is_active order by name limit 1;
    select id into court_b from public.courts where is_active and id <> court_a order by name limit 1;
    if court_a is null or court_b is null then raise exception 'This fixture requires the two original active courts.'; end if;
    starts := (test_day + time '08:00') at time zone 'Asia/Manila';
    insert into auth.users(id, aud, role, email, raw_user_meta_data) values
      (player_a, 'authenticated', 'authenticated', 'rule-test-a-' || player_a::text || '@example.invalid', '{"full_name":"Rule test A","phone":"+639171234567"}'),
      (player_b, 'authenticated', 'authenticated', 'rule-test-b-' || player_b::text || '@example.invalid', '{"full_name":"Rule test B","phone":"+639181234567"}');
    if (select count(*) from public.profiles where id in (player_a,player_b) and not is_admin) <> 2 then raise exception 'Profile trigger failed.'; end if;
    report := report || '"Profile creation after helper permissions were restricted"'::jsonb;
    perform set_config('request.jwt.claims', jsonb_build_object('sub',player_a,'role','authenticated')::text, true);
    perform set_config('role','authenticated',true);
    insert into public.bookings(user_id,court_id,start_time,end_time) values(player_a,court_a,starts,starts+interval '1 hour') returning id into first_booking;
    report := report || '"Authenticated player can book an available court"'::jsonb;

    perform set_config('request.jwt.claims', jsonb_build_object('sub',player_b,'role','authenticated')::text, true);
    begin
      insert into public.bookings(user_id,court_id,start_time,end_time) values(player_b,court_a,starts,starts+interval '1 hour');
      raise exception 'Overlap was accepted.';
    exception when exclusion_violation then null; end;
    report := report || '"Exclusion constraint rejects overlapping bookings (23P01)"'::jsonb;
    if (select count(*) from public.bookings where id=first_booking) <> 0 then raise exception 'Another player can read the booking.'; end if;
    update public.bookings set status='cancelled' where id=first_booking;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Another player can cancel the booking.'; end if;
    report := report || '"RLS prevents reading and cancelling another player’s booking"'::jsonb;
    begin
      update public.profiles set is_admin=true where id=player_b;
      raise exception 'Player could promote themselves.';
    exception when insufficient_privilege then null; end;
    report := report || '"Players cannot change their admin flag"'::jsonb;

    begin
      insert into public.bookings(user_id,court_id,start_time,end_time) values(player_b,court_b,starts,starts+interval '4 hours');
      raise exception 'Invalid duration accepted.';
    exception when others then if SQLERRM <> 'BOOKING_DURATION' then raise; end if; end;
    begin
      insert into public.bookings(user_id,court_id,start_time,end_time) values(player_b,court_b,date_trunc('hour',clock_timestamp())+interval '1 hour',date_trunc('hour',clock_timestamp())+interval '2 hours');
      raise exception 'Insufficient lead time accepted.';
    exception when others then if SQLERRM <> 'BOOKING_LEAD' then raise; end if; end;
    begin
      insert into public.bookings(user_id,court_id,start_time,end_time) values(player_b,court_b,starts+interval '14 days',starts+interval '14 days 1 hour');
      raise exception 'Out-of-window booking accepted.';
    exception when others then if SQLERRM <> 'BOOKING_DATE' then raise; end if; end;
    begin
      insert into public.bookings(user_id,court_id,start_time,end_time) values(player_b,court_b,starts-interval '1 hour',starts);
      raise exception 'Outside-hours booking accepted.';
    exception when others then if SQLERRM <> 'BOOKING_HOURS' then raise; end if; end;
    report := report || '"Database validates durations, lead time, horizon, and opening hours"'::jsonb;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',player_a,'role','authenticated')::text,true);
    insert into public.bookings(user_id,court_id,start_time,end_time) values
      (player_a,court_a,starts+interval '1 hour',starts+interval '2 hours'),
      (player_a,court_a,starts+interval '2 hours',starts+interval '3 hours');
    begin
      insert into public.bookings(user_id,court_id,start_time,end_time) values(player_a,court_b,starts,starts+interval '1 hour');
      raise exception 'Fourth active game accepted.';
    exception when others then if SQLERRM <> 'BOOKING_LIMIT' then raise; end if; end;
    report := report || '"Three-booking limit applies across courts"'::jsonb;
    update public.bookings set status='cancelled' where id=first_booking;
    if exists(select 1 from public.get_unavailable_slots(starts, starts+interval '1 hour') where court_id=court_a) then raise exception 'Cancellation did not free the slot.'; end if;
    report := report || '"On-time cancellation frees availability immediately"'::jsonb;

    perform set_config('role','none',true);
    begin
      insert into public.blocked_slots(court_id,start_time,end_time,reason) values(court_a,starts+interval '1 hour',starts+interval '2 hours','Regression test');
      raise exception 'Block was allowed over a booking.';
    exception when others then if SQLERRM <> 'BLOCK_CONFLICT' then raise; end if; end;
    insert into public.blocked_slots(court_id,start_time,end_time,reason) values(court_b,starts+interval '4 hours',starts+interval '5 hours','Regression test');
    perform set_config('request.jwt.claims',jsonb_build_object('sub',player_b,'role','authenticated')::text,true);
    perform set_config('role','authenticated',true);
    begin
      insert into public.bookings(user_id,court_id,start_time,end_time) values(player_b,court_b,starts+interval '4 hours',starts+interval '5 hours');
      raise exception 'Booking was allowed over a block.';
    exception when others then if SQLERRM <> 'BOOKING_BLOCKED' then raise; end if; end;
    report := report || '"Blocks and bookings reject conflicts in both directions"'::jsonb;

    select s into late_start from generate_series(date_trunc('hour',clock_timestamp())+interval '2 hours',clock_timestamp()+interval '12 hours',interval '1 hour') s
      join public.operating_hours h on h.day_of_week=extract(dow from s at time zone 'Asia/Manila')
      where (s at time zone 'Asia/Manila')::time>=h.open_time and ((s+interval '1 hour') at time zone 'Asia/Manila')::time<=h.close_time
      order by s limit 1;
    if late_start is null then raise exception 'Cannot find a late-cancellation test slot.'; end if;
    insert into public.bookings(user_id,court_id,start_time,end_time) values(player_b,court_b,late_start,late_start+interval '1 hour') returning id into late_booking;
    begin
      update public.bookings set status='cancelled' where id=late_booking;
      raise exception 'Late cancellation accepted.';
    exception when others then if SQLERRM <> 'BOOKING_LIMIT_CANCEL' then raise; end if; end;
    report := report || '"Player cancellation is blocked inside 12 hours"'::jsonb;
    if public.booking_contact_email(first_booking) is not null then raise exception 'Another player can read the booking email.'; end if;
    report := report || '"Booking email lookup hides another player’s email"'::jsonb;

    perform set_config('role','anon',true);
    if not (public.starapple_booking_rules()->>'ready')::boolean then raise exception 'Anonymous readiness failed.'; end if;
    if (select count(*) from public.get_unavailable_slots(starts,starts+interval '6 hours')) < 3 then raise exception 'Anonymous availability failed.'; end if;
    report := report || '"Anonymous visitors can read availability and readiness"'::jsonb;
    raise sqlstate 'Z0001' using message='STARAPPLE_TEST_ROLLBACK';
  exception when sqlstate 'Z0001' then null;
  end;
  perform set_config('starapple.test_report',report::text,true);
end $tests$;
select jsonb_build_object('passed',jsonb_array_length(current_setting('starapple.test_report')::jsonb),'checks',current_setting('starapple.test_report')::jsonb,'fixtures_persisted',false) as regression_result;
