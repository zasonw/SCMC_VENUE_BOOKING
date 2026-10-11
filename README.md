# SCMC Venue Booking

A responsive venue calendar for nine rooms, hosted on Cloudflare Workers with Supabase Auth and Postgres. English and Simplified Chinese are supported. Booking hours are 06:00–23:00 Malaysia time.

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

## Recurring bookings and fellowship directory

The Repeat field supports Once, Weekly (selected weekdays), and Monthly (same date or the same ordinal weekday as the start date). A required end date must be within six calendar months of today. Months lacking the requested day or fifth weekday are skipped. Each occurrence is stored as a normal booking and follows the existing approval rules.

Choose Preview dates before submitting. Clashes and past times are disabled; uncheck additional dates to skip them. The server regenerates and validates dates, and all selected dates are saved in one transaction. If availability changes, no part of the new series is booked. A request key prevents duplicates when retrying a submission.

Open any recurring booking and select Series to see its dates. Admins can approve upcoming pending dates or cancel eligible dates together. Members can cancel their own pending dates only; confirmed dates are retained. Edit applies to one occurrence, not the whole series.

People is an admin-only directory with names and multiple fellowship tags. Entries can optionally be linked to an existing registered account. Directory entries do not create accounts or grant admin privileges. Deleting a directory entry keeps the linked login account. Initial personal records are maintained privately in the database and are not committed here.

The configured rooms are 圣堂, 副堂, 新会议室, 旧会议室, Cafe, 厨房, 亲子室, 喜乐1 and 喜乐2. Existing room IDs are retained. Admin room editing validates against the current room count.

For a fresh database, apply `database/schema.sql` then `database/recurring-and-people.sql`. These scripts have already been applied to the connected project; do not rerun them there. Run `node tests/recurring.cjs` for recurrence UI logic and `tests/recurring.sql` for transactional backend checks. Backend test fixtures roll back and must not be treated as real accounts.

## Mobile slot selection and booking fields

Slot taps update the existing buttons in place, preserving scroll position and focus while selecting a consecutive range. Data refreshes restore the grid's scroll position when its date and room set remain unchanged. An explicit 84px time column and room-count-based table width keep a filtered single-room grid within the phone screen.

Bookings require a Fellowship dropdown selection and Purpose. Other requires a fellowship name. These use the existing group and title fields, retaining historical bookings and the database's required-field constraints. `booking-ui.js` installs the interaction fixes before starting the application. Run `node tests/booking-ui.cjs` for regression checks; real Safari device verification remains a separate check.

The calendar overview has no embedded booking picker. Book opens the classic date/time/room picker in a dialog. The Slots tab displays the grid directly, with no secondary Slots/Classic toggle. Editing an existing booking and continuing from selected slots still open the booking details form directly.

### Booking flow update
- Guest selections (room, date, start/end) are retained in the current tab for up to 24 hours and rechecked after sign-in. Email confirmation opened in another tab will not carry that tab's selection.
- Booking submissions and edits show a review summary. Recurring bookings first preview availability, then review selected dates before submission. Admin room blocks retain their direct flow.
- My bookings groups records into Upcoming, Pending, Past and Closed (cancelled, rejected or expired), preserving existing cancellation permissions.
- Run `node tests/booking-flow.cjs` in addition to the existing test scripts.

Phone acceptance checks (requires a real device): Safari portrait/landscape, keyboard open on Purpose and PIC, date/time pickers, optional fields, Review/Back/Confirm, recurring date list, guest sign-in resume and no sideways form overflow. Automated checks use DOM mocks and do not certify physical Safari rendering.

### Venue Booking Assistant
The Assistant navigation button accepts English or Chinese requests for single, weekly, or monthly bookings. It prepares a draft and checks live occupancy; users complete missing fields and use the existing review/confirmation flow to submit. It does not approve, cancel or directly create bookings.

The Worker entry point is `worker/assistant.mjs`. Wrangler adds an `AI` Workers AI binding and an `ASSETS` binding; only `/api/*` invokes the Worker first. The existing Supabase publishable URL/key are configuration values, not secret credentials. No service-role key is used. The assistant validates the caller with Supabase Auth, and calls only `state` and recurring `preview` using that caller's token. The AI receives the user's request and room catalog, not stored booking details or contact information.

Workers AI usage follows the Cloudflare account's quotas/billing. No paid-plan change is performed by this deployment. If AI is unavailable or quota is exhausted, the UI offers normal Book. Burst protection is best-effort per Worker instance (six requests/user/minute), not a global billing cap. Check Cloudflare usage before wider rollout. Requests are not logged by application code. Room/date/time suggestions must be reviewed by users.

Tests: `node tests/assistant-worker.mjs` and `node tests/assistant-ui.cjs`. These use mocked network/model responses; production AI quality and physical phone UX still need a signed-in acceptance test. To disable the assistant endpoint, remove the AI binding; normal calendar and booking remain available.

### Floating assistant and voice input
The assistant is opened with an accessible bottom-right robot button, raised above the slot Proceed controls. Voice input uses browser `SpeechRecognition` / `webkitSpeechRecognition` only after a microphone-button tap, with English and Mandarin choices. Final transcripts append to the request text and never submit automatically. Recording stops on close, navigation to another modal, backgrounding, or timeout. Unsupported/denied browsers retain typing and keyboard-dictation guidance. Speech processing is handled by the browser/provider; this app does not store audio. Physical iPhone microphone and permission behaviour still needs device testing.

Voice pause update: continuous dictation now survives normal speech pauses, restarting recognition when the browser ends a segment. Each segment and each new microphone session appends to the request. The former one-minute cutoff is removed. Stop finishes the current segment; repeated immediate browser failures stop with a clear retry prompt instead of looping. Close/background still aborts listening. The request remains limited to 2,000 characters.

## Account defaults and recurring exceptions (October 2026)
- `member-tools.js` is the final script and starts the application after all UI hooks.
- My profile stores a name, default fellowship and optional contact in the private `booking_profiles` table. State returns only the signed-in user's profile. A PIC is separate from the authenticated booking owner.
- Booking defaults are editable suggestions. Changing the suggested PIC clears the suggested contact. Saving booking details as defaults is explicit.
- Recurring bookings support editing or cancelling one future occurrence or selected occurrences from a date onward. Bulk changes are sparse: only checked fields change. Cancelled/past occurrences stay unchanged; individually modified dates are flagged and initially unchecked in bulk previews.
- The database rechecks ownership, dates, availability and preview fingerprints. All selected updates commit together or roll back together. Venue/date/time edits restart the affected booking's 48-hour approval clock; descriptive changes retain approval.
- The assistant offers profile defaults without overwriting explicitly supplied details. Manage recurring guides users through selecting a booking, scope, changes and confirmation. It never independently cancels or edits a booking.
- `database/profile-series.sql` records the applied backend release. It includes the final past-occurrence guard. **Already applied to production; do not rerun it.** Apply it once only when setting up another database after the earlier schema scripts.
- To run DOM integration tests: `npm ci --prefix tests`, then `npm test --prefix tests`. Existing Node tests remain available individually. `tests/profile-series.sql` uses temporary transaction fixtures and ends with rollback.
- Tested: real DOM interactions via jsdom, frontend regressions and database transactions. Physical iPhone layout, browser speech recognition and authenticated live AI interpretation still require device testing.
- Existing Supabase advisor warning: leaked-password protection remains disabled. [Supabase password security settings](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Private tables intentionally have RLS enabled with no direct client grants or policies; access goes through permission-checked RPC functions.
