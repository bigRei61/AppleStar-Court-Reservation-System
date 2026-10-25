-- Run after the supplied schema when setting up a venue database.
-- Existing court IDs and bookings are preserved. Safe to run again.
begin;

insert into public.courts (name, is_active)
select court.name, true
from (values ('Court 1'), ('Court 2'), ('Court 3')) as court(name)
where not exists (
  select 1 from public.courts existing
  where lower(trim(existing.name)) = lower(court.name)
);

commit;
