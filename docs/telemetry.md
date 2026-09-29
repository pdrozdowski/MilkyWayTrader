# Telemetry Operations and Privacy

`game_events` records low-frequency gameplay progression and drop-off signals. It is not a source of account data, gameplay saves, score submission, advertising profiles, or real-time diagnostics.

## Data boundary

Each row has a browser installation `anonymous_id`, per-run `session_id`, allowlisted event name, object event payload, game version, and a coarse `desktop`/`mobile` platform. When a valid Supabase Auth JWT is supplied, the Edge Function derives `user_id` from that token. Unsigned rows retain a null `user_id`; browser input can never choose an identity.

Do not send names, email addresses, OAuth tokens, IP addresses, location/region, user-agent strings, device model, screen size, fingerprints, free text, or other personal data in event payloads. The browser sends only `ingest-game-events`; it has no policy permitting direct reads or writes to `public.game_events`. Analysis access is administrator-only through approved Supabase administration access.

Raw events are retained for 90 days. The daily Supabase Cron job deletes one bounded batch of expired events per run. It is raw-telemetry retention only, not an account-deletion policy.

## Deployment

Apply the migration and deploy the function to the dedicated test Supabase project before production:

```powershell
supabase db push --project-ref <test-project-ref>
supabase functions deploy ingest-game-events --project-ref <test-project-ref> --no-verify-jwt
```

Set these Function secrets separately in each test and production project; never add them to `.env.local` or source control:

- `SUPABASE_SERVICE_ROLE_KEY` (server-side insertion only)
- `TELEMETRY_ALLOWED_ORIGINS` (comma-separated exact origins, such as `http://localhost:8080,https://staging.example.pages.dev`)

`SUPABASE_URL` is supplied by Supabase Functions. Keep `verify_jwt = false` for this function because unsigned play is supported; its code validates an optional bearer token before deriving an identity. After each deployment, inspect the migration, confirm RLS has no browser policies, confirm the Cron job exists, and test both unsigned and authenticated batches from the exact allowed origins.

Before collecting public telemetry, the owner must provide any privacy notice, consent mechanism, lawful basis, and other obligations required in the jurisdictions where the game is offered. This repository cannot determine or satisfy those obligations on the owner’s behalf.
