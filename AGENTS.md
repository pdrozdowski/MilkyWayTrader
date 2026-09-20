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

## Lessons learned

Zobacz: `context/foundation/lessons.md`. Czytaj przed planowaniem/implementacją. Nowe wpisy dopisuj na końcu; istniejących nie zmieniaj ani nie usuwaj.

## Development and validation

- `npm.cmd run dev-nolog`: port 8080.
- `npm.cmd run build-nolog`: `dist/`.
- `npx.cmd --no-install tsc --noEmit`: typecheck; build go nie wykonuje.
- `npm.cmd run test:project`: wszystkie testy jednostkowe, architektury i UI Playwright.
- Pełna diagnostyka: @.agents/skills/cicd-run-tests/SKILL.md; naprawa raportu: @.agents/skills/cicd-fix-tests/SKILL.md.

Po zmianach kodu: build, typecheck, ręczna weryfikacja interakcji. Wybieraj `-nolog`: skrypty `dev`/`build` @package.json uruchamiają @log.js wysyłający żądanie do `gryzor.co`. Brak lint/format. `npm.cmd run validate:deployment`: typecheck, audyt HIGH/CRITICAL, build i limity Pages Free. Workflow: @.github/workflows/deploy.yml. Publikacja i konta: @context/deployment/README.md; lokalne poświadczenia w ignorowanym `.env.deploy.local`.

## Layout and conventions

Game audio: use `/utils-add-sound` ([skill](.agents/skills/utils-add-sound/SKILL.md)); definitions in `src/game/audio/definitions/`, recordings in `public/assets/audio/<sound-id>/`. Effects use scene/object-owned `AudioScope` instances; persistent music is game-owned.

Start: @src/main.ts; konfiguracja: @src/game/main.ts. Sceny: `src/game/scenes/`, wzorzec @src/game/scenes/gameScene.ts: nazwane eksporty, PascalCase, cztery spacje, pojedyncze cudzysłowy importów. Wszystkie ręcznie utrzymywane pliki TypeScript używają lower camel case jak `thisKindOfNaming.ts`; klasy, interfejsy i typy pozostają PascalCase. Moduły scen kończą się na `Scene.ts`. Zasoby: `public/assets/`; style: @public/style.css; konfiguracja: @tsconfig.json, `vite/`; dokumentacja: @README.md.scaffold.

Warstwy: domena/aplikacja/świat/mechanika są niezależne od Phaser i DOM; sceny składają systemy; wizualizacje obiektów i ich efekty należą do modułów obiektów; efekty całej sceny są w `src/game/effects/`; wspólne renderowanie w `src/game/visual/`; UI DOM w `src/ui/`. Szczegóły: @context/foundation/architecture.md.

Obiekty: `src/game/objects/<id>/` (klasa i `definition.ts`); grafiki: `public/assets/objects/<id>/`; współdzielone kontrakty: `src/game/objects/_shared/`. Preloader odkrywa definicje automatycznie. Rozmieszczenie demo: @src/game/scenes/gameObjects.ts. Dodawanie: @.agents/skills/utils-add-object-to-scene/SKILL.md; domyślna scena `gameScene.ts`. Statek jest celem kamery; obiekty świata pozostają we współrzędnych świata.

## Stack gaps

Demo; brak logowania Google OAuth/zapisów/ekonomii/backendu. Konfiguracja Cloudflare Pages/GitHub Actions przygotowana; status publikacji: @context/deployment/verification.md. ESLint pozostaje planem; Playwright obsługuje testy UI. API Phaser 4. Historyczny audyt/obejścia certyfikatów: @context/changes/bootstrap-verification/verification-v2.md.

<!-- BEGIN @przeprogramowani/10x-cli -->

## Router workflow 10x

Czytaj `SKILL.md` w `.agents/skills/<nazwa>/`:

- Instrukcje: `/10x-agents-md`; przegląd: `/10x-rule-review <path>`; lekcje: `/10x-lesson`.
- Fundamenty: `/10x-init`, `/10x-shape`, `/10x-prd`; walidacja PRD: `/10x-prd-en-capability`.
- Stos: `/10x-tech-stack-selector`, `/10x-stack-assess`, `/10x-health-check`, `/10x-bootstrapper`.
- Platforma: `/10x-infra-research`.

Wdrożenie: plan `context/deployment/deploy-plan.md` na podstawie `context/foundation/infrastructure.md` i `context/foundation/tech-stack.md`; wykonanie po zatwierdzeniu. Plan Mode to tryb hosta.
Dokumentacja: @docs/reference/10x-agent-workflow.md; lekcja 5: @docs/reference/10x-infrastructure-workflow.md.

<!-- END @przeprogramowani/10x-cli -->
