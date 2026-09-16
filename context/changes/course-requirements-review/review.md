# MilkyWayTrader — pokrycie zasad zaliczenia

Data oceny: 2026-09-16.

**Wniosek warunkowy:** pomysł nadaje się na projekt zaliczeniowy według dostępnych lokalnych zasad 10XDevs 4.0. Obowiązkowy zakres obecnego PRD nie zapewnia jednak wszystkich wymaganych elementów: kontrola dostępu i pełny CRUD są odłożone do funkcji nice-to-have, a test z perspektywy użytkownika nie jest zapisany jako warunek dostarczenia.

## Źródła i ograniczenie oceny

- Wskazana strona: https://platforma.przeprogramowani.pl/courses/10xdevs-foundations/pl/15. Próba odczytu przekierowała do ekranu logowania. Połączenie narzędzia przeglądarki było niedostępne. Nie odczytano treści tej lekcji ani nie potwierdzono jej aktualnych wymagań.
- Lokalna kopia zasad: [.agents/skills/10x-idea-check/references/10xdevs-4-certification.md](../../../.agents/skills/10x-idea-check/references/10xdevs-4-certification.md), szczególnie lista wymagań obowiązkowych w wierszach 27–39.
- Lokalna kopia terminów: [.agents/skills/10x-idea-check/references/10xdevs-4-dates.md](../../../.agents/skills/10x-idea-check/references/10xdevs-4-dates.md). W razie oceny terminu należy użyć tego dokumentu, ponieważ tekst certyfikacji zawiera starszą datę lipcową.
- Oceniany dokument: [context/foundation/prd.md](../../foundation/prd.md).
- `.10x-cli.json` przypisuje projekt do `10xdevs4`. Zgodność lokalnej kopii zasad z podanym adresem kursu wymaga potwierdzenia po udostępnieniu treści strony.

Ocena dotyczy pokrycia wymagań w dokumentacji. Zapis wymagania w PRD nie dowodzi jego realizacji ani akceptacji przez prowadzących. Nie zmieniono PRD, zakresu gry, kodu ani konfiguracji.

## Pokrycie obowiązkowej listy 10xBuilder

| Wymaganie lokalnych zasad | Pokrycie w PRD | Ocena i potrzebne działanie |
| --- | --- | --- |
| Kontrola dostępu odpowiednia dla aplikacji | FR-016 i Access Control przewidują Google login i funkcje dostępne po zalogowaniu. FR-016 ma nice-to-have; FR-001 jednocześnie wspomina logowanie w must-have. | Częściowe i niespójne. W zakresie zaliczeniowym zapewnić działające logowanie i ochronę prywatnych zapisów. Anonimowa rozgrywka może pozostać dostępna. |
| Tworzenie, odczyt, aktualizacja i usuwanie danych (CRUD), sensowne dla domeny | FR-017 opisuje wszystkie cztery operacje na zapisie sesji. FR-018 opisuje wznowienie. Oba mają nice-to-have. | Trafna domena CRUD, ale brak gwarancji w obowiązkowym MVP. Włączyć zapis sesji do zakresu zaliczeniowego. Kupno i sprzedaż zmieniają stan gry, ale same nie dokumentują pełnego CRUD trwałych danych. |
| Logika biznesowa | FR-012–FR-014 oraz FR-021–FR-023: handel, wynik, cargo, ulepszenia i ceny zależne od rynku; guardrails ograniczają wydatki i pojemność. | Pokryte na poziomie pomysłu i zakresu. Doprecyzować wzory, moment naliczania zmian, zaokrąglenia i wynik, aby można było zweryfikować poprawność. |
| Dokumenty kontekstowe | PRD istnieje; są też shape-notes.md, tech-stack.md oraz dzienniki bootstrapu. | Pokryte jako dokumentacja. PRD ma status draft i otwarte decyzje. Przykładowe nazwy infrastructure.md i roadmap.md w zasadach nie stanowią wymogu dokładnie tych plików. |
| Co najmniej jeden test sprawdzający działanie z perspektywy użytkownika | US-01 zawiera kryteria akceptacji, ale PRD nie wymaga uruchamialnego testu użytkownika. tech-stack.md wspomina Playwright. | Brak obowiązkowego kryterium testowego. Dodać warunek dostarczenia testu E2E najważniejszego przepływu. Kryteria akceptacji i udany build nie zastępują testu użytkownika. |

