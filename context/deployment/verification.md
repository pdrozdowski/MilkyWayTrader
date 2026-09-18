# First deployment verification

Data: 2026-09-17. Zakres: starter Phaser, Cloudflare Pages Direct Upload, przygotowanie Supabase/Google OAuth i GitHub Actions.

**Stan: frontend wdrożony na Cloudflare Pages; GitHub Actions zakończone sukcesem.** Preview i produkcja sprawdzone przez HTTPS w Chrome i Edge. Przygotowanie Supabase/Google OAuth nadal oczekuje na potwierdzenie konfiguracji kont przez użytkownika; nie wdrożono integracji logowania ani zapisów.

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

## Wdrożenie — wynik zdalny

| Pole | Stan |
| --- | --- |
| Cloudflare Account ID | Dostępny lokalnie i w Actions Variables; wartości nie kopiowano do raportu |
| Pages project / production branch | `milky-way-trader` / `main`; utworzony przez Wrangler jako Pages Direct Upload |
| Production URL | https://milky-way-trader.pages.dev/ |
| Staging URL / alias | https://staging.milky-way-trader.pages.dev/ |
| Production deployment ID / czas UTC / commit | `c80fa649-65d8-4b89-9d97-a2534e0194b0` / `2026-09-17T15:47:25.632171Z` / `ced3d25c412ccc6d0f6fa3483b28e13702f14607` / dirty=false |
| Production deployment URL | https://c80fa649.milky-way-trader.pages.dev |
| Staging deployment ID / czas UTC / commit | `0e013ecc-7dcd-4650-8810-bbb31ceede92` / `2026-09-17T15:46:05.062703Z` / `ced3d25c412ccc6d0f6fa3483b28e13702f14607` / dirty=true (lokalne zmiany dokumentów użytkownika) |
| Supabase prod / test refs | Nie udostępniono; konfiguracja niezweryfikowana |
| Region Supabase | Planowany Frankfurt `eu-central-1`; dostępność nie potwierdzona |
| Google OAuth prod / test | Konfiguracja niezweryfikowana; oczekuje na potwierdzenie użytkownika |
| GitHub Actions Secrets / Variables | PASS; workflow odczytał token i Account ID oraz opublikował produkcję |
| GitHub Actions run / URL / status | https://github.com/pdrozdowski/MilkyWayTrader/actions/runs/35242052005 / próba 2: success / job `105274078599` |
| HTTPS i Chrome/Edge na preview oraz produkcji | PASS; przejścia scen, odświeżenie, brak błędów konsoli i zasobów |
| Rollback | Procedura w README; produkcyjny deployment `c80fa649-65d8-4b89-9d97-a2534e0194b0` jest pierwszym punktem odniesienia dla przyszłego rollbacku |

Pierwsze uruchomienie Actions: instalacja i walidacja PASS, publikacja FAIL. Odczyt Cloudflare API potwierdził brak docelowego projektu Pages. Po utworzeniu projektu i publikacji staging ponowiono nieudane zadanie przez GitHub API; próba 2 zakończyła się sukcesem we wszystkich krokach. Dane deploymentów potwierdzono odczytem Cloudflare API; etap `deploy` ma status success.

Wrangler 4.133.0 wykrywa kontekst agenta i dla nowego projektu Pages może delegować operację do Workers. Pierwsze `pages project create` zgłosiło błąd entry-point. Inspekcja kodu potwierdziła, że `--force` w tej komendzie wyłącza delegację, nie usuwa ani nie nadpisuje projektu. Użyto flagi wyłącznie przy tworzeniu brakującego projektu; kolejne deploymenty Pages bez niej. Instrukcję uzupełniono w README.

Zdalne testy przeglądarek wykonano na stabilnych adresach staging i produkcji. Wyniki oraz zrzuty: `.cache/browser-qa/browser-results-staging.json`, `.cache/browser-qa/browser-results-production.json`, `.cache/browser-qa/screenshots/{staging,production}/`. Chrome 152.0.7977.84 i Edge 153.0.4234.32: oba środowiska PASS, bez błędów JS, błędów konsoli, nieudanych requestów i odpowiedzi HTTP >= 400. Certyfikaty HTTPS sprawdzane; nie używano ignoreHTTPSErrors.

