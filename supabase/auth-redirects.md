# Production authentication links

The live website is `https://apple-star-court-reservation-system.vercel.app`.

In Supabase **Authentication → URL Configuration** for the existing project, set:

| Setting | Value |
| --- | --- |
| Site URL | `https://apple-star-court-reservation-system.vercel.app` |
| Redirect URL | `https://apple-star-court-reservation-system.vercel.app/auth/callback**` |
| Optional local development redirect | `http://localhost:3000/auth/callback**` |

Keep unrelated existing redirects. The callback pattern includes the app's `next` query parameter, such as `?next=%2Freset-password`.

In Vercel **Settings → Environment Variables**, set `NEXT_PUBLIC_SITE_URL` to the live origin above, without a trailing path. Redeploy after changing an environment variable. The app also resolves Vercel's stable production hostname and falls back to the live venue domain in production; localhost is only a development fallback.

The password-reset form deliberately uses the current browser origin for its callback. This keeps the PKCE verifier and callback cookies on the same site. Request the reset from the live `/forgot-password` page when using the live venue.

If the reset email template has a literal localhost address, remove that hardcoded address. The standard `{{ .ConfirmationURL }}` link uses Supabase's configured Site URL and the allowed redirect supplied by the app. The optional token-hash template in the main README uses `{{ .RedirectTo }}` and is also supported. Some new Free-plan projects require custom SMTP before email templates can be edited; changing the Site URL and redirect list does not require a custom template.

Previously sent emails retain their original destination. After saving these settings, request a fresh reset email from `https://apple-star-court-reservation-system.vercel.app/forgot-password` and open the newest message. No account password needs to be changed through the Supabase dashboard.
