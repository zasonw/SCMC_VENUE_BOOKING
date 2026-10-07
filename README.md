# SCMC Venue Booking

A responsive venue calendar for eight rooms, hosted on Cloudflare Workers with Supabase Auth and Postgres. English and Simplified Chinese are supported. Booking hours are 06:00–23:00 Malaysia time.

## Deployment

Cloudflare watches `main`. Build command: blank. Deploy command: `npx wrangler deploy`. `wrangler.jsonc` serves the static website; `.assetsignore` excludes maintenance files.

`index.html` contains the calendar UI. `live.js` connects it to Supabase using a browser-safe publishable key. Never put a service-role key or email credentials in the repository. The Supabase browser SDK is pinned to 2.57.4 on jsDelivr.

## Required Auth settings before registration

In Supabase Authentication → URL Configuration, set Site URL and an allowed Redirect URL to the production website URL, including the trailing `/`.

Enable Email sign-in, allow new signups, and keep Confirm email enabled. Configure custom SMTP before inviting the general public. Supabase's default email service only delivers to authorized team addresses and is unsuitable for public registration.

The initial admin email is configured privately in `venue_private.admin_bootstrap`, not in this repository. It is claimed once when that verified account first signs in. Administrators can use Users to grant or revoke access; the last admin cannot be demoted. Users appear after their first verified sign-in.

## Booking rules and privacy

- Pending requests immediately reserve a room. A database exclusion constraint prevents simultaneous overlapping reservations.
- The owner can cancel pending bookings; admins can cancel pending, confirmed or blocked slots.
- Admins can approve or reject requests and block rooms.
- A database cron job checks every minute: pending requests that have reached their start time expire; otherwise eligible requests approve after 48 hours.
- A member cannot move a confirmed booking. Moving another eligible booking restarts the approval window.
- Guests see room occupancy. Signed-in users see event, group and PIC; contact, notes and history are visible only to the owner and admins.
- All permissions are checked in Postgres. The UI has no role-preview switch and never uploads demo data.
- Calendar data refreshes every 30 seconds while active and after changes. A stale display cannot bypass the database conflict constraint.

## Database maintenance

`database/schema.sql` documents the initial deployed schema. Do not rerun it against an initialized database. Apply subsequent changes through reviewed migrations. Private tables deliberately have RLS enabled with no direct client policies or grants: only the checked RPC is accessible. Do not expose the private schema through the Data API.

`venue-approval-every-minute` is the cron job. Review its status in Supabase Cron if approvals stop processing. Database availability, including project pauses, affects the scheduler.

## Checks

Run `node tests/frontend.cjs` for application logic checks. `tests/backend.sql` checks permissions and booking rules in a transaction that rolls back all fixtures. It should be run before real admin accounts exist, or adapted to account for existing administrators. These checks do not replace browser/device testing or email delivery testing.

For local review: `python3 -m http.server 8000` from the repository. Local Auth callbacks require an explicitly allowed localhost URL in Supabase.
