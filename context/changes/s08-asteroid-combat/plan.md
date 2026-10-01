# S-08: Interaktywny pas asteroid i fragmentacja — plan wdrożenia

## Overview

Zmiana zamienia 384 dekoracyjne asteroidy pasa w autorytatywne obiekty świata. Zachowują one wygląd i orbitalny ruch, mogą zderzać się z pociskami, statkiem, planetami i Moolaris, a rozpad ma jasną reakcję audio-wizualną, gdy jest widoczny dla gracza.

## Current State Analysis

`AsteroidBelt` jest dziś statyczną projekcją sceny: nie ma tożsamości w snapshotcie, colliderów ani cyklu życia. Symulacja pocisków usuwa pocisk po kolizji z anonimową geometrią i obecnie dostaje tylko Moolaris jako przeszkodę. `GameStateSnapshot` i jego codec są wersjonowane oraz rygorystyczne; stan autorytatywny musi przejść przez ten agregat.

## Desired End State

Gracz widzi ten sam orbitujący pas, ale każda asteroida jest celem i przeszkodą. BIG i MEDIUM rozpadają się deterministycznie na 2–4 mniejsze, liniowo dryfujące asteroidy po określonych kolizjach; rozpad widoczny w kamerze uruchamia eksplozję i dźwięk. Gwiazda usuwa asteroidę bez fragmentów, a S-08 nie odbiera jeszcze HP statku.

### Key Discoveries:

- `src/game/visual/asteroidBelt.ts` tworzy 384 deterministyczne wpisy bez stanu gry; nie może być dalej używany jako źródło kolizji.
- `src/game/mechanics/gameSimulation.ts` już używa swept-circle dla pocisków, lecz gubi ID trafionego celu.
- `src/game/application/gameStateCodec.ts` wymaga aktualizacji każdego pola agregatu i podniesienia wersji schematu; nie należy dodawać migracji snapshotu.
- `src/game/audio/audioScope.ts` oraz synchronizacja `ShipWeapon` dostarczają wzorców dla jednorazowego SFX i mapowania obiektów po ID.

## What We're NOT Doing

- Obrażeń HP, śmierci runu i terminalnych skutków — należą do S-07.
- Salvage, skrzynek, kredytów oraz replenishment populacji — należą poza S-08, w tym salvage do S-09.
- Migracji snapshotu v6; schema v7 odrzuca starszy zapis.
- Playwright; canvas i audio nie są tu lepszym sygnałem regresji niż testy mechaniki, obiektów i audio.

## Implementation Approach

Wprowadzić `AsteroidState` jako jedyne źródło prawdy dla asteroid i ich fragmentów. Czysta symulacja aktualizuje orbitę lub dryf oraz rozstrzyga najwcześniejszą kolizję stabilnym porządkiem; Phaser jedynie renderuje stan i na przejściu rodzic→fragmenty wyzwala przejściowy efekt. Wszystkie losowania liczby dzieci (2–4) wynikają deterministycznie z ID rodzica.

## Critical Implementation Details

Pociski istniejące na początku klatki są rozpatrywane przed utworzeniem nowego strzału. Zbiór asteroid możliwych do trafienia w klatce jest zbiorem sprzed fragmentacji: dziecko nie może zostać trafione jeszcze w tej samej klatce. Przy jednoczesnych przecięciach wybierany jest najwcześniejszy punkt trajektorii, następnie stabilne ID; Moolaris pozostaje kandydatem blokującym pocisk.

## Phase 1: Kontrakt produktu i autorytatywny stan

### Overview

Ustalić produktowy kontrakt kolizji, wprowadzić wersjonowany stan asteroid i zapewnić jego bezpieczną serializację.

### Changes Required:

#### 1. PRD i bramka capability

**Files**: `context/foundation/prd.md`, `.agents/skills/10x-prd-en-capability/scripts/check-prd.mjs`

