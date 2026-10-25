# Database setup

The app targets the exact five-table schema supplied by the venue owner. It does not add guest columns, replace tables, or remove the existing exclusion constraint or RLS policies. Walk-in bookings use an existing player account.

1. Keep the existing schema in place. Do not run the original CREATE TABLE script again on the live project.
2. Run `npm run db:prepare` after changing the rule block in `lib/config.ts`.
3. Review `001_booking_guards.sql` and `002_trigger_permissions.sql`, then execute them in order in the matching Supabase project's SQL Editor. The main migration runs in one transaction, checks the expected schema, and is safe to reapply. Both have already been applied to the connected project during implementation.
4. Run `verify.sql`. The rules function should report `ready: true`, five tables should have RLS enabled, the exclusion constraint should still exist, and the authenticated role should only be able to update `full_name` and `phone` on profiles.
5. Run `seed-courts.sql` to ensure Court 1, Court 2, and Court 3 exist. It preserves existing court IDs and bookings and can be rerun safely. All three courts are active in the connected project.
6. Run `npm run backend:check`. This reads public settings and readiness only. It creates no bookings or accounts.

For immediate email/password signup, open Supabase Authentication → Sign In / Providers and turn **Confirm email** off. This hosted Auth setting is separate from SQL and must also be configured in any new Supabase project. Signup signs players in immediately when this setting is off; password recovery still uses email.

The guards serialize booking and block writes, check active courts and opening hours, enforce whole-hour durations, the booking horizon, lead time, upcoming-booking limit, and player cancellation window. The existing exclusion constraint remains the final protection against two bookings for the same court and time. Staff can cancel late bookings but cannot move or reactivate a cancelled booking; create a new one instead.

Closing a weekday removes its `operating_hours` row, because the supplied schema requires closing time to be later than opening time. No extra closed flag is introduced. Date-range blocks are continuous, including overnight.

The narrow `booking_contact_email(uuid)` function only returns an address to that booking's owner or a verified admin, allowing staff-created and staff-cancelled booking emails without a service role key. Anonymous availability contains only court, time, and kind.

Promote the owner using the Supabase SQL Editor after they sign up (replace the sample address):

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'owner@example.com');
```

Do not promote users based on sign-up metadata. The web app never accepts an admin flag in profile forms.

The rollback-only `regression.sql` suite passed all 12 groups during implementation, including ownership, promotion prevention, the existing overlap constraint, the booking rules, cancellation, block conflicts, and anonymous access. Fixture accounts/bookings/blocks were rolled back, and the live tables were confirmed clean afterward.

Test actual concurrency in a staging copy before launch: two players booking the same slot must produce one success and one `23P01` conflict; a player with two upcoming games issuing two requests on different courts must finish with at most three active games; and a simultaneous block and booking must never both succeed for overlapping time. These stress scenarios require disposable test accounts and are not exercised by the read-only connection check or the sequential rollback suite.
