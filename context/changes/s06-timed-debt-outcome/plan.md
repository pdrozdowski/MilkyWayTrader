# S-06 — wprowadzenie i zakończenie runu

## Overview

S-06 obejmuje wprowadzenie, start runu, zakończenie po czasie oraz wspólną prezentację timeoutu i istniejącej śmierci statku. Porzucanie runu, automatyczne zapisy aktywnej gry i resume należą do S-11.

## Current State Analysis

- „New Game” od razu tworzy stan runu i uruchamia sesję.
- Zegar zatrzymuje się na limicie, ale nie tworzy wyniku timeoutu.
- Stan terminalny, codec i ograniczenie bazy obsługują wyłącznie `death`.
- Kalkulator punktów, prezentacja składników wyniku i dostarczanie wyników już istnieją.
- Jeden ekran `GameOver` zawsze używa grafiki zniszczonego statku i wraca do menu po kliknięciu tła.
- Istnieją wszystkie trzy grafiki zakończeń; brakuje czterech ilustracji historii.

## Desired End State

Każde „New Game” pokazuje cztery plansze historii, następnie popup:

> Your debt is 1,000,000 credits.
> Reach a final score of at least 1,000,000 points within 30 minutes of active game time to win.

„Start Game” rozpoczyna run od 30:00. Plansze i popup nie tworzą nowego runu ani nie uruchamiają jego sesji telemetrycznej.

Po timeoutcie wynik ≥ 1 000 000 daje `freedom`, a niższy `imprisonment`. Zniszczenie przed timeoutem daje `death`. Gdy ostatni krok jednocześnie osiąga limit i niszczy statek, obowiązuje klasyfikacja punktowa, również przy zerowym HP.

Wszystkie trzy wyniki korzystają z istniejącego ekranu końcowego i obecnej prezentacji punktów.

### Key Discoveries

- Istniejący start resetuje stan i rozpoczyna sesję: `src/game/scenes/mainMenuScene.ts:35-64`.
- Mechanika i resolver terminalny obsługują tylko śmierć: `src/game/mechanics/gameSimulation.ts:78-83,253-254`; `src/game/mechanics/hazards/terminal.ts:3-14`.
- Wspólna punktacja już istnieje: `src/game/domain/finalScore.ts:18-28`.
- Ekran wyniku ma obecnie jedno tło i powrót przez kliknięcie: `src/game/scenes/gameOverScene.ts:20-47`.
- Codec v19 oraz oba adaptery powrotu po logowaniu walidują wyłącznie śmierć; rozszerzenie musi objąć wszystkie te granice.
- Wszystkie trzy tła są obecne w `public/assets`; cztery ilustracje wprowadzenia dostarcza użytkownik.

## What We're NOT Doing

- Obsługi porzucenia i wyniku `abandoned` — S-11.
- Automatycznego zapisu i wznawiania aktywnego runu — S-11.
- Generowania ilustracji historii.
- Zmiany formuły punktacji, ekonomii lub reguł rankingów.
- Publikacji produkcyjnej i migracji historycznych snapshotów.
- Tworzenia dodatkowych ekranów końcowych lub artefaktów architektury.

## Implementation Approach

Wprowadzenie będzie przejściowym komponentem DOM przed istniejącym zdarzeniem startu gry. Autorytatywne zakończenie pozostanie deterministyczną zmianą stanu przez `GameStateProvider`.

Mechanika otrzyma wstrzyknięty, czysty klasyfikator timeoutu korzystający z istniejącego kalkulatora punktów. Pozwoli to zachować granice zależności: mechanika nie importuje domeny ani aplikacji. Ten sam kalkulator i próg będą używane przy walidacji i prezentacji wyniku.

## Phase 1: Wyniki po czasie i ich zachowanie

### Overview

Rozszerzenie terminalizacji i zachowania wyników o timeout przy zachowaniu istniejącej ścieżki śmierci.

### Changes Required:

#### 1. Stan, terminalizacja i adaptery