## Najmniejsza korekta zakresu

1. Przyjąć FR-016 i FR-017 jako must-have dla wersji oddawanej na zaliczenie. FR-018 również powinien wejść do tego zakresu, jeśli zapis ma służyć późniejszemu powrotowi do gry. Rozgrywka bez logowania pozostaje dostępna; logowanie odblokowuje zapis.
2. Doprecyzować ochronę danych: zalogowany użytkownik może tworzyć, odczytywać, aktualizować i usuwać wyłącznie własne zapisy. Egzekwować tę regułę także w usłudze przechowującej dane. Ukrycie przycisku w interfejsie nie zapewnia ochrony danych.
3. Uzgodnić FR-001, Success Criteria, Non-Goals i Open Question 8 z zakresem zaliczeniowym. Można nadal dostarczyć wcześniejszą anonimową wersję demonstracyjną, ale wersja anonimowa bez CRUD nie pokrywa dostępnej obowiązkowej listy.
4. Dodać mierzalne kryterium: co najmniej jeden uruchamialny test E2E sprawdza rezultat działania widoczny dla gracza. Przykład: rozpoczęcie sesji, zakup, lot, sprzedaż i poprawna zmiana kredytów oraz cargo. Dla zapisu sesji opisać także kryteria tworzenia, odczytu po ponownym otwarciu, aktualizacji i usunięcia.
5. Zamknąć decyzje domenowe z Open Questions 2–6: wynik i zysk, reguły cen, stan początkowy, przebieg 30. tury oraz zakończenie/wznowienie sesji. Uzupełnić historie i kryteria akceptacji dla wymaganych funkcji.

Tabela wyników FR-019–FR-020 nie jest konieczna do pokrycia pięciu powyższych wymagań. Może pozostać nice-to-have; zapis sesji zapewnia naturalny CRUD bez rozbudowywania zakresu o ranking.

## Architektura i realizacja

Lokalne zasady opisują 10xBuilder we wstępie jako full-stackowe MVP z wdrożeniem w chmurze, ale publiczny URL wymieniają jako opcjonalny i dopuszczają inne typy aplikacji. Nie traktuję publicznego URL jako dodatkowego obowiązkowego punktu dla każdego projektu. Dla tej gry planowane Cloudflare Pages jest zgodne z celem udostępnienia aplikacji; sam statyczny frontend nie zapewnia jednak chronionego zapisu w chmurze. Trzeba zaplanować usługę uwierzytelniania, trwałe dane i egzekwowanie uprawnień, bez konieczności zmiany Phaser/Vite.

AI w samym produkcie nie jest wymagane: logika biznesowa może działać bez modelu językowego. Stos technologiczny jest dowolny; Phaser nie jest powodem odrzucenia. Obecna praca nad kontekstem i bootstrapem pokazuje użycie agenta w procesie wytwarzania. Z dostępnych zasad nie wynika próg liczby promptów, tokenów ani wymagany dostawca AI.

CI/CD jest opisane w dodatkowym bloku 10xChampion; nie dopisuję go do pięciu jawnych obowiązkowych kryteriów 10xBuilder. Przy wdrożeniu warto zachować dokumentację procesu i dowody testów.

Obecny kod zawiera demonstracyjne sceny startera Phaser. `package.json` nie zawiera runnera ani skryptów testów. Build i kontrola TypeScript przeszły podczas bootstrapu, ale nie są dowodem wykonania wymagań gry, kontroli dostępu czy CRUD. Projekt nie jest jeszcze gotowy do oddania jako działający produkt.

## Co wymaga potwierdzenia

Po udostępnieniu treści wskazanej lekcji porównać jej listę z lokalną kopią 10XDevs 4.0. Jeśli kryteria różnią się, zaktualizować tę ocenę na podstawie właściwego kursu. Ostateczna akceptacja należy do prowadzących.
