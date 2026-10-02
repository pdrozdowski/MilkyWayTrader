# Repository Guidelines

MilkyWayTrader: gra przeglądarkowa; Phaser 4.0.0, Vite 6.4.3, TypeScript 5.7.3; Wrangler 4.133.0.

<!-- BEGIN PROJECT CODEX PERMISSIONS -->

## Codex permissions

Native configuration: [.codex/config.toml](.codex/config.toml).
Command rules: [.codex/rules/project.rules](.codex/rules/project.rules).

- Reading, editing and creating project files, npm/npx/Node commands, and Git add, commit, diff, log, status, branch, checkout and stash are permitted without additional task-level confirmation when needed for the user's request.
- Ask the user before running curl, wget or git push, including git push without arguments.
- Never run recursive forced removal with rm, including equivalent flag combinations, or conceal a prohibited command inside a script or an allowed command.
- These are standing permissions for authorized tasks; they do not instruct the agent to commit, switch branches or run commands without a task reason.
- Shell rules govern escalation outside the sandbox. Sandbox permissions, protected paths and administrator-enforced restrictions still apply.

<!-- END PROJECT CODEX PERMISSIONS -->

## Project rules

- Zachowuj historię Git i zmiany użytkownika; nigdy nie zastępuj głównego `.git/`.
- Zakres: @context/foundation/prd.md; rozstrzyga konflikty z @context/foundation/tech-stack.md i starszymi założeniami @context/foundation/shape-notes.md.
- Każde utworzenie lub zmiana @context/foundation/prd.md — także bezpośrednia edycja przez `@prd` — wymaga @.agents/skills/10x-prd-en-capability/SKILL.md i kończy się dopiero po przejściu jego walidacji deterministycznej oraz przeglądu semantycznego.
- Bootstrap zachowuje `context/`.
- Zarchiwizowane zmiany są niezmienne. Przy docelowej ścieżce w `context/archive/` przerwij: „This change is archived. Open a new change with `/10x-new` instead.”
- Architektura i kierunek zależności: @context/foundation/architecture.md. Zasady testów: @context/foundation/testing.md. Ekonomia pozostaje czystym TypeScript i jest niezależna od Phaser/DOM.
- Po utworzeniu nowego skilla projektu uruchom @.agents/skills/utils-refine-skill/SKILL.md; zaakceptuj skill dopiero po ponownej walidacji i braku ustaleń HIGH/MEDIUM.
- Tokeny: tylko potrzebne operacje/projekt; bez administracji/rozliczeń. Sekrety: zmienne środowiskowe, nigdy repozytorium, commitowany `.mcp.json` ani rozmowa.
- Produkcję zmieniaj po zatwierdzeniu planu. Produkcyjne bazy/projekty usuwa i główny sekret rotuje użytkownik ręcznie.

- Every authoritative game-state, clock, timer, lifecycle, snapshot, save, or restore change requires @.agents/skills/utils-add-state/SKILL.md. Generate architecture artifacts only when a task explicitly requests them.

## Lessons learned

Zobacz: `context/foundation/lessons.md`. Czytaj przed planowaniem/implementacją. Nowe wpisy dopisuj na końcu; istniejących nie zmieniaj ani nie usuwaj.

## Development and validation

- `npm.cmd run dev-nolog`: port 8080.
- `npm.cmd run build-nolog`: `dist/`.
- `npx.cmd --no-install tsc --noEmit`: typecheck; build go nie wykonuje.
- `npm.cmd run test:project`: wszystkie testy jednostkowe, architektury i UI Playwright.
- Pełna diagnostyka: @.agents/skills/cicd-run-tests/SKILL.md; naprawa raportu: @.agents/skills/cicd-fix-tests/SKILL.md.

Po zmianach kodu wybieraj walidację zgodnie z sekcją **Test selection**. Pełne `test:ci` / `validate:deployment` pozostaje bramką release; wybieraj `-nolog`, ponieważ skrypty `dev`/`build` uruchamiają `log.js` wysyłający żądanie do `gryzor.co`. Brak lint/format. Workflow: @.github/workflows/deploy.yml. Publikacja i konta: @context/deployment/README.md; lokalne poświadczenia w ignorowanym `.env.deploy.local`.

## Test selection

This section takes precedence over the generic post-change validation sentence above. Run the narrowest group that can detect the changed risk:

- `npm.cmd run test:domain`, `test:mechanics`, `test:objects`, or `test:audio` for the matching focused Node area.
- `npm.cmd run test:unit` for all product Node suites; `npm.cmd run test:fast` adds architecture checks for cross-cutting local changes.
- `npm.cmd run typecheck` for TypeScript/configuration changes.
- `npm.cmd run test:ui` only when the changed risk requires real browser behavior. It does not install Chromium; use `npm.cmd run playwright:install` (or `test:ui:install`) as an explicit one-time local setup step.
- `npm.cmd run test:ui` is test-only: it runs Vite in `test` mode, resets/migrates local Docker Supabase, and provisions isolated local sessions. Start Docker Supabase first; it deletes local Supabase data, never a remote project.
- `npm.cmd run dev-nolog` is normal development only: it loads `.env.local` and must retain the real Supabase/Google OAuth configuration. Never use `--mode test` for ordinary development or release checks.
- `npm.cmd run test:project` is the complete local automated test pipeline: fast tests, typecheck, then Playwright. It assumes dependencies and Chromium already exist.
- `npm.cmd run test:ci` / `validate:deployment` adds the dependency audit, production build and Pages checks. GitHub Actions always performs `npm ci`, then `npm run playwright:install:ci`, then this full pipeline.

Do not install dependencies or browsers as part of ordinary local validation.

Do not add skill, agent, generator, or other repository-tooling tests to the project test pipeline. Tooling is validated in its owning workflow when explicitly requested; `test:unit`, `test:fast`, `test:project`, `test:ci`, GitHub CI, and the end-of-turn hook cover product tests only.

## Layout and conventions

Game audio: use `/utils-add-sound` ([skill](.agents/skills/utils-add-sound/SKILL.md)); definitions in `src/game/audio/definitions/`, recordings in `public/assets/audio/<sound-id>/`. Effects use scene/object-owned `AudioScope` instances; persistent music is game-owned.

Start: @src/main.ts; konfiguracja: @src/game/main.ts. Sceny: `src/game/scenes/`, wzorzec @src/game/scenes/gameScene.ts: nazwane eksporty, PascalCase, cztery spacje, pojedyncze cudzysłowy importów. Wszystkie ręcznie utrzymywane pliki TypeScript używają lower camel case jak `thisKindOfNaming.ts`; klasy, interfejsy i typy pozostają PascalCase. Moduły scen kończą się na `Scene.ts`. Zasoby: `public/assets/`; style: @public/style.css; konfiguracja: @tsconfig.json, `vite/`; dokumentacja: @README.md.scaffold.

Warstwy: domena/aplikacja/świat/mechanika są niezależne od Phaser i DOM; sceny składają systemy; wizualizacje obiektów i ich efekty należą do modułów obiektów; efekty całej sceny są w `src/game/effects/`; wspólne renderowanie w `src/game/visual/`; UI DOM w `src/ui/`. Szczegóły: @context/foundation/architecture.md.

Obiekty: `src/game/objects/<id>/` (klasa i `definition.ts`); grafiki: `public/assets/objects/<id>/`; współdzielone kontrakty: `src/game/objects/_shared/`. Preloader odkrywa definicje automatycznie. Rozmieszczenie demo: @src/game/scenes/gameObjects.ts. Dodawanie: @.agents/skills/utils-add-object-to-scene/SKILL.md; domyślna scena `gameScene.ts`. Statek jest celem kamery; obiekty świata pozostają we współrzędnych świata.

- Spatial state uses JSON-safe `Vector2State` fields. In Phaser scenes and objects, use `Phaser.Math.Vector2` arithmetic for positions, velocities, offsets and directions instead of parallel `x`/`y` variables; never persist Phaser instances.

## Stack gaps

Demo; brak logowania Google OAuth/zapisów/ekonomii/backendu. Konfiguracja Cloudflare Pages/GitHub Actions przygotowana; status publikacji: @context/deployment/verification.md. ESLint pozostaje planem; Playwright obsługuje testy UI. API Phaser 4. Historyczny audyt/obejścia certyfikatów: @context/changes/bootstrap-verification/verification-v2.md.

<!-- BEGIN @przeprogramowani/10x-cli -->

## Playwright admission gate

Before adding or changing a Playwright test, assess the failure risk and choose the cheapest test level that gives a real regression signal. Use Playwright only when an important player journey or browser integration cannot be proven by unit, integration, component, or application tests.

