# S-10 Player Sign-in, Status, and Telemetry Implementation Plan

## Overview

Add Google sign-in, visible authentication status, local-session sign-out, and bounded Supabase telemetry. The game remains fully playable as **Unsigned**. Saves, personal results, and score submission remain unavailable until authentication; future public high-score viewing remains available to all players.

## Current State Analysis

The static Phaser/Vite app has no Supabase SDK integration, telemetry client, Edge Function, database schema, or migrations. `GameStateProvider` owns gameplay state and publishes every simulation frame, so telemetry cannot observe it generically. Existing semantic seams cover new game, successful land/launch/trade, and explicit return to menu.

## Desired End State

Every new gameplay run gets a UUID `session_id`; every event also contains a persistent browser `anonymous_id`; authenticated events additionally receive a server-derived `user_id`. A controlled Supabase Edge Function validates low-frequency event batches and writes them to the single `game_events` table. The database generates event IDs and timestamps, and deletes raw events after 90 days.

## What We're NOT Doing

- Snapshot persistence, save/resume, personal results, or score submission.
- Direct browser access to `game_events`.
- Email, OAuth token, IP/region, location, fingerprint, free-text, raw user-agent, or device-model collection.
- Per-frame, input, movement, clock-tick, or held-control telemetry.
- Guaranteed delivery after tab close, crash, or network failure.

## Implementation Approach

Keep auth and telemetry as independent application services outside `GameStateSnapshot`. The browser stores one `anonymous_id` in `localStorage`, keeps each `session_id` and a bounded queue only in memory, and sends allowlisted semantic events to an Edge Function. The function validates requests, derives the optional user from a verified JWT, and inserts via its server-side secret. Browser roles have no privileges on the table.

## Critical Implementation Details

Register the Supabase auth-state listener at client creation for OAuth callback handling; use `signOut({ scope: 'local' })` explicitly. Generate IDs with `crypto.randomUUID()`. Emit `session_started` at exactly one new-game transition, and `session_ended` only for deterministic in-app exits/terminal flows. Page unload is best effort only.

The anonymous-capable Edge Function must not rely on JWT-only platform gating. It validates optional bearer JWTs itself, never trusts client `user_id`, and keeps its database secret solely in the Supabase Function secret store.

## Phase 1: Auth boundary and unsigned UI

### Changes Required:

#### 1. Browser Supabase configuration and auth service

**Files**: `package.json`, `src/viteEnv.d.ts`, `.env.example`, Vite configuration, new `src/game/application/auth/` modules.

**Intent**: Add the browser SDK, public typed configuration, a build-time game version, and a lifecycle-safe auth port.

**Contract**: Public URL/key missing or malformed produces unavailable state and never starts OAuth/telemetry. Auth state is `unavailable`, `unsigned`, `signed-in`, or `error`; it exposes immutable read/subscribe, Google sign-in, local sign-out, and idempotent destroy. Signed-in state carries the verified session email.

#### 2. Main menu, header, and game-menu auth controls

**Files**: `index.html`, `public/style.css`, `src/ui/setupUi.ts`, `src/ui/contracts.ts`, auth UI component/adapter, `src/ui/components/gameMenu.ts`.

**Intent**: Make sign-in/status/sign-out available without restricting anonymous play.

**Contract**: Main menu offers Google sign-in; header shows `Unsigned` or email; game menu offers sign-out only when signed in. Missing configuration disables the action with clear guidance. Unsigned state allows gameplay and future public score viewing but gates future save/resume, personal history/best, and score submission. Controls use `data-game-input="ignore"`; all handles unsubscribe on destruction.

### Success Criteria:

#### Automated Verification:

- Auth and UI tests cover unavailable, unsigned, signed-in, action-error, local sign-out, accessibility, and teardown states.
- `npm.cmd run typecheck` passes with public environment declarations and SDK types.

#### Manual Verification:

- An Unsigned player can play normally; a signed-in player sees email and can sign out without losing local gameplay.

---

## Phase 2: Telemetry schema, function, and retention

### Changes Required:

#### 1. Versioned Supabase migration

**Files**: new `supabase/migrations/` migration(s).

**Intent**: Provide one extensible, queryable event store and limit raw analytics retention.