**Intent**: Usunąć konflikt między obecnym zakazem fragmentów po kolizji a uzgodnionym zachowaniem S-08, bez przejmowania obrażeń HP z S-07.

**Contract**: Reguły biznesowe rozróżniają rozpad po pocisku, statku i planecie od całkowitego zniszczenia przez Moolaris; damage statku pozostaje osobną przyszłą regułą. PRD po zmianie przechodzi deterministyczny checker i przegląd capability.

#### 2. Snapshot asteroid i codec v7

**Files**: `src/game/state/asteroidState.ts`, `src/game/state/gameStateSnapshot.ts`, `src/game/definitions/initialGameState.ts`, `src/game/application/gameStateCodec.ts`, `tests/domain/gameState.test.mjs`

**Intent**: Uczynić pozycję, ruch, typ, rozmiar i lifecycle asteroid przywracalną częścią jednej atomowej prawdy o runie.

**Contract**: `AsteroidState` jest readonly i JSON-safe: stabilne ID, wariant, `big|medium|small`, `Vector2State` pozycji i prędkości, opcjonalny opis orbity oraz `outsideSafeAreaSinceActiveMs`. Początkowy snapshot v7 zawiera 384 BIG orbitalnych asteroid utworzonych z obecnego deterministycznego layoutu. Codec waliduje dokładny shape, ID, wartości skończone i czasy; v6 nie jest migrowane.

#### 3. Tuning mechaniki asteroid

**Files**: `src/game/definitions/gameplayTuning.ts`, `src/game/visual/asteroidBelt.ts`, `tests/game-mechanics.test.mjs`

**Intent**: Przenieść stałe rozmiaru, promienia orbity, dryfu, granic i bezpiecznego promienia do definicji, aby zachować widok pasa oraz umożliwić testowalne balansowanie.

**Contract**: Wszystkie 384 wpisy zachowują bieżący wariant i ruch orbitalny. Rozpad losuje deterministycznie równomiernie 2–4 dzieci. Bezpieczny promień wynosi 1 280 od statku; nieorbitujący obiekt znika poza world bounds albo po 15 s aktywnego czasu nieprzerwanie poza promieniem, a powrót resetuje licznik.

### Success Criteria:

#### Automated Verification:

- PRD checker przechodzi po edycji kontraktu.
- Codec v7 akceptuje prawidłowy stan asteroid i atomowo odrzuca błędne ID, wektory, czasy oraz schema v6.
- Snapshot początkowy ma 384 orbitalne asteroidy BIG zachowujące obecny layout.

#### Manual Verification:

- Przegląd PRD potwierdza: fragmentacja jest w S-08, a obrażenia HP nadal w S-07.

---

## Phase 2: Deterministyczny lifecycle i kolizje

### Overview

Zbudować czystą symulację ruchu, cullingu, trafień oraz fragmentacji bez zależności od Phaser.

### Changes Required:

#### 1. Reduktor asteroid i rozstrzyganie kolizji

**Files**: `src/game/mechanics/asteroid/asteroidSimulation.ts`, `src/game/mechanics/gameSimulation.ts`, `src/game/world/geometry.ts`, `src/game/mechanics/projectile/trajectory.ts`

**Intent**: Zastąpić anonimowe usuwanie pocisku rozstrzygnięciem konkretnego celu przy zachowaniu ochrony przed tunnelingiem.

**Contract**: Orbitalne asteroidy aktualizują pozycję wyłącznie z active time; fragmenty poruszają się liniowo z trwałą prędkością. Silnik porównuje trajektorie asteroid, pocisków, statku, planet i Moolaris, wybiera najwcześniejsze przecięcie, a remisy rozstrzyga ID. Kolizja z Moolaris usuwa asteroidę bez dzieci; z planetą i statkiem tworzy dzieci odrzucane od źródła; z pociskiem tworzy dzieci w rozrzucie 360°.

