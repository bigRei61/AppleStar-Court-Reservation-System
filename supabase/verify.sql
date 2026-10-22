-- Read-only checks after applying 001_booking_guards.sql.
select public.starapple_booking_rules();
select tablename, rowsecurity from pg_tables where schemaname = 'public'
  and tablename in ('profiles', 'courts', 'operating_hours', 'bookings', 'blocked_slots');
select conname, pg_get_constraintdef(oid) from pg_constraint
  where conrelid = 'public.bookings'::regclass and conname = 'no_overlapping_bookings';
select grantee, column_name, privilege_type from information_schema.column_privileges
  where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated'
    and privilege_type = 'UPDATE';