**Contract**: Create `public.game_events` with database-generated `id` and UTC `created_at`; `anonymous_id uuid not null`; `user_id uuid null` referencing `auth.users(id)`; `session_id uuid not null`; bounded `event_name`; object-only `event_data jsonb not null default '{}'::jsonb`; bounded `game_version`; and `platform` constrained to `desktop`/`mobile`. Add indexes on event time, session, anonymous ID, user ID, and event name. Enable RLS with no anon/auth browser policies for select/insert/update/delete. Provision a daily, batched Supabase Cron cleanup of rows older than 90 days.

#### 2. Controlled Edge Function ingestion

**Files**: new `supabase/functions/ingest-game-events/`, `supabase/config.toml`, deployment documentation.

**Intent**: Permit analytics from Unsigned and authenticated clients without exposing the table for unrestricted browser writes.

**Contract**: Accept only bounded batches of `anonymous_id`, `session_id`, `event_name`, `event_data`, `game_version`, and `platform`; reject client `id`, `created_at`, and `user_id`. Validate UUIDs, CORS origin, allowlisted event name, object payload/size, and batch size. Verify an optional bearer JWT and derive `user_id`; insert only through the function secret. Return non-sensitive accepted/rejected results and log no secrets.

#### 3. Privacy and operational record

**Files**: telemetry/deployment documentation.

**Intent**: Make data purpose, retention, access, and deployment constraints explicit.

**Contract**: Document analytics/progression/drop-off purpose, 90-day retention, no geo/fingerprint policy, identity model, administrator-only analysis access, test/prod migration/function deployment, and the owner’s responsibility to meet applicable privacy notice/consent obligations before public collection.

### Success Criteria:

#### Automated Verification:

- Test-project migration checks verify table fields/defaults/constraints, RLS denial, and the retention job.
- Function tests accept valid anonymous/authenticated batches and reject forged user IDs, malformed/oversized payloads, unknown/high-frequency event names, invalid UUIDs, and disallowed origins.

#### Manual Verification:

- Browser network confirms the Edge Function is the only telemetry destination and no secret/forbidden personal data is sent.
- Database inspection confirms database-generated IDs/timestamps, null user IDs for unsigned events, and JWT-derived IDs for authenticated events.

---

## Phase 3: Session identity and low-frequency event capture

### Changes Required:

#### 1. Telemetry service and identity lifecycle

**Files**: new `src/game/application/telemetry/` modules; composition in `src/main.ts` and `src/ui/setupUi.ts`.

**Intent**: Associate events with one browser installation and one gameplay run without modifying authoritative game state.

**Contract**: Create/store `anonymous_id` on first visit and reuse it until storage is cleared. Create a new `session_id` only at successful new-game start. Each event includes both. Query auth at send time so pre-sign-in events remain null-user and later events in the same session carry server-derived user ID; never backfill. Queue/batch only low-frequency events in memory, enforce a capacity limit, drop on failure without blocking/retrying gameplay, and clean up listeners.

#### 2. Initial event catalog and emitters

**Files**: `src/game/scenes/mainMenuScene.ts`, `src/game/scenes/gameScene.ts`, `src/ui/adapters/landingStatusAdapter.ts`, telemetry service.

**Intent**: Capture the first actionable funnel without recording simulation noise.

**Contract**: Emit one `session_started` containing session start timestamp, starting credits, game version, and platform. Emit `session_ended` only for explicit in-app exit/future terminal paths with duration and final credits. Emit `planet_landed` after successful landing, `planet_launched` after successful launch, and `commodity_bought`/`commodity_sold` after successful trades with planet, commodity, quantity, price/total, and credits after. Never emit invalid actions, previews, controls, frames, movement, or ticks. Add terminal events only when terminal transitions exist.

#### 3. Platform dimension

**Files**: telemetry service.

**Intent**: Supply a coarse analytics dimension without fingerprinting.

**Contract**: Determine platform once per session as `mobile` from an agreed coarse capability signal; otherwise `desktop`. Do not store user agent, screen size, model, or country/region.

### Success Criteria:

#### Automated Verification:

- Telemetry tests cover anonymous ID reuse, new session ID per run, auth correlation, immutable event payloads, bounded queue/drop behavior, and teardown.
- Event tests prove successful semantic actions emit once and invalid/no-op/frame activity emits none.
- UI/application tests prove telemetry failures never block starting, playing, landing, launch, trade, sign-in, or sign-out.

#### Manual Verification:

- Two runs reuse anonymous ID but differ in session ID; clearing storage creates a new anonymous ID.
- Pre-sign-in and post-sign-in rows correlate by anonymous/session ID without retroactive user assignment.

