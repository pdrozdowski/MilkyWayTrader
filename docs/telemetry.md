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

- `TELEMETRY_ALLOWED_ORIGINS` (comma-separated exact origins, such as `http://localhost:8080,https://staging.example.pages.dev`)

`SUPABASE_URL` is supplied by Supabase Functions. Keep `verify_jwt = false` for this function because unsigned play is supported; its code validates an optional bearer token before deriving an identity. After each deployment, inspect the migration, confirm RLS has no browser policies, confirm the Cron job exists, and test both unsigned and authenticated batches from the exact allowed origins.

## Auth and environment setup

Use a separate Supabase project and Google OAuth Web client for test/staging and production. The browser's `.env.local` contains only the matching project's public values:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<project-publishable-key>
VITE_GAME_VERSION=<release-version>
```

Do not put a Google client secret, a Supabase secret key, database password, access token, or `TELEMETRY_ALLOWED_ORIGINS` in this file. Supabase injects `SUPABASE_SECRET_KEYS` for Edge Functions; set only the allowed-origin value in the relevant Supabase dashboard/CLI secret store. The Google client ID and secret belong only in the matching Supabase Google provider configuration.

For the test Supabase project, configure these exact URLs while the existing Cloudflare aliases remain in use:

| Setting | Values |
| --- | --- |
| Supabase Auth redirect URLs | `http://localhost:8080`, `https://staging.milky-way-trader.pages.dev` |
| Edge Function `TELEMETRY_ALLOWED_ORIGINS` | `http://localhost:8080,https://staging.milky-way-trader.pages.dev` |
| Google OAuth authorized redirect URI | `https://<test-project-ref>.supabase.co/auth/v1/callback` |

For production, replace the staging URL above with `https://milky-way-trader.pages.dev` and use the production Supabase project's callback. In Supabase Auth, set the Site URL to the primary origin for that environment, enable Google, and add the matching Google OAuth client ID and secret. The game sends `redirectTo: window.location.origin`; every origin used for sign-in must therefore be listed exactly in that environment's Supabase Auth redirect URLs. Do not add wildcard origins.

Deploy and verify test before production. The owner runs the commands with the intended project reference, then records only the public outcomes using [Telemetry release verification](telemetry-release-verification.md):

```powershell
supabase db push --project-ref <test-project-ref>
supabase secrets set TELEMETRY_ALLOWED_ORIGINS='http://localhost:8080,https://staging.milky-way-trader.pages.dev' --project-ref <test-project-ref>
supabase functions deploy ingest-game-events --project-ref <test-project-ref> --no-verify-jwt
```

Enter secret values directly in a trusted terminal or dashboard; never paste them into a repository file, issue, test result, or chat transcript.

Before collecting public telemetry, the owner must provide any privacy notice, consent mechanism, lawful basis, and other obligations required in the jurisdictions where the game is offered. This repository cannot determine or satisfy those obligations on the owner’s behalf.