**Files**: `src/game/state/terminalResultState.ts`, `src/game/application/gameStateCodec.ts`, `src/game/mechanics/gameSimulation.ts`, `src/game/mechanics/hazards/terminal.ts`, `src/game/application/results/terminalScoreResult.ts`, `src/ui/adapters/browserResultStore.ts`, `src/ui/adapters/browserAuthReturn.ts`, `src/ui/adapters/browserGameOverReturn.ts` oraz współdzielony klasyfikator punktacji.

**Intent**: Rozszerzyć istniejącą ścieżkę śmierci o dwa wyniki timeoutu.

**Contract**:

- Dopuszczalne wyniki S-06: `death`, `freedom`, `imprisonment`; pola wyniku pozostają niezmienione.
- `advanceGameSimulation` i resolver terminalny otrzymują czysty klasyfikator timeoutu. Produkcyjny klasyfikator pochodzi z aplikacji i korzysta ze wspólnej punktacji; wszystkie wywołania i testowe helpery dostarczają tę zależność.
- Po osiągnięciu limitu najpierw rozstrzygany jest timeout, następnie — wyłącznie przed limitem — śmierć.
- Wynik powstaje z końcowego stanu ostatniego kroku, w tym cargo i inwestycji. Istniejący wynik terminalny pozostaje niezmienny.
- Snapshot już znajdujący się na limicie bez wyniku zostaje zakończony przy następnym wywołaniu symulacji, również przy zerowym aktywnym delta.
- Codec dopuszcza timeout przy dodatnim lub zerowym HP i sprawdza zgodność limitu, punktacji, run ID, czasu oraz gotówki. Dotychczas poprawne snapshoty aktywne i śmierci pozostają odczytywalne.
- Zachować schema version 19: rozszerzenie dopuszczalnych wartości nie zmienia kształtu pól i nie wymaga migracji snapshotów.
- Oba adaptery powrotu po logowaniu przyjmują nowe wyniki, zachowując walidację i jednokrotne odczytanie kontekstu.
- Zmiany autorytatywnego stanu realizować zgodnie z `.agents/skills/utils-add-state/SKILL.md`.

#### 2. Baza i kontrakt produktu

**Files**: nowa migracja w `supabase/migrations/`, `tests/integration/runResultsRlsIntegrationTest.ts`, `context/foundation/prd.md`, `context/foundation/roadmap.md` i notatki zmiany.

**Intent**: Umożliwić zachowanie nowych wyników i uzgodnić zakres dokumentacji.

**Contract**:

- Nowa migracja rozszerza ograniczenie `run_results` do trzech wyników S-06; zachowuje istniejące rekordy, kolumny punktacji i polityki dostępu.
- Wspólna ścieżka dostarczania wyników zachowuje retry, idempotencję i obsługę gracza anonimowego.
- PRD uwzględnia pierwszeństwo timeoutu; FR-009 i opis S-06 używają końcowego wyniku punktowego.
- Roadmapa przenosi porzucenie do S-11. Archiwalne dokumenty pozostają historycznymi zapisami.
- Edycja PRD kończy się deterministycznym i semantycznym przeglądem `10x-prd-en-capability`.

### Success Criteria:

#### Automated Verification:

- Testy granic punktacji, terminalizacji, codec i adapterów przechodzą wraz z `test:fast` oraz `typecheck`.
- Lokalna integracja bazy przyjmuje trzy wyniki, odrzuca nieznany wynik i zachowuje izolację właścicieli.

#### Manual Verification:

- Przegląd PRD i roadmapy potwierdza próg punktowy, pierwszeństwo timeoutu i przekazanie porzucenia do S-11.

## Phase 2: Wprowadzenie przed startem

### Overview

Cztery ilustracje i popup celu przed utworzeniem runu i uruchomieniem jego zegara.

### Changes Required:

#### 1. Komponent wprowadzenia

**Files**: nowy komponent w `src/ui/components/`, `src/ui/setupUi.ts`, `src/ui/contracts.ts`, `index.html`, `public/style.css` i współdzielone stałe etykiet.

**Intent**: Wyjaśnić historię oraz cel przed rozpoczęciem czasu gry.

**Contract**:

- Cztery plansze, następnie popup długu; bez automatycznego pomijania historii.
- Każde kliknięcie planszy lub „Next” wykonuje jeden krok. Propagacja kliknięcia przycisku nie pomija kolejnej planszy.
- Plansza pokrywa obszar gry. Ilustracja używa dopasowania zachowującego cały obraz; ewentualne pasy także są klikalne.
- Popup ma „Start Game”; tło i Escape nie rozpoczynają runu.
- Podczas wprowadzenia menu pod spodem jest nieaktywne; focus pozostaje w dialogu. Przyciski obsługują klawiaturę.
- Dopiero „Start Game” emituje istniejące zdarzenie startu. Jedno kliknięcie tworzy dokładnie jeden run.
- Komponent usuwa wszystkie listenery przy zniszczeniu; ponowne wejście zaczyna od pierwszej planszy.
- Teksty i etykiety pochodzą ze współdzielonych stałych.

#### 2. Ilustracje i fixture startu

**Files**: cztery ilustracje użytkownika w `public/assets/`, `tests/ui/gameStateFixture.ts` i istniejące bezpośrednie wywołania „New Game” w testach UI.

**Intent**: Podłączyć finalne zasoby i zachować istniejące scenariusze startu gry.

**Contract**:

- Docelowe nazwy: `intro-story-01.png` do `intro-story-04.png`.
- Kwota długu pozostaje tekstem interfejsu poza grafikami.
- Brak plików blokuje ukończenie fazy; nie zastępować ich prowizorycznymi obrazami.
- Istniejące fixture’y i bezpośrednie wywołania „New Game” przechodzą przez jeden helper kończący wprowadzenie.

### Success Criteria:

#### Automated Verification:

- Testy przejść wprowadzenia i `typecheck` potwierdzają jeden krok na interakcję oraz pojedynczy start runu.

#### Manual Verification:

- Cztery dostarczone ilustracje są kompletne i czytelne na desktopie oraz telefonie w poziomie; popup uruchamia grę od 30:00.

## Phase 3: Wspólny ekran wyniku i integracja

### Overview

Integracja nowych wyników z istniejącym ekranem końcowym i sprawdzenie kompletnego przepływu.

### Changes Required:

#### 1. Ekran końcowy i przejścia

**Files**: `src/game/scenes/gameOverScene.ts`, `src/game/scenes/gameScene.ts`, `src/game/scenes/preloaderScene.ts`, `src/ui/setupUi.ts`, `index.html` i stałe etykiet UI.

**Intent**: Pokazać właściwe zakończenie na istniejącym ekranie.

**Contract**:

- `freedom` → `the_end_debt_payed.png`.
- `imprisonment` → `the_end_debt_due.png`.
- `death` → `the_end_ship_destroyed.png`.
- Śmierć zachowuje obecną animację; timeout przechodzi bez animacji zniszczenia.
- Timeout kończy sesję telemetryczną i kieruje wynik do istniejącego dostarczania rezultatów.
- „Main Menu” wraca do używalnego menu; kliknięcie tła nie zamyka wyniku.
- Zmiana tła nie zmienia prezentacji składników punktacji, historii ani rankingów.

#### 2. Integracja przeglądarkowa

**Files**: istniejące testy w `tests/ui/` i `context/foundation/e2e_scenarios.md`.

**Intent**: Zweryfikować rzeczywiste połączenie DOM, Phaser i nawigacji.

**Contract**:

- Jeden reprezentatywny scenariusz przechodzi przez plansze, popup, start, deterministyczny timeout i powrót do menu.
- Uzasadnienie Playwright: ryzykiem jest błędne połączenie rzeczywistych zdarzeń DOM z uruchomieniem sceny i ekranem wyniku; niższe testy nie sprawdzają tego połączenia.
- Granice punktacji i wybór tła pozostają w szybkich testach.
- Test nie czeka 30 minut; wykorzystuje fixture blisko limitu.
- Po zmianach testów uruchomić `utils-describe-e2e-scenarios`.

### Success Criteria:

#### Automated Verification:

- `test:fast`, `typecheck` oraz właściwe testy UI przechodzą; inventory E2E jest aktualne.

#### Manual Verification:

- Trzy zakończenia mają właściwe tła, timeout nie pokazuje animacji śmierci, a wyłącznie „Main Menu” opuszcza ekran wyniku.

## Testing Strategy

Szybkie testy obejmą:

- Wyniki 999 999, 1 000 000 i 1 000 001 oraz zaokrąglenie sumy przed porównaniem.
- Niską gotówkę z cargo i inwestycjami dającymi wygraną.
- Śmierć przed limitem oraz oba wyniki punktowe przy zerowym HP dokładnie na limicie.
- Pauzę przed limitem, długi ostatni krok, już osiągnięty limit i brak postępu po terminalizacji.
- Round trip snapshotu, atomowe odrzucanie błędnego wyniku oraz zachowanie poprawnych starych danych.
- Powrót po logowaniu, retry i idempotentny zapis nowych wyników.
- Kliknięcie planszy, kliknięcie „Next”, pojedynczy start i cleanup listenerów.

Testy UI korzystają z istniejącej lokalnej konfiguracji Supabase i izolowanych sesji. Walidacja nie instaluje zależności ani przeglądarki. Przed testami UI uruchomić lokalny Supabase przez `npx supabase start --exclude vector`; `npm.cmd run test:ui` resetuje wyłącznie lokalną bazę testową. Wykorzystać istniejące fixture sesji. Nie automatyzować Google OAuth.

Polecenia walidacji: `npm.cmd run test:fast`, `npm.cmd run typecheck`, właściwe testy UI przez `npm.cmd run test:ui`. Po zmianach PRD: `node .agents/skills/10x-prd-en-capability/scripts/check-prd.mjs context/foundation/prd.md` i przegląd semantyczny.

## Performance Considerations

Punktację timeoutu obliczać przy terminalizacji, bez dodawania pracy do każdej klatki. Cztery ilustracje muszą zachować czytelność i przechodzić istniejącą kontrolę rozmiaru zasobów Pages.

## Migration Notes

Snapshot zachowuje schema version 19 i dotychczasowe pola; nie dodawać migracji historycznych snapshotów. Rozszerzenie wyników bazy wymaga nowej migracji ograniczenia SQL, bez edycji istniejących migracji i bez usuwania danych. Migrację najpierw sprawdza lokalna baza testowa; wdrożenie zdalne pozostaje osobnym zadaniem.

## References

- Frame: `context/changes/s06-timed-debt-outcome/frame.md`.
- Research: `context/changes/s06-timed-debt-outcome/research.md`.
- Product and architecture: `context/foundation/prd.md`, `context/foundation/architecture.md`, `context/foundation/testing.md`.
- Najnowsze decyzje planowania zastępują wcześniejszy zakres porzucenia i rozstrzygają pierwszeństwo timeoutu przy zniszczeniu w tym samym kroku.

## Progress

### Phase 1: Wyniki po czasie i ich zachowanie

#### Automated

- [ ] 1.1 Testy granic punktacji, terminalizacji, codec i adapterów przechodzą wraz z `test:fast` oraz `typecheck`.
- [ ] 1.2 Lokalna integracja bazy przyjmuje trzy wyniki, odrzuca nieznany wynik i zachowuje izolację właścicieli.

#### Manual

- [ ] 1.3 Przegląd PRD i roadmapy potwierdza próg punktowy, pierwszeństwo timeoutu i przekazanie porzucenia do S-11.

### Phase 2: Wprowadzenie przed startem

#### Automated

- [ ] 2.1 Testy przejść wprowadzenia i `typecheck` potwierdzają jeden krok na interakcję oraz pojedynczy start runu.

#### Manual

- [ ] 2.2 Cztery dostarczone ilustracje są kompletne i czytelne na desktopie oraz telefonie w poziomie; popup uruchamia grę od 30:00.

### Phase 3: Wspólny ekran wyniku i integracja

#### Automated

- [ ] 3.1 `test:fast`, `typecheck` oraz właściwe testy UI przechodzą; inventory E2E jest aktualne.

#### Manual

- [ ] 3.2 Trzy zakończenia mają właściwe tła, timeout nie pokazuje animacji śmierci, a wyłącznie „Main Menu” opuszcza ekran wyniku.
