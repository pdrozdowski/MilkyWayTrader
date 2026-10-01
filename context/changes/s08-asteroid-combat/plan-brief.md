# S-08: Interaktywny pas asteroid i fragmentacja — Plan Brief

> Full plan: `context/changes/s08-asteroid-combat/plan.md`
> Frame brief: `context/changes/s08-asteroid-combat/frame.md`

## What & Why

Pas asteroid ma przestać być dekoracją: każda z 384 asteroid ma być trwałym obiektem rozgrywki, który może zostać zniszczony przez pocisk, statek, planetę albo gwiazdę. Rozpady widoczne dla gracza dostają eksplozję i dźwięk, a zachowanie pozostaje odtwarzalne przez snapshot.

## Starting Point

Obecny `AsteroidBelt` tylko rysuje deterministyczny układ PNG i nie ma ID, kolizji ani stanu. Pociski mają trwały stan oraz swept-circle geometry, ale trafienie usuwa dziś jedynie pocisk i nie identyfikuje celu.

## Desired End State

Gracz lata przez znajomy ruchomy pas, a asteroidy reagują na świat: pociski i kolizje z planetą lub statkiem rozbijają BIG/MEDIUM na 2–4 mniejsze cele, zaś Moolaris usuwa je bez fragmentów. Fragmenty dryfują liniowo, są cullowane poza bezpiecznym obszarem i nie powodują jeszcze obrażeń HP w S-08.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Pas asteroid | Wszystkie 384 są interaktywne | Widoczny pas i gameplay są tym samym systemem. | Plan |
| Startowy rozmiar | Wszystkie BIG | Zachowuje dotychczasową sylwetkę oraz pełną drabinę rozpadów. | Plan |
| Fragmentacja | Deterministyczne 2–4 dzieci | Daje różnorodność bez niedeterministycznej symulacji. | Plan |
| Kolizje | Pocisk/statek/planeta rozbijają; Moolaris usuwa | Rozróżnia produktywne zniszczenie od całkowitego pochłonięcia. | Plan |
| HP | Brak damage w S-08 | Obrażenia pozostają zakresem S-07. | Plan |
| Feedback | Eksplozja + nowy SFX tylko w widoku | Daje czytelny efekt bez trwałych eventów prezentacji. | Plan |
| Culling | World bounds lub 15 s poza promieniem 1 280 | Ogranicza dryfujące fragmenty bez znikania przy graczu. | Plan |

## Scope

**In scope:**

- Autorytatywne asteroidy orbitalne i dryfujące fragmenty.
- Kolizje z pociskiem, statkiem, planetami i Moolaris.
- Eksplozje/SFX widocznych rozpadów oraz pełne testy stanu, mechaniki i lifecycle.

**Out of scope:**

- Damage, śmierć runu, salvage, replenishment i Playwright.
- Migracja istniejących snapshotów.

## Architecture / Approach

`GameStateSnapshot` v7 przechowuje asteroidę oraz jej lifecycle; czysty reducer oblicza ruch i najwcześniejsze kolizje, a `GameScene` tylko synchronizuje sprite’y po ID. Porównanie poprzedniego i nowego snapshotu dostarcza jednorazowego sygnału eksplozji/SFX, bez utrwalania efektu w stanie gry.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Kontrakt i stan | PRD, schema v7, layout i codec | Zachowanie zgodności snapshotu bez migracji |
| 2. Symulacja | Ruch, kolizje i fragmentacja | Deterministyczny wybór celu |
| 3. Prezentacja | Obiekty, eksplozje i SFX | Brak duplikatów efektu lub wycieków |
| 4. Walidacja | Przekrojowe testy i akceptacja | Regresje broni, pauz i restore |

**Prerequisites:** obecne zależności i Chromium nie są potrzebne; S-07 pozostaje późniejszym źródłem damage.
**Estimated effort:** ~3–4 sesje implementacyjne.

## Open Risks & Assumptions

- Wzrost populacji po fragmentacji jest ograniczany cullingiem, ale bez replenishment.
- Wynik rozpadów musi być identyczny po restore; żadna ścieżka nie może użyć `Math.random`.
- Moolaris nie tworzy eksplozji rozpadu, nawet gdy asteroidę pochłania w widoku.

## Success Criteria (Summary)

- Wszystkie kolizje i fragmentacje są deterministyczne oraz serializowalne.
- Widoczny rozpad BIG/MEDIUM daje dokładnie jedną eksplozję i jeden SFX.
- Testy fast, typecheck i build przechodzą, a scena po re-entry nie ma pozostałych efektów.