A proposed Playwright test must record in its implementation plan, change description, or a short comment immediately above the test:

1. the player-visible failure scenario;
2. why a cheaper test level cannot expose it; and
3. the unique browser behavior it verifies.

After adding, removing, renaming, or changing a Playwright E2E test, invoke
`/utils-describe-e2e-scenarios` to refresh `context/foundation/e2e_scenarios.md`.

## Local Supabase Playwright setup

- `.env.test` is ignored and reserved for `test:ui`; it supplies only local Docker Supabase public settings plus `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`. Test scripts reject a non-loopback URL. `.env.local` remains the normal-development/release-like environment.
- `playwrightConfig.ts` invokes `tests/ui/globalSetup.ts`, which runs `node scripts/prepare-test-database.mjs` and therefore resets local Supabase from `supabase/migrations/`. Its global teardown sweeps abandoned session artifacts.
- New UI specs import `test` from `tests/ui/testSessionFixture.ts`, not `@playwright/test`. The default is an isolated anonymous session. Opt into a local programmatic authenticated session with `test.use({ testSessionMode: 'authenticated' })`; never automate Google OAuth.
- The fixture calls `node scripts/create-test-session.mjs anonymous` or `node scripts/create-test-session.mjs authenticated` before the test, injects the appropriate local browser storage, and calls `node scripts/cleanup-test-session.mjs` after it. Do not call these scripts directly inside individual test bodies or log their artifact/session values.
- The scripts obtain local-only admin access from the running Supabase CLI; do not add service-role keys to `.env.test`, `VITE_*`, source, or test output. Session artifacts, traces, and reports belong only under ignored `.cache/playwright/`.

Do not add Playwright tests for calculations, authoritative state transitions, validation, economy or cargo rules, serialization, telemetry, fake-port component rendering, listener cleanup, or implementation details. Cover those with fast tests at the appropriate lower level. Prefer one representative E2E journey over several overlapping UI checks. A test that does not pass this gate must not be introduced to the Playwright suite.

## Zestaw narzędzi AI 10xDevs — Moduł 3, Lekcja 4 (testy E2E)

**Only after a test passes the Playwright admission gate, use the two M3L4 skills in this order:**

1. **`/10x-e2e-setup`** — jednorazowa konfiguracja: konfiguracja Playwright (`webServer`,
   projekt `setup` autoryzacji, `storageState`), zielony test seed oraz `context/foundation/test-stack.md`.
2. **`/10x-e2e`** — pętla dla każdego ryzyka: ryzyko → eksploracja działającej aplikacji za pomocą
   `playwright-cli` → generowanie → przegląd względem pięciu antywzorców →
   ponowne wywołanie promptu po nazwie → weryfikacja przez celowe zepsucie.

Katalogi `references/` umiejętności zawierają pełne reguły, antywzorce, wzorzec seed oraz
szablon promptu.

Kilka twardych zasad obowiązujących jeszcze przed wywołaniem umiejętności:

- **Lokatory:** najpierw `getByRole` / `getByLabel` / `getByText`; `getByTestId`
  tylko wtedy, gdy atrybuty dostępności są niejednoznaczne. Nigdy selektory CSS, XPath
  ani struktura DOM.
- **Nigdy `page.waitForTimeout()`.** Czekaj na stan: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Niezależność testów + sprzątanie.** Każdy test uruchamia się samodzielnie — ma własną konfigurację,
  akcję, asercję i sprzątanie; unikalne id (sufiks timestamp), aby uruchomienia równoległe
  i ponowne uruchomienia nie kolidowały.

Dwie granice, które należy wyraźnie rozróżniać:

- **DOM (snapshot) jest domyślny.** Wizja (`--caps=vision`) jest uzupełnieniem dla
  ryzyk wyłącznie wizualnych (układ, z-index, animacja); w przypadku regresji pikselowych preferuj
  deterministyczne narzędzia (`toHaveScreenshot`, Argos, Lost Pixel). Wybór/koszt modelu VLM
  to temat debugowania (Lekcja 5), nie testowania.
- **Czerwony test to sygnał, a nie obowiązek do odhaczenia.** Zmieniony selektor → zaktualizuj
  lokator w sprawdzonym diffie. Zmienione zachowanie biznesowe → test wykrył
  błąd; nigdy nie edytuj asercji, aby je dopasować. Naprawianie nieudanych testów to Lekcja 5.

<!-- END @przeprogramowani/10x-cli -->
