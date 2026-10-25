---
date: 2026-10-25T16:39:17+01:00
researcher: Codex
git_commit: 20010e7bed7d52fd3f39783c8096c124d76a6c4f
branch: main
repository: MilkyWayTrader
topic: "Hide the mobile booster button until purchase"
tags: [research, codebase, gameScene, touch-controls, booster]
status: complete
last_updated: 2026-10-25
last_updated_by: Codex
---

# Research: Hide the mobile booster button until purchase

**Date**: 2026-10-25T16:39:17+01:00  
**Researcher**: Codex  
**Git Commit**: 20010e7bed7d52fd3f39783c8096c124d76a6c4f  
**Branch**: main  
**Repository**: MilkyWayTrader

## Research Question

Na mobile guzik boostera powinien być widoczny tylko po zakupie; przed zakupem powinien być ukryty.

## Summary

W sprawdzonej ścieżce HUD `GameScene.layoutScreenSpace()` ustawia widoczność przycisku boosta wyłącznie na podstawie widoczności układu dotykowego, bez uwzględnienia `shipStatus.boosterUnlocked` (`src/game/scenes/gameScene.ts:403-429`). Stan zakupu już istnieje w autorytatywnym snapshotcie i rozpoczyna się jako `false` (`src/game/state/shipStatusState.ts:1-12`; `src/game/definitions/initialGameState.ts:61-63`). Przy planowaniu należy uwzględnić zakup oraz ponowne renderowanie układu po zmianie stanu, ponieważ `layoutScreenSpace()` jest wywoływane podczas tworzenia i zmiany rozmiaru, a sama obsługa zakupu aktualizuje snapshot bez jawnego wywołania tej metody (`src/game/scenes/gameScene.ts:156-163,403-429`; `src/game/application/planetShipServices.ts:157-162`).

## Detailed Findings

### Touch HUD i widoczność boosta

- `layoutScreenSpace()` oblicza `touchLayoutVisible` z flagi urządzenia dotykowego lub debugowego przełącznika touch controls, o ile nie trwa przejście śmierci (`src/game/scenes/gameScene.ts:403-429`).
- Przycisk ognia i boosta otrzymują ten sam warunek widoczności `touchLayoutVisible`; warunek boosta nie odczytuje statusu boostera (`src/game/scenes/gameScene.ts:414-429`). Jest to konkretna ścieżka, która wyjaśnia zgłoszony objaw.
- `GameScene.create()` tworzy touch controls i wywołuje `layoutScreenSpace()`; metoda jest również podpięta do zdarzenia resize (`src/game/scenes/gameScene.ts:156-163`). Debugowa zmiana widoczności touch controls ponownie wywołuje layout (`src/game/scenes/gameScene.ts:296-309`).
- Snapshot początkowy ustawia `boosterUnlocked: false`, a pole jest częścią `ShipStatusState` (`src/game/definitions/initialGameState.ts:61-63`; `src/game/state/shipStatusState.ts:1-12`). Zakup boostera zmienia to pole na `true` przez reducer `applyShipBooster` (`src/game/application/planetShipServices.ts:157-162`).
- Przy aktywnej scenie przycisk może zostać odświeżony przez ścieżkę prezentacji w `layoutScreenSpace()`, jednak badana ścieżka zakupu nie wywołuje bezpośrednio `layoutScreenSpace()` (`src/game/application/planetShipServices.ts:157-162`; `src/game/scenes/gameScene.ts:403-429`). Plan powinien określić sposób zsynchronizowania widoczności po zakupie, bez założenia, że resize wystąpi w tym momencie.

### Wejście i granice stanu

- Touch button jest obiektem Phaser tworzonym przez `createTouchButton('control:boost')`, a pointer wiąże się z `boostPointer` (`src/game/scenes/gameScene.ts:350-359`). `layoutScreenSpace()` wyłącznie ustawia jego layout i widoczność (`src/game/scenes/gameScene.ts:403-429`).
- Symulacja przekazuje żądanie boosta, gdy boost jest naciśnięty razem ze sterowaniem, natomiast mechanika ma sprawdzać odblokowanie w stanie (`src/game/scenes/gameScene.ts:533-539`; `src/game/mechanics/gameSimulation.ts:92-130`). Zatem ukrycie kontrolki jest zmianą prezentacji; nie powinno zastępować istniejącej reguły autorytatywnej.
- Zgodnie z `context/foundation/architecture.md`, scena składa systemy i renderuje snapshoty, a UI/Phaser nie powinny przejmować autorytatywnej własności stanu (`context/foundation/architecture.md:1-20`). Żądanie nie implikuje zmiany stanu gry, timera, snapshotu ani zapisu.

## Code References

- `src/game/scenes/gameScene.ts:403-429` — warunek widoczności joysticka, ognia i boosta oraz rozmieszczenie kontrolek dotykowych.
- `src/game/scenes/gameScene.ts:156-163` — inicjalizacja touch controls, pierwsze layoutowanie i obsługa resize.
- `src/game/scenes/gameScene.ts:296-309` — debugowe przełączenie touch controls wywołujące ponowne layoutowanie.
- `src/game/scenes/gameScene.ts:350-359` — utworzenie przycisku boosta i wiązanie pointera.
- `src/game/state/shipStatusState.ts:1-12` — typowany stan `boosterUnlocked`.
- `src/game/definitions/initialGameState.ts:61-63` — początkowy zablokowany booster.
- `src/game/application/planetShipServices.ts:157-162` — reducer zakupu odblokowujący booster.
- `src/game/mechanics/gameSimulation.ts:92-130` — reguły symulacji boosta i warunek odblokowania.

## Architecture Insights

Widoczność kontrolki należy do prezentacji sceny, a zakup należy do aplikacyjnego przepływu serwisu i snapshotu. Plan może ograniczyć zmianę do synchronizacji widoczności przycisku z `shipStatus.boosterUnlocked` i bieżącym warunkiem układu dotykowego. Jeśli wymagana jest natychmiastowa widoczność po zakupie, trzeba uwzględnić moment aktualizacji HUD-u; w tej inspekcji nie znaleziono subskrypcji `GameScene` na providerze, a `layoutScreenSpace()` jest osobnym krokiem sterowanym sceną.

## Historical Context (from prior changes)

- Archiwalny S-02 ustala, że touch controls są tymczasowym wejściem sceny i nie należą do snapshotów; jego kryterium obejmowało kontrolki osiągalne w widokach desktop/touch (`context/archive/2026-09-23-s02-direct-moving-system-flight/plan.md:168-189`). Ten dokument nie rozstrzyga widoczności boosta przed zakupem.
- Archiwalny S-05 opisuje `boosterUnlocked` jako utrwalany status statku i osobny zakup; obecny kod potwierdza status oraz reducer zakupu (`src/game/state/shipStatusState.ts:1-12`; `src/game/application/planetShipServices.ts:157-162`). Nie znaleziono bezpośredniego historycznego kontraktu dotyczącego widoczności przycisku touch.

## Related Research

Nie znaleziono aktywnego lub archiwalnego `research.md` poświęconego widoczności touch button boosta. Istotne wcześniejsze materiały są wymienione w sekcji Historical Context.

## Open Questions

Brak pytań blokujących ustalenie źródła objawu. Do planu pozostaje wybór mechanizmu odświeżania widoku bezpośrednio po zmianie `boosterUnlocked`, jeśli zakup może nastąpić podczas aktywnej sceny.