---

## Phase 4: External setup and release verification

### Changes Required:

#### 1. User-managed Supabase/Google setup

**Files**: ignored `.env.local`, Supabase and Google dashboards.

**Intent**: Enable the real OAuth, migration, function, secret, Cron, and supported-origin tests without committing credentials.

**Contract**: Configure test Supabase and Google OAuth projects with exact localhost/staging redirects; deploy migrations/function; configure allowed origins and function secrets; set only public URL/key in `.env.local`. Google/function secrets stay in platform secret stores.

#### 2. Integrated browser verification

**Intent**: Prove the credentialed auth and telemetry path in environments CI cannot safely emulate.

**Contract**: Verify signed-in/unsigned ingestion, direct-table RLS denial, cleanup-job registration, OAuth callback/refresh/local sign-out, and cancelled/failed OAuth on localhost/staging. Record public outcomes only.

### Success Criteria:

#### Automated Verification:

- `npm.cmd run test:project` passes.
- `npm.cmd run typecheck` passes.
- `npm.cmd run build-nolog` passes.

#### Manual Verification:

- OAuth works on localhost/staging; unsigned and authenticated sessions produce only correctly attributed allowlisted events through the Edge Function.
- Retention is registered and inspection confirms no secret or forbidden telemetry data is stored.

## Migration Notes

This introduces the first Supabase migration and Edge Function. Apply and test them in the dedicated test project before production; frontend rollback does not undo database changes. No gameplay snapshot migration is introduced. The 90-day job deletes raw telemetry only and is not a future account-data deletion policy.

## References

- `context/foundation/architecture.md:7`
- `context/deployment/README.md:56`
- `src/game/application/gameStateProvider.ts:7`
- `src/game/scenes/mainMenuScene.ts:23`
- `src/ui/adapters/landingStatusAdapter.ts:85`
- [Supabase Edge Function authorization headers](https://supabase.com/docs/guides/functions/auth-headers)
- [Supabase Cron](https://supabase.com/docs/guides/cron)

## Progress

### Phase 1: Auth boundary and unsigned UI

#### Automated

- [x] 1.1 Auth and UI tests cover unavailable, unsigned, signed-in, action-error, local sign-out, accessibility, and teardown states.
- [x] 1.2 `npm.cmd run typecheck` passes with public environment declarations and SDK types.

#### Manual

- [x] 1.3 An Unsigned player can play normally; a signed-in player sees email and can sign out without losing local gameplay.

### Phase 2: Telemetry schema, function, and retention

#### Automated

- [ ] 2.1 Test-project migration checks verify table fields/defaults/constraints, RLS denial, and the retention job.
- [ ] 2.2 Function tests accept valid anonymous/authenticated batches and reject forged user IDs, malformed/oversized payloads, unknown/high-frequency event names, invalid UUIDs, and disallowed origins.

#### Manual

- [ ] 2.3 Browser network confirms the Edge Function is the only telemetry destination and no secret/forbidden personal data is sent.
- [ ] 2.4 Database inspection confirms database-generated IDs/timestamps, null user IDs for unsigned events, and JWT-derived IDs for authenticated events.

### Phase 3: Session identity and low-frequency event capture

#### Automated

- [x] 3.1 Telemetry tests cover anonymous ID reuse, new session ID per run, auth correlation, immutable event payloads, bounded queue/drop behavior, and teardown.
- [x] 3.2 Event tests prove successful semantic actions emit once and invalid/no-op/frame activity emits none.
- [x] 3.3 UI/application tests prove telemetry failures never block starting, playing, landing, launch, trade, sign-in, or sign-out.

#### Manual

- [ ] 3.4 Two runs reuse anonymous ID but differ in session ID; clearing storage creates a new anonymous ID.
- [ ] 3.5 Pre-sign-in and post-sign-in rows correlate by anonymous/session ID without retroactive user assignment.

### Phase 4: External setup and release verification

#### Automated

- [ ] 4.1 `npm.cmd run test:project` passes.
- [ ] 4.2 `npm.cmd run typecheck` passes.
- [ ] 4.3 `npm.cmd run build-nolog` passes.

#### Manual

- [ ] 4.4 OAuth works on localhost/staging; unsigned and authenticated sessions produce only correctly attributed allowlisted events through the Edge Function.
- [ ] 4.5 Retention is registered and inspection confirms no secret or forbidden telemetry data is stored.
