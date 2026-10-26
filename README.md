# StarApple Pickleball Venue

A mobile-first court booking app built with Next.js 16.4.3, React 19, TypeScript, Tailwind 4, locally owned shadcn/ui controls, Supabase Auth/Postgres, and Resend. Players choose a court and time, then pay at the venue. No online payments or paid services are provisioned.

The visual direction comes from the supplied Soccer template: dark sports framing, bold typography, and a large court hero. The venue's supplied paddle logo appears in the header, footer, and browser icon. The palette uses `#abdbe3` with deep blue surfaces and matching selection, focus, and hover colors in light and dark mode. The interface is rebuilt for pickleball; the template's soccer photos, JavaScript, and CSS are not bundled. The hero is a generated illustration/photo asset, not a photograph of the actual venue. The venue's exact supplied Apple Maps pin is used for directions; no street address or phone is invented.

## Run locally

Use Node.js 24 and npm. Keep your existing `.env.local`; add missing settings from `.env.example` rather than overwriting it.

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. The existing public Supabase URL and publishable key are supported. The plan's `NEXT_PUBLIC_SUPABASE_ANON_KEY` name also works. A service role key is not needed.

```sh
npm run lint
npm test
npm run typecheck
npm run build
npm run backend:check
```

`backend:check` reads court settings, anonymous availability, guard readiness, and the hosted Auth confirmation setting. It reports signup as ready only when email confirmation is disabled. It never creates an account or booking. On restricted Windows environments, run the build in a terminal allowed to access the project directory; SWC cannot canonicalize the directory when Windows denies access.

## What is implemented

