# MilkyWayTrader — pokrycie zasad zaliczenia

Data aktualizacji: 2026-10-02.
Oceniany PRD: [context/foundation/prd.md](../../foundation/prd.md), wersja 1 z 2026-09-21.

**Wniosek:** obecny zakres PRD pokrywa pięć obowiązkowych kryteriów 10xBuilder. Kontrola dostępu, CRUD, logika biznesowa i dokumenty kontekstowe są zapisane w PRD; uruchamialne testy Playwright dostarczają wymaganego dowodu z perspektywy użytkownika. Wdrożenie pełnego produktu oraz egzekwowanie uprawnień pozostają do wykonania i weryfikacji przed zgłoszeniem.

## Źródła i granice oceny

- Lokalna lista kryteriów 10XDevs 4.0: [.agents/skills/10x-idea-check/references/10xdevs-4-certification.md](../../../.agents/skills/10x-idea-check/references/10xdevs-4-certification.md).
- Lokalne terminy: [.agents/skills/10x-idea-check/references/10xdevs-4-dates.md](../../../.agents/skills/10x-idea-check/references/10xdevs-4-dates.md). Pierwszy termin to 2026-11-04.
- Podana wcześniej strona kursu wymaga logowania, dlatego niniejsza ocena nie potwierdza, że jej bieżąca treść jest identyczna z lokalną kopią.

Ocena rozdziela wymagania produktu od dowodów implementacji. Sam PRD nie dowodzi działania aplikacji ani akceptacji przez prowadzących.

## Pokrycie obowiązkowej listy 10xBuilder

| Wymaganie lokalnych zasad | Pokrycie | Ocena |
| --- | --- | --- |
| Kontrola dostępu odpowiednia dla aplikacji | FR-037–FR-039, US-05 i Access Control definiują Google OAuth, status uwierzytelnienia, sign-out w głównym menu, prywatne zapisy oraz publiczny ranking. `src/ui/components/authControls.ts` i `src/ui/adapters/browserAuth.ts` potwierdzają istniejącą obsługę lokalnego sign-out. | **Pokryte w zakresie.** Usługa trwałych danych musi egzekwować własność rekordów, a nie tylko ukrywać kontrolki. |
| CRUD sensowny dla domeny | Utworzenie, odczyt i aktualizacja zapisu wynikają z US-05 oraz FR-040–FR-041. FR-042 i BR-103 nakazują usunięcie aktywnego zapisu po utrwaleniu wyniku końcowego. FR-045 i BR-106 pozwalają właścicielowi usunąć osobisty rekord high score; globalny wynik pozostaje bez zmian. | **Pokryte.** Są zdefiniowane dwa znaczące przypadki usunięcia: zakończony aktywny zapis oraz osobisty rekord wyniku. |
| Logika biznesowa | BR-001–BR-109 określają zegar aktywnego czasu, wynik, ekonomię, obrażenia, salvage, zapisy i reguły rankingów. | **Pokryte.** Reguły mają weryfikowalne granice, w tym kolejność utrwalenia wyniku i usunięcia aktywnego zapisu. |
| Dokumenty kontekstowe | Istnieją `prd.md`, `architecture.md`, `infrastructure.md`, `roadmap.md`, `tech-stack.md`, `test-plan.md` i `testing.md`. | **Pokryte.** Przed zgłoszeniem muszą odzwierciedlać wdrożony produkt. |
| Co najmniej jeden test z perspektywy użytkownika | Playwright uruchamia scenariusze w `tests/ui/applicationDesktopUiTest.ts` i `tests/ui/applicationMobileUiTest.ts`; opis inwentarza znajduje się w `context/foundation/e2e_scenarios.md`. | **Pokryte dowodem implementacyjnym.** Testy weryfikują uruchomienie gry, menu, wznowienie i powrót do ekranu głównego. |

## Zakres rozstrzygnięty od poprzedniej oceny

- Sign-out jest obowiązkową capability (FR-039) i zachowuje dane użytkownika.
- Gameplay audio jest obowiązkową capability (US-07, FR-046); istnieją definicje zasobów audio i testy `tests/game-audio.test.mjs`.
- Terminalny wynik jest zachowywany przed usunięciem aktywnego save’a (FR-042, BR-103).
- Użytkownik może usunąć wyłącznie swój osobisty rekord high score; kolejny najwyższy zachowany wynik zostaje personal best (FR-045, BR-106).

## Weryfikacja przed zgłoszeniem

1. Wdrożyć i sprawdzić rzeczywistą autoryzację odczytu, zapisu i usuwania dla dwóch różnych kont.
2. Przejść pełny przepływ trwałych danych: wynik terminalny jest utrwalony, aktywny save znika, a wynik pozostaje widoczny zgodnie z regułami.
3. Uruchomić istniejący test użytkownika oraz zachować jego wynik jako dowód zgłoszeniowy.
4. Utrzymać dokumentację wdrożenia i dowody użycia AI w procesie wytwarzania. Publiczny URL jest mile widziany, lecz nie jest jednym z pięciu obowiązkowych punktów lokalnej listy.

AI nie musi być funkcją gry; lokalne zasady wymagają jego użycia w procesie wytwarzania. Phaser/Vite nie są przeszkodą, o ile dostarczony zostanie działający pełnostackowy MVP.

## Co wymaga potwierdzenia

Po uzyskaniu dostępu do wskazanej lekcji kursu porównać jej aktualną listę z lokalną kopią. Jeżeli kryteria różnią się, zaktualizować ten dokument. Ostateczna akceptacja należy do prowadzących.
