# Telemetry release verification

Use this handoff after the owner configures the test/staging Supabase and Google OAuth projects. Repeat it for production only after test/staging passes. Do not record credentials, JWTs, email addresses, user IDs, raw event rows, or database connection details here.

## Preconditions

- `.env.local` has only the target environment's `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_GAME_VERSION`.
- The matching migration and `ingest-game-events` function are deployed.
- `TELEMETRY_ALLOWED_ORIGINS` lists the exact browser origin under test, and Google is enabled in the same Supabase project.
- The Supabase Auth redirect URLs and the Google OAuth authorized redirect URI match the mapping in [Telemetry Operations and Privacy](telemetry.md#auth-and-environment-setup).

## Browser and database checks

1. On localhost and staging, start an unsigned run and perform an allowlisted action. Network inspection must show a request only to `ingest-game-events`; its JSON payload contains no email, client-chosen `user_id`, IP/region, user agent, fingerprint, free text, token, or forbidden event field. A signed-in request may carry its session JWT only in the `Authorization` header for server-side identity derivation.
2. Complete Google OAuth, refresh the page, then sign out. Confirm the status changes through signed-in, retained-after-refresh, and unsigned-after-local-sign-out. Cancel and fail the OAuth flow separately; each must leave gameplay usable and show a non-secret failure state.
3. During both unsigned and signed-in runs, verify the function accepts only allowlisted events. Inspect the database through administrator access: unsigned rows have a null `user_id`; signed-in rows have an identity derived by the function. Do not copy row values into this record.
4. From a browser anon/authenticated connection, attempt direct `public.game_events` read and insert. Both must be denied by RLS; the Edge Function remains the only ingestion route.
5. Confirm the `delete-expired-game-events` Cron registration exists and the cleanup function removes only raw telemetry older than 90 days. Confirm stored rows contain no secret or forbidden telemetry fields.

## Public outcome record

Add a dated entry to the release record only after the checks pass or fail. Use public URLs and qualitative outcomes; use `PASS`, `FAIL`, or `NOT RUN` rather than sensitive diagnostic data.

| Field | Public value to record |
| --- | --- |
| Environment and app origin | `localhost`, staging, or production public URL |
| Migration / function deployment | PASS / FAIL / NOT RUN |
| OAuth callback, refresh, local sign-out | PASS / FAIL / NOT RUN |
| Cancelled and failed OAuth remains playable | PASS / FAIL / NOT RUN |
| Unsigned and signed-in Edge Function ingestion | PASS / FAIL / NOT RUN |
| Direct-table RLS read and insert denial | PASS / FAIL / NOT RUN |
| 90-day cleanup job registration and scope | PASS / FAIL / NOT RUN |
| No secret or forbidden telemetry stored | PASS / FAIL / NOT RUN |
| Automated `test:project`, typecheck, build | PASS / FAIL / NOT RUN |

If a check fails, record only the affected public environment and the next remediation step. Rotate any secret that was exposed outside its platform secret store; do not preserve it as evidence.
