# S-06 — Plan Brief

> Full plan: `context/changes/s06-timed-debt-outcome/plan.md`
> Frame brief: `context/changes/s06-timed-debt-outcome/frame.md`
> Research: `context/changes/s06-timed-debt-outcome/research.md`

## What & Why

Frame statement: S-06 does not yet fulfill its end-to-end timed-run lifecycle contract: the pre-run objective introduction is absent, timeout does not produce a terminal result from the final composite score, and the existing shared result experience only supports the already-implemented death ending; the abandoned-run presentation is explicitly deferred to S-11.

Najnowsza decyzja planowania przenosi do S-11 całą obsługę porzucenia. S-06 obejmuje cztery plansze historii, popup celu, start runu, timeout i istniejącą śmierć statku na wspólnym ekranie końcowym.

## Starting Point

Punktacja, dostarczanie wyników i jeden ekran końcowy już istnieją. Start jest natychmiastowy, timeout nie tworzy wyniku, a stan, codec i baza dopuszczają wyłącznie śmierć. Trzy grafiki zakończeń są już w repozytorium; cztery ilustracje historii dostarcza użytkownik.

## Desired End State

Każde „New Game” pokazuje cztery pełnoekranowe plansze. Kliknięcie dowolnego miejsca lub „Next” przesuwa o jeden krok; cała ilustracja pozostaje widoczna. Popup wyjaśnia dług 1 000 000 kredytów i cel: końcowy wynik co najmniej 1 000 000 punktów po 30 minutach aktywnego czasu. Dopiero „Start Game” rozpoczyna run od 30:00.

Po timeoutcie wygrana lub porażka wybiera odpowiednie tło istniejącego ekranu. Zniszczenie statku wcześniej daje tło zniszczonego statku. Jeśli limit i zniszczenie nastąpią w tym samym kroku, rozstrzyga wynik punktowy. Powrót do menu odbywa się wyłącznie przez „Main Menu”.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Próg | Wynik końcowy ≥ 1 000 000 wygrywa | Dokładnie milion także jest wygraną | Wcześniejsze ustalenia |
| Punktacja | Gotówka + koszt cargo + kwalifikowane inwestycje, jedno zaokrąglenie | Wykorzystuje wspólny kalkulator | PRD / Research |
| Timeout i śmierć razem | Wynik punktowy ma pierwszeństwo | Jawna decyzja użytkownika | Plan |
| Porzucenie | Cała obsługa w S-11 | Zastępuje wcześniejsze odroczenie tylko prezentacji | Plan |
| Ilustracje | Użytkownik dostarcza cztery pliki, obraz w całości | Kontrola historii i czytelność | Plan |
| Plansze | Cały obszar lub Next przesuwa dokładnie o jeden krok | Ustalona nawigacja | Frame / Plan |
| Popup | Dług, czas i próg punktowy; Start Game | Jednoznaczny cel i moment uruchomienia czasu | Plan |
| Ekran wyniku | Jeden ekran, trzy istniejące tła, tylko przycisk menu zamyka | Spójny wynik bez przypadkowego zamknięcia | Frame / Plan |
| Snapshot | Zachować v19 i istniejące pola | Rozszerzenie wartości bez migracji historycznych snapshotów | Plan |

## Scope

**In scope:** wprowadzenie, popup celu, start runu, timeout, zachowanie śmierci statku, trzy tła, przycisk menu, zapis nowych wyników i walidacja powrotu po logowaniu.

**Out of scope:** porzucenie, autosave i resume w S-11; generowanie ilustracji; zmiana punktacji i rankingów; produkcyjny deploy; migracje snapshotów; nowe ekrany końcowe.

## Architecture / Approach

Przejściowy komponent DOM poprzedza istniejące zdarzenie startu. Mechanika otrzymuje czysty klasyfikator timeoutu korzystający z aplikacyjnej punktacji; terminalny stan przechodzi przez GameStateProvider i codec. Istniejąca ścieżka dostarczania wyników zapisuje nowe wartości do bazy po dodaniu migracji ograniczenia SQL. Snapshot zachowuje dotychczasowy kształt.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Wyniki po czasie i ich zachowanie | Terminalizacja timeoutu, walidacja, adaptery i baza | Pierwszeństwo timeoutu przy zerowym HP i zgodność wyników |
| 2. Wprowadzenie przed startem | Cztery ilustracje i popup przed utworzeniem runu | Brak ilustracji lub podwójny krok kliknięcia |
| 3. Wspólny ekran wyniku i integracja | Trzy tła, przycisk menu i pełny przepływ | Błędne połączenie DOM ze scenami |

**Prerequisites:** cztery dostarczone ilustracje (`intro-story-01.png` do `intro-story-04.png`) do ukończenia fazy 2; istniejące zależności i Chromium oraz lokalny Supabase do testów UI. Brak grafik blokuje ukończenie fazy, nie zastępować ich prowizorycznymi obrazami.

**Estimated effort:** trzy fazy implementacyjne; termin ukończenia zależy od dostarczenia ilustracji i dostępności lokalnego środowiska testowego.

## Open Risks & Assumptions

- Cztery ilustracje dostarcza użytkownik; kwota długu nie jest częścią grafik.
- Poprawne dotychczasowe snapshoty aktywne i śmierci pozostają odczytywalne bez migracji.
- Wynik terminalny powstaje z końcowego stanu ostatniego kroku; timeout ma pierwszeństwo w kroku osiągającym limit.
- Zdalna migracja bazy i produkcyjna publikacja pozostają osobnymi zadaniami.

## Success Criteria (Summary)

- Wprowadzenie nie zużywa czasu gry; Start Game tworzy jeden run od 30:00.
- Timeout rozstrzyga wynik punktowy zgodnie z progiem i zapisuje poprawny rezultat; wcześniejsze zniszczenie nadal kończy run śmiercią.
- Jeden ekran prezentuje właściwe tło i składniki wyniku, a Main Menu przywraca używalne menu.