#### 2. Zachowanie pocisku i granice S-07

**Files**: `src/game/mechanics/gameSimulation.ts`, `tests/game-mechanics.test.mjs`

**Intent**: Zachować istniejące tempo broni i obsługę Moolaris, jednocześnie nie wprowadzać przedwcześnie uszkodzeń statku.

**Contract**: Jeden pocisk niszczy najwyżej jeden cel w klatce; potomkowie nie są celami w tej samej klatce. Nowe strzały nadal zaczynają kolidować dopiero w kolejnej aktywnej klatce. Kontakt statku fragmentuje asteroidę, lecz `shipStatus.currentHitPoints` nie zmienia się.

### Success Criteria:

#### Automated Verification:

- Testy mechaniki pokrywają orbitę, dryf, pause, world bounds i reset 15-sekundowego licznika.
- Testy pokrywają trafienia pociskiem, statkiem, planetą i Moolaris, najbliższy cel, remisy i brak tunnelingu.
- Testy pokrywają BIG→MEDIUM, MEDIUM→SMALL, SMALL→brak dzieci oraz identyczny wynik po serializacji i restore.

#### Manual Verification:

- Kontakt statku z asteroidą fragmentuje ją, ale HP statku nie spada.

---

## Phase 3: Obiekty, eksplozje i dźwięk

### Overview

Zamienić dekoracyjną projekcję pasa na obiekty synchronizowane po ID i dodać widoczne, jednorazowe sprzężenie zwrotne rozpadu.

### Changes Required:

#### 1. Obiektowa projekcja asteroid

**Files**: `src/game/objects/asteroid/`, `src/game/scenes/gameScene.ts`, `src/game/visual/layers.ts`, `src/game/effects/asteroidBelt.ts`

**Intent**: Renderować autorytatywne asteroidy i fragmenty bez przywracania stanowej logiki do Phaser.

**Contract**: Menedżer asteroid mapuje ID snapshotu na sprite, synchronizuje pozycję/skalę/teksturę i niszczy nieobecne wpisy na wzór `ShipWeapon`. Używa dotychczasowych wariantów tekstur, nowej głębi między tłem a statkiem/pociskiem i idempotentnego cleanupu przy shutdown.

#### 2. Widoczna eksplozja oraz SFX rozpadu

**Files**: `src/game/effects/asteroidExplosion.ts`, `src/game/audio/definitions/asteroidFragment.ts`, `public/assets/audio/asteroid-fragment/`, `src/game/scenes/gameScene.ts`, `tests/game-audio.test.mjs`

**Intent**: Dać każdemu widocznemu rozpadowi BIG lub MEDIUM czytelne, krótkie potwierdzenie bez zapisywania efektów w snapshotcie.

**Contract**: Scena po commitcie porównuje poprzedni i bieżący stan, a dla widocznego przejścia rodzic→dzieci tworzy ograniczoną czasowo animację eksplozji oraz odtwarza jeden generowany WAV z proweniencją, ograniczeniem głosów i istniejącym `AudioScope`. Nie tworzy efektu dla rozpadu poza widokiem, restore ani pierwszej synchronizacji sceny; zniszczenie przez Moolaris nie uruchamia efektu rozpadu.

### Success Criteria:

#### Automated Verification:

- Testy obiektów potwierdzają synchronizację po ID, usuwanie rodzica i utworzenie dzieci bez duplikatów.
- Testy audio potwierdzają jeden SFX na widoczne przejście, brak odtworzenia po restore oraz cleanup scope.

#### Manual Verification:

- Widoczny rozpad BIG i MEDIUM pokazuje eksplozję i słyszalny SFX; poza widokiem nie tworzy efektu.
- Powrót do menu i ponowne wejście do gry nie pozostawiają sprite’ów, efektów ani dźwięku.

---

## Phase 4: Zintegrowana walidacja

### Overview

