# SCMC Venue Booking

Gather — Venue Booking MVP

Calendar-first, mobile-responsive prototype for eight community venues.

## Run locally

From this directory, run:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080 in a browser. No build step or dependencies are required.

## Review features

- Calendar and venue schedules for Room 1 through Room 8.
- English and Simplified Chinese interface with short text labels.
- Booking form: activity, group, venue, date, start/end time and PIC.
- Optional contact, attendance and notes.
- Member/admin preview switch.
- Pending requests reserve the time slot; overlaps are blocked locally.
- Administrators approve, reject, block rooms, and cancel pending or confirmed bookings.
- Members cancel only their own pending bookings. An admin must cancel or reschedule confirmed bookings.
- Cancelled records stay in history and release their slot.
- Demo clock can advance 48 hours to exercise automatic approval.

## Important: prototype status

This is a browser-only review MVP, not a production booking service.

Records are saved to localStorage on the current browser. Accounts and role selection are simulated. Data is not shared between devices. The approval check runs only while the page is open. Storage availability depends on the browser or preview environment.

The scheduled check approves requests pending for 48 hours if their start time has not passed. Requests starting within 48 hours need explicit admin approval before their start; otherwise they expire. The demo limits booking hours to 06:00–23:00, Singapore time (UTC+8).

## Production work remaining

1. Real sign-in and server-enforced roles/ownership.
2. Shared database and atomic conflict prevention, including simultaneous submissions.
3. Server-side scheduled approval with reliable retries and audit records.
4. Server-side validation and authorized cancellation/rescheduling.
5. Backups, monitoring and recovery procedures.

Cloudflare is the intended hosting destination. Backend selection (D1 or Supabase) is not finalized. Publishing this static prototype does not implement any of the production items above.

## Files

`index.html` contains the current UI, styles, sample data and local demo logic. The conversation-only preview wrapper is not required.

Keep credentials out of this repository. Do not replace demonstration data with real contact details before implementing authentication and access control.
