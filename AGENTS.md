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

Po zmianach kodu: build, typecheck, ręczna weryfikacja interakcji. Wybieraj `-nolog`: skrypty `dev`/`build` @package.json uruchamiają @log.js wysyłający żądanie do `gryzor.co`. Brak lint/format. `npm.cmd run validate:deployment`: typecheck, audyt HIGH/CRITICAL, build i limity Pages Free. Workflow: @.github/workflows/deploy.yml. Publikacja i konta: @context/deployment/README.md; lokalne poświadczenia w ignorowanym `.env.deploy.local`.

## Layout and conventions

Game audio: use `/utils-add-sound` ([skill](.agents/skills/utils-add-sound/SKILL.md)); definitions in `src/game/audio/definitions/`, recordings in `public/assets/audio/<sound-id>/`. Effects use scene/object-owned `AudioScope` instances; persistent music is game-owned.

Start: @src/main.ts; konfiguracja: @src/game/main.ts. Sceny: `src/game/scenes/`, wzorzec @src/game/scenes/gameScene.ts: nazwane eksporty, PascalCase, cztery spacje, pojedyncze cudzysłowy importów. Wszystkie ręcznie utrzymywane pliki TypeScript używają lower camel case jak `thisKindOfNaming.ts`; klasy, interfejsy i typy pozostają PascalCase. Moduły scen kończą się na `Scene.ts`. Zasoby: `public/assets/`; style: @public/style.css; konfiguracja: @tsconfig.json, `vite/`; dokumentacja: @README.md.scaffold.

Warstwy: domena/aplikacja/świat/mechanika są niezależne od Phaser i DOM; sceny składają systemy; wizualizacje obiektów i ich efekty należą do modułów obiektów; efekty całej sceny są w `src/game/effects/`; wspólne renderowanie w `src/game/visual/`; UI DOM w `src/ui/`. Szczegóły: @context/foundation/architecture.md.

Obiekty: `src/game/objects/<id>/` (klasa i `definition.ts`); grafiki: `public/assets/objects/<id>/`; współdzielone kontrakty: `src/game/objects/_shared/`. Preloader odkrywa definicje automatycznie. Rozmieszczenie demo: @src/game/scenes/gameObjects.ts. Dodawanie: @.agents/skills/utils-add-object-to-scene/SKILL.md; domyślna scena `gameScene.ts`. Statek jest celem kamery; obiekty świata pozostają we współrzędnych świata.

- Spatial state uses JSON-safe `Vector2State` fields. In Phaser scenes and objects, use `Phaser.Math.Vector2` arithmetic for positions, velocities, offsets and directions instead of parallel `x`/`y` variables; never persist Phaser instances.

## Stack gaps

Demo; brak logowania Google OAuth/zapisów/ekonomii/backendu. Konfiguracja Cloudflare Pages/GitHub Actions przygotowana; status publikacji: @context/deployment/verification.md. ESLint pozostaje planem; Playwright obsługuje testy UI. API Phaser 4. Historyczny audyt/obejścia certyfikatów: @context/changes/bootstrap-verification/verification-v2.md.

<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs — Moduł 2, Lekcja 5

Rozszerz cykl pojedynczej zmiany do pracy równoległej z użyciem **worktrees, delegowania ukierunkowanego na cel i orkiestracji wielu sesji**:

```
worktree per change -> /goal or your AI coding assistant in headless mode -> PR -> review -> merge
```

Lekcja koncentruje się na bezpiecznej przepustowości: izolowanych kontekstach, wyborze odpowiedniego trybu wykonania i ograniczaniu równoległości do możliwości przeglądu.

### Router zadań — od czego zacząć

| Umiejętność | Użyj jej, gdy |
| --- | --- |
| **Izolacja kodu** | |
| `git worktree add` | Potrzebujesz osobnego katalogu roboczego dla równoległej zmiany. Jedna zmiana na worktree, jeden świeży kontekst agenta na worktree. |
| **Złożone zmiany** | |
| `/10x-implement <change-id> phase <n>` | Zmiana ma wiele faz, wymaga ręcznych bramek lub korzysta z interaktywnego podejmowania decyzji podczas wykonania. |
| **Proste zmiany** | |
| `/goal` | Masz jasne, ograniczone zadanie i chcesz delegowania ukierunkowanego na cel. Agent pracuje autonomicznie w kierunku określonego celu z warunkiem zatrzymania. |
| twój asystent kodowania AI w trybie headless | Chcesz wykonania w trybie headless dla dobrze zdefiniowanego zadania. Pętla Ralpha Wigguma (uruchom, sprawdź, ponów próbę) jest uniwersalnym wzorcem autonomicznym. |
| **Orkiestracja wielu sesji** | |
| Superset / Conductor / Antigravity / VS Code Agent View | Uruchamiasz równolegle wiele sesji agentów i potrzebujesz widoczności, koordynacji lub zarządzania sesjami między nimi. |

### Zasady pracy równoległej

- Jedna zmiana na worktree lub izolowany obszar roboczy. Jeden świeży kontekst agenta na zmianę.
- Wybierz interaktywne `/10x-implement` dla złożonych zmian, a `/goal` lub swojego asystenta kodowania AI w trybie headless dla prostych.
- Równoległość jest ograniczona możliwościami przeglądu. Więcej agentów bez przeglądu oznacza więcej nieprzejrzanego kodu, a nie większą przepustowość.
- Problem jakości wynikający z szybszego dostarczania jest zamierzony — stanowi przejście do bramek testowych w Module 3.

### Granice lekcji

- Nie omawiaj ponownie interaktywnych `/10x-implement` ani `/10x-impl-review`; są one przedstawione w Lekcjach 2 i 3.
- Nie wprowadzaj tutaj strategii testowania. Problem jakości jest motywacją dla Modułu 3.
- Worktrees są mechanizmem izolacji, a nie tematem pełnego samouczka git.

### Ścieżki używane w tej lekcji

- `context/changes/<change-id>/` - folder aktywnej zmiany
- `context/changes/<change-id>/plan.md` - dane wejściowe implementacji dla dowolnego trybu wykonania

Umiejętności nie mogą zapisywać w `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozwiązana ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: "Ta zmiana jest zarchiwizowana. Zamiast tego otwórz nową zmianę za pomocą `/10x-new`."

<!-- END @przeprogramowani/10x-cli -->