Potwierdzić przekrojowy kontrakt stanu, symulacji oraz prezentacji bez dodawania nieadekwatnego E2E.

### Changes Required:

#### 1. Zestaw regresji i ręczna akceptacja

**Files**: `tests/game-mechanics.test.mjs`, `tests/domain/gameState.test.mjs`, `tests/game-audio.test.mjs`

**Intent**: Utrzymać zachowanie pasa, broni, pauz i serializacji po połączeniu wszystkich warstw.

**Contract**: Testy jednostkowe i architektoniczne są wystarczającym automatycznym sygnałem; Playwright nie jest dodawany, ponieważ canvas/audio nie są semantycznie weryfikowalne przez istniejącą warstwę UI.

### Success Criteria:

#### Automated Verification:

- `npm.cmd run test:mechanics`, `npm.cmd run test:objects` i `npm.cmd run test:audio` przechodzą.
- `npm.cmd run test:fast`, `npm.cmd run typecheck` i `npm.cmd run build-nolog` przechodzą.

#### Manual Verification:

- Gracz może zobaczyć oraz przetestować każdy typ kolizji, rozmiar fragmentacji, brak obrażeń HP i reguły widocznego feedbacku.

## Testing Strategy

- State/codec: exact shape, odmowa v6, immutability, duplicate IDs, atomic restore i serializacja.
- Mechanics: wszystkie trajektorie, kolizje i granice czasowe; tabela przypadków dla BIG/MEDIUM/SMALL.
- Presentation/audio: reconciler po ID, lifecycle efektu, mute/unlock i cleanup.

## Performance Considerations

Startowy pas ma 384 obiekty, a fragmentacja chwilowo zwiększa populację. Projekcja musi rekonsyliować mapę ID, nie tworzyć sprite’ów ani `AudioScope` co klatkę, a culling ogranicza liniowe fragmenty. Efekt eksplozji ma skończony czas życia i ograniczoną liczbę aktywnych próbek.

## Migration Notes

Schema zmienia się z v6 na v7. Aplikacja jest przed dojrzałością persistence, więc nie dodaje się migracji ani wartości domyślnych dla starych snapshotów; codec odrzuca v6.

## References

- Frame: `context/changes/s08-asteroid-combat/frame.md`
- Architektura: `context/foundation/architecture.md`
- Testy: `context/foundation/testing.md`
- Podobny lifecycle: `src/game/objects/spaceship/shipWeapon.ts`
- Obecny pas: `src/game/visual/asteroidBelt.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Kontrakt produktu i autorytatywny stan

#### Automated

- [x] 1.1 Validate the amended PRD capability contract
- [x] 1.2 Validate schema v7 asteroid codec and initial state
- [x] 1.3 Verify deterministic asteroid tuning and layout

#### Manual

- [ ] 1.4 Confirm S-08 fragmentation scope and S-07 damage boundary

### Phase 2: Deterministyczny lifecycle i kolizje

#### Automated

- [ ] 2.1 Verify asteroid movement, culling and pause behavior
- [ ] 2.2 Verify deterministic projectile and celestial collision resolution
- [ ] 2.3 Verify fragmentation hierarchy and restore continuity

#### Manual

- [ ] 2.4 Confirm ship contact fragments asteroids without HP loss

### Phase 3: Obiekty, eksplozje i dźwięk

#### Automated

- [ ] 3.1 Verify asteroid projection reconciliation and cleanup
- [ ] 3.2 Verify visible fragmentation explosion and one-shot audio lifecycle

#### Manual

- [ ] 3.3 Confirm visible and off-screen feedback behavior
- [ ] 3.4 Confirm clean scene exit and re-entry

### Phase 4: Zintegrowana walidacja

#### Automated

- [ ] 4.1 Run focused mechanics object and audio suites
- [ ] 4.2 Run fast tests typecheck and production build

#### Manual

- [ ] 4.3 Complete player-facing collision acceptance pass