| Area | Routes and behavior |
| --- | --- |
| Public | `/`, `/book`, `/rules`: live availability, a 14-day date strip, mobile court tabs, time filters, 1–3 hour durations, review, and success |
| Authentication | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`: email/password with immediate signup when Supabase confirmation is disabled, optional Google, recovery, safe return paths |
| Player | `/bookings`, `/bookings/[id]`, `/account`: upcoming/history, cancellation, calendar downloads, profile and password changes, logout |
| Owner | `/admin`, `/admin/calendar`, `/admin/bookings`, `/admin/blocks`, `/admin/courts`, `/admin/hours`, `/admin/players`: schedule, day/week calendar, filters, status actions, blocks, inline editing, player history, bookings for existing players |
| Notifications | Confirmation with `.ics`, player cancellation, and player-cancellation notification to the owner |

Availability uses `get_unavailable_slots`, not other players' booking rows. Court 1, Court 2, and Court 3 are loaded from the database throughout the player and admin screens. The public availability endpoint uses a session-free client and skips auth refresh, so an expired login cannot hold up the schedule. Slots refresh every 30 seconds while the booking tab is visible. A shared 15-second browser cache deduplicates homepage/booking reads and makes returning to a recent date immediate. Reads have timeouts and one retry; a failed background refresh retains the last successful schedule. The database still checks every booking against current availability. Authentication is requested only when confirming a booking. Selections are kept in session storage and encoded in a safe return URL, so authentication redirects restore the court, time, and duration. Notes stay in the original tab's session storage.

With Cache Components enabled, the server Auth client waits for `connection()` before initialization. Its clock reads happen at request time rather than during static prerendering; the navigation's existing Suspense boundary keeps this separate from the page shell.

All displayed times use Asia/Manila. Stored booking/block times are UTC timestamps. Calendar exports use UTC instants. The server validates booking rules and the database repeats them under a transaction lock; the existing exclusion constraint remains in place. Late online cancellation is blocked for players, while staff can cancel at the desk.

## Database

See `supabase/README.md`. The supplied five-table schema is preserved. No guest column is added: staff choose an existing player for a walk-in booking. Closing a weekday removes that day's hours row, matching the existing `close_time > open_time` constraint.

During implementation, `starapple_booking_guards` and `starapple_trigger_permissions` were applied to the Supabase project matching this checkout's URL. The readiness RPC reports the current rules and `ready: true`. These migration files are also stored locally. For another environment, review and apply them there.

Change business rules only in the JSON rule block in `lib/config.ts`, then run:

```sh
npm run db:prepare
```

Review and apply the regenerated SQL to keep server/database rules aligned. If guards are missing or rules differ, the app permits browsing but refuses booking/cancellation changes until setup is repaired.

`supabase/regression.sql` runs rollback-only database checks, including RLS, self-promotion prevention, overlap conflicts, lead time, horizon, durations, opening hours, the three-booking limit, cancellation, block conflicts, email privacy, and anonymous access. It needs at least two active courts, 08:00–22:00 opening hours, and default rules. It leaves no fixture accounts or bookings behind. Do not treat it as a concurrency load test; simultaneous request stress testing belongs in a staging copy with disposable accounts.

## Finish live setup

1. Create the owner's account through `/signup`, then promote that exact user using the SQL shown in `supabase/README.md`. Never set admin access from sign-up metadata.
2. The supplied venue phone is configured as `+639175884377`. Set `NEXT_PUBLIC_COURT_PHONE` to override it and, if available, add a human-readable `NEXT_PUBLIC_COURT_ADDRESS`. The supplied map pin already works.
3. Configure Supabase's Site URL and permitted redirects for localhost and the final Netlify domain. Keep Email enabled and turn **Confirm email** off under Authentication → Sign In / Providers. Players can then sign up and start booking immediately. This hosted setting must be changed in the dashboard; changing the frontend alone does not disable confirmation. Run `supabase/seed-courts.sql` for a new database to ensure all three courts exist.
4. Add a verified Resend sending domain. Configure Resend SMTP in Supabase for password recovery. This is separate from booking emails.
5. Set server-only `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `COURT_NOTIFICATION_EMAIL` for booking emails. Missing/failed delivery never rolls back a successful booking; the player sees a warning and can use My Bookings. Requests are bounded to eight seconds and carry idempotency keys.
6. Optionally enable Google in Supabase, configure the provider callback, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. Until then the Google option is hidden.
7. The requested GitHub destination is [AppleStar-Court-Reservation-System](https://github.com/bigRei61/AppleStar-Court-Reservation-System). Import the repository into the chosen Netlify site. `netlify.toml` provides the build settings; Netlify's [Next.js adapter](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) is automatic. Add environment variables in Netlify, set `NEXT_PUBLIC_SITE_URL` to the production URL, update Supabase redirects, and redeploy. A hosted deployment still requires the owner's Netlify account.

For password recovery across tabs or devices, the callback supports token hashes as well as PKCE codes. Supabase's recovery email template can use the app's supplied redirect URL:

```html
<!-- Reset password -->
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

The app supplies `/auth/callback?next=...` as `RedirectTo` for recovery, so the template appends parameters with `&`. Validate the template and redirect allowlist in your own project before launch. No magic-link or SMS sign-in is offered.

## Verification and phone checks

The production build, TypeScript check, and 22 unit tests passed, including availability request deduplication, retries, timeouts, cache expiry, and protection against stale responses after a booking. Twelve database regression groups passed against the connected project and rolled their fixtures back. The connected project now has three active courts, seven opening-hour records, anonymous availability, enabled RLS on all five tables, and ready booking guards.

Responsive browser checks covered widths from 320px to 1440px. Home, authentication, rules, and booking screens have no page-wide horizontal overflow. The actual account, booking-history, and admin components were also checked with sample data at phone and tablet sizes. Date/court/time selection and the booking review sheet were exercised in the browser. Mobile controls have larger touch targets, form fields avoid focus zoom, and admin tables become labelled cards. The weekly calendar scrolls within its own panel.

Physical-phone keyboards and safe areas, screen-reader behavior, account emails, and the complete authenticated booking journey still need launch checks:

| Phase | How to check | What to check on a 375px phone |
| --- | --- | --- |
| Foundation | `npm run dev`; visit Home and Rules | Readable hero, no page-wide horizontal overflow, bottom tabs and safe-area spacing |
| Auth | Sign up and start booking immediately, log in, reset; use Google if enabled | Confirm email is off in Supabase; labels, password toggle, useful errors; return to the chosen slot |
| Booking | Pick a date/court/time, try 1–3 hours, confirm | Scrollable dates, clear disabled slots/durations, reachable review button, no selection loss on a network retry |
| My Bookings | View details, download `.ics`, cancel a far-future game | Upcoming/history tabs, time in Manila, cancellation dialog, immediate released slot |
| Emails | Make and cancel a test booking after Resend setup | Correct reference/time/court, working manage link and calendar attachment |
| Admin | Sign in as owner; manage courts/hours/blocks; book for an existing player | Easy status buttons and tap-to-call; overlapping blocks identify affected games |
| Polish | Keyboard-only navigation, a screen reader, light/dark system preference | Visible focus, announced messages, readable status text, no dependence on color alone |
| Deploy | Test the final Netlify URL from two devices | Auth callbacks, session refresh, concurrent booking conflict, and real email delivery |

The optional three-hour reminder cron is not enabled. Core confirmation/cancellation emails are implemented; delivery still requires the provider settings above.

## Important files

| Path | Purpose |
| --- | --- |
| `lib/config.ts` | Rules, venue details, and map pin |
| `lib/time.ts`, `lib/availability.ts` | Manila time and slot validation |
| `lib/supabase.ts`, `lib/supabase-server.ts`, `proxy.ts` | Browser/server clients and session refresh |
| `components/booking/` | Booking flow, history, cancellation |
| `components/admin/` | Owner screens and editable tables |
| `app/book/actions.ts`, `app/admin/actions.ts`, `app/bookings/actions.ts` | Authenticated server mutations |
| `lib/email.ts`, `lib/calendar.ts` | Notifications and RFC 5545 exports |
| `supabase/` | Additive migrations, readiness checks, and rollback tests |
| `tests/booking.test.mjs` | Timezone, boundary, conflict, validation, and calendar tests |
| `.github/workflows/checks.yml` | Lint, tests, and production build on push/PR |

## Dependency and database advisories

Next.js and its matching ESLint package are pinned to 16.4.3 after the framework's security advisory check identified the earlier version. The dependency audit reported zero known vulnerabilities after the patch update.

Supabase flags the original `btree_gist` extension's [public schema placement](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public); it was preserved with the supplied schema. The anonymous availability RPC is intentionally [security-definer and publicly callable](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) to reveal only unavailable times. `is_admin` and the ownership-checked booking email lookup are intentionally callable by authenticated users. Internal trigger helpers have no direct anonymous/authenticated execute grants.