Po publikacji zapisać wyłącznie publiczne identyfikatory, adresy i wyniki. Nigdy tokeny, client secret ani hasła baz. Konfiguracja OAuth nie oznacza działającego loginu w starterze.

## Git

Istniejące zmiany użytkownika w `.agents/`, dokumentach foundation, `AGENTS.md` i `docs/` zachowane. Selektywny staging obejmuje wyłącznie 10 plików wdrożeniowych i zależności, bez zastępowania `.git/`, resetu, stasha ani force push. `AGENTS.md` i `tech-stack.md` zawierały już lokalne zmiany użytkownika; aktualizacja wskazówek o CI i wersji Vite pozostaje poza selektywnym commitem, żeby nie dołączać wcześniejszych zmian.

Użytkownik uzupełnił ignorowany lokalny `.env.deploy.local`; wartości odczytywano wyłącznie w pamięci procesów, bez wyświetlania. W sandboxie logi Wrangler skierowano do `.cache/wrangler/logs` przez `WRANGLER_LOG_PATH`; polecenie wersji działa bez próby zapisu w globalnym profilu.

Użytkownik jawnie zatwierdził `git push origin main` odpowiedzią „okay”. Commit `ced3d25` przesłano do origin/main. Pierwszy push przerwał błąd zaufania OpenSSL; ponowienie przez `git -c http.sslBackend=schannel push origin main` przeszło z użyciem systemowego magazynu certyfikatów Windows, bez wyłączania TLS. Historia nie została przepisana; zmiany użytkownika pozostają w drzewie roboczym.

Wyniki zdalnej weryfikacji i aktualizacja instrukcji są nowymi lokalnymi zmianami dokumentacji po wdrożeniu; nie wykonywano dodatkowego pushu tylko dla raportu.

## Wydanie wyglądu — 2026-09-17

Użytkownik zatwierdził publikację bieżącego wyglądu na produkcję. Selektywny commit `ee424b4033da8014fb7b77a6e6233dc0fbd55c05` obejmuje `MainMenu.ts` (aktualna pozycja logo Y=350), skrócenie tekstu w `Game.ts` oraz nowe `public/assets/bg.png` i `public/assets/logo.png`. Pozostałe lokalne zmiany nie weszły do wydania. Push wykonany od pierwszej próby z `http.sslBackend=schannel`.

- GitHub Actions: https://github.com/pdrozdowski/MilkyWayTrader/actions/runs/35244210159 — success; job `105280099756`.
- Produkcja: https://milky-way-trader.pages.dev/.
- Deployment: `bc55ac2c-35a3-49e3-9def-ae95e3b39069`, utworzony `2026-09-17T16:04:12.238649Z`, deploy success, branch main, właściwy SHA commita, dirty=false.
- Niezmienny adres deploymentu: https://bc55ac2c.milky-way-trader.pages.dev.
- Lokalna walidacja: typecheck, audyt (0 podatności), build i limity Pages PASS; 7 plików, 2 569 837 bajtów łącznie, największy 1 352 388 bajtów.
- Chrome 152.0.7977.84 i Edge 153.0.4234.32: lokalny build i produkcja PASS; przejścia scen i odświeżenie bez błędów JS/konsoli, requestów i HTTP >= 400.
- Grafiki pobrane z produkcyjnego adresu mają SHA-256 zgodne z plikami lokalnymi; wygląd menu potwierdzony zrzutem ekranu produkcji.
- Zrzuty i wyniki QA: `.cache/browser-qa/screenshots/release-production/`, `.cache/browser-qa/browser-results-release-production.json`.
- Cel rollbacku w razie potrzeby: poprzedni deployment produkcyjny `c80fa649-65d8-4b89-9d97-a2534e0194b0`.

Raport uzupełniony lokalnie po wydaniu; nie przesyłano dodatkowego commita dokumentacyjnego uruchamiającego kolejny deployment.
