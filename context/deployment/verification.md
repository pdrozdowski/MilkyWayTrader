# First deployment verification

Data: 2026-09-17. Zakres: starter Phaser, Cloudflare Pages Direct Upload, przygotowanie Supabase/Google OAuth i GitHub Actions.

**Stan: przygotowanie lokalne zakończone; publikacja i konfiguracja kont oczekują na dostęp.** Nie wykonano deploymentu Cloudflare ani utworzenia projektów Supabase/Google. Nie potwierdzono zdalnego uruchomienia GitHub Actions.

## Wersje

| Narzędzie | Wersja |
| --- | --- |
| Node | 24.21.0 |
| npm | 11.19.0 |
| Phaser | 4.0.0 |
| Vite | 6.4.3 (wcześniej 6.3.2) |
| TypeScript | 5.7.3 |
| Wrangler | 4.133.0 |
| Rollup | 4.63.3 |

`npm audit fix` bez `--force` usunął pięć HIGH (Vite i zależności przechodnie). Główne wersje stosu zachowane; lockfile obejmuje również Wrangler.

## Sprawdzenia wykonane

| Kontrola | Wynik |
| --- | --- |
| Czysta instalacja `npm ci --cache .cache/npm` | PASS |
| `npm run typecheck` | PASS |
| `npm audit --audit-level=high`, po instalacji Wranglera | PASS; 0 podatności |
| `npm run build-nolog` | PASS; wynik `dist/` |
| `npm run check:pages` | PASS; 7 plików, 1 683 962 bajty łącznie, największy 1 352 388 bajtów |
| Negatywny test pliku większego niż 25 MiB | PASS; publikacja blokowana |
| Parsowanie YAML workflow | PASS |
| Wybór celu: main push, zaufany PR, fork PR, manual staging, manual production z main | PASS |
| Odrzucenie production z feature oraz nieoczekiwanego pushu feature | PASS |
| Nazwa repozytorium z tekstem przypominającym polecenie shell | PASS; bez wykonania, bez publikacji |
| Brak credentials w kroku publikacji | PASS; zakończenie przed wywołaniem Wranglera |
| Token Cloudflare tylko w kroku publikacji, brak `pull_request_target`, checkout bez credentials | PASS; inspekcja YAML |
| Ignorowanie `.env.deploy.local`, `.env.local`, `.cache/` | PASS; `git check-ignore` |
| `.env.example` nie jest ignorowany | PASS |
| Polecenia Wrangler Pages project create/deploy i flaga `--env-file` | PASS; lokalne `--help` |

Workflow sprawdzono lokalnie przez parsowanie YAML i wykonanie rzeczywistego skryptu wyboru celu w Git Bash dla ośmiu scenariuszy. To nie jest test wykonania workflow w GitHub. PR z tego repozytorium są traktowane jako zaufane; PR z forka nie uruchamia kroku z tokenem Cloudflare.

Typecheck i audyt przeszły w sandboxie. Domyślny loader konfiguracji Vite/esbuild nie mógł odczytać katalogów nadrzędnych w sandboxie Windows; identyczna pełna walidacja po zatwierdzonej eskalacji przeszła bez zmian konfiguracji aplikacji. Nie wyłączano TLS; npm korzystał z systemowego magazynu CA.

## Przeglądarki — lokalny build produkcyjny

URL: `http://127.0.0.1:8081/`, Vite preview z istniejącą konfiguracją i natywnym loaderem. Zainstalowane przeglądarki uruchomione headless z programowym WebGL. Przejścia Main Menu → Game → Game Over → Main Menu oraz odświeżenie sprawdzone; zrzuty potwierdzają sceny. Brak błędów JS/konsoli, nieudanych requestów i odpowiedzi HTTP >= 400.

| Przeglądarka | Wersja | Wynik |
| --- | --- | --- |
| Chrome | 152.0.7977.84 | PASS |
| Edge | 153.0.4234.32 | PASS |

Tymczasowe narzędzia QA i zrzuty: `.cache/browser-qa/` (ignorowane). Nie dodano Playwright jako zależności aplikacji. Wbudowana przeglądarka nie była dostępna z powodu błędu połączenia narzędzia (`sandboxPolicy`); użyto lokalnych przeglądarek.

## Wdrożenie — do uzupełnienia po udostępnieniu dostępu

| Pole | Stan |
| --- | --- |
| Cloudflare Account ID | Nie zapisano; publiczny identyfikator do wprowadzenia lokalnie i w Actions Variables |
| Pages project / production branch | Planowane: `milky-way-trader` / `main`; nie utworzono |
| Production URL | Brak; odczytać rzeczywisty z Cloudflare |
| Staging URL / alias | Brak; odczytać po preview |
| Production deployment ID / czas UTC / commit | Brak; deployment nie wykonany |
| Supabase prod / test refs | Brak; projekty nie utworzone |
| Region Supabase | Planowany Frankfurt `eu-central-1`; dostępność nie potwierdzona |
| Google OAuth prod / test | Konfiguracja oczekuje na konta |
| GitHub Actions Secrets / Variables | Nie skonfigurowano |
| GitHub Actions run / URL / status | Brak; nie uruchomiono zdalnie |
| HTTPS i Chrome/Edge na preview oraz produkcji | Oczekuje na publikację |
| Rollback | Procedura w README; brak wcześniejszego deploymentu do wykonania rollbacku |

Po publikacji zapisać wyłącznie publiczne identyfikatory, adresy i wyniki. Nigdy tokeny, client secret ani hasła baz. Konfiguracja OAuth nie oznacza działającego loginu w starterze.

## Git

Istniejące zmiany użytkownika w `.agents/`, dokumentach foundation, `AGENTS.md` i `docs/` zachowane. Selektywny staging obejmuje wyłącznie 10 plików wdrożeniowych i zależności, bez zastępowania `.git/`, resetu, stasha ani force push. `AGENTS.md` i `tech-stack.md` zawierały już lokalne zmiany użytkownika; aktualizacja wskazówek o CI i wersji Vite pozostaje poza selektywnym commitem, żeby nie dołączać wcześniejszych zmian.

Przygotowano ignorowany lokalny `.env.deploy.local` z pustymi polami do uzupełnienia przez użytkownika. Nie wprowadzono żadnego sekretu. W sandboxie logi Wrangler skierowano do `.cache/wrangler/logs` przez `WRANGLER_LOG_PATH`; polecenie wersji działa bez próby zapisu w globalnym profilu.

Push wymaga osobnej jawnej zgody według `AGENTS.md`. Nie wykonano pushu.
