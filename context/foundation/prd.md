---
project: MilkyWayTrader
version: 1
status: draft
created: 2026-09-16
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 1
  hard_deadline: 2026-11-04
  after_hours_only: true
---

# MilkyWayTrader — PRD

## Vision & Problem Statement

Osoba chce lekkiej, ale nie całkiem bezmyślnej rozrywki bez instalowania gry i bez uczenia się złożonych mechanik. W ciągu 10–20 minut chce szybko wejść w prostą pętlę: kupić, sprzedać, zarobić, ulepszyć, odkryć i powtórzyć.

MilkyWayTrader odpowiada na tę potrzebę jako przeglądarkowa mini-handlówka, w której gracz jest krową astronautą. Motyw krowy astronauty nadaje grze rozpoznawalny humor i ma być częścią świata gry, a nie wyłącznie dekoracją. Pożądana emocja gracza to: „Jeszcze tylko jeden lot… zobaczę, ile zarobię na tym mleku.”

## User & Persona

Główna persona to gracz okazjonalny szukający krótkiej sesji w przeglądarce. Ma około 10–20 minut, chce rozpocząć grę bez instalacji i bez długiej nauki, ale oczekuje prostych decyzji ekonomicznych, które dają poczucie postępu i zachęcają do kolejnego lotu.

## Success Criteria

### Primary
- Gracz anonimowy może ukończyć kompletną sesję: eksploruj → kup → leć → sprzedaj → zarób → zobacz wynik.
- Gracz widzi poprawnie obliczony stan środków, cargo, kosztów transakcji, kosztu podróży i zysku po sprzedaży.

### Secondary
- Zalogowany gracz może zapisać stan gry, odczytać go po ponownym otwarciu, zaktualizować po kolejnej turze i usunąć zapis.
- Zalogowany gracz może zapisać wynik i zobaczyć go w tabeli wyników.

### Guardrails
- Gra pozostaje grywalna anonimowo; logowanie nie jest wymagane do rozpoczęcia sesji.
- Podstawowa sesja mieści się w krótkiej rozgrywce przeznaczonej na około 10–20 minut.
- Operacje kupna, sprzedaży, podróży i obliczenia wyniku nie pozwalają na wydanie niedostępnych środków ani przekroczenie pojemności cargo.

## User Stories

### US-01: Gracz kończy sesję handlową z wynikiem

- **Given** Gracz rozpoczął anonimową sesję, ma kredyty i znajduje się na planecie startowej.
- **When** Wybiera planetę, kupuje towary, gra aktualizuje kredyty oraz cargo, leci na inną planetę, gra zwiększa turę o 1 za każdy przelot, a następnie sprzedaje towary i aktualizuje kredyty oraz cargo.
- **Then** Gra pokazuje wynik sesji po zakończeniu lub osiągnięciu limitu tur.

#### Acceptance Criteria
- Każdy przelot zwiększa licznik tur o 1.
- Kupno i sprzedaż aktualizują kredyty oraz cargo.
- Wynik sesji jest pokazany po zakończeniu gry lub osiągnięciu limitu tur.

# TODO: user stories i kryteria akceptacji dla ulepszenia cargo, dynamicznych cen oraz opcjonalnego logowania, zapisu, wznowienia i tabeli wyników — see Open Questions

## Functional Requirements

### Session and map

- FR-001: Gracz może rozpocząć grę z ekranu startowego, na którym widzi nazwę gry i może opcjonalnie zalogować się przez Google. Priority: must-have
  > Socrates: Counter-argument considered: "Ekran startowy może wydłużyć wejście do krótkiej sesji." Resolution: kept; ekran pokazuje nazwę gry, udostępnia opcjonalne logowanie Google, jest pierwszym kliknięciem potrzebnym do uruchomienia dźwięku, jeśli dźwięk zostanie dodany, oraz umożliwia rozpoczęcie nowej sesji.
- FR-002: Gracz może rozpocząć anonimową sesję. Priority: must-have
  > Socrates: Counter-argument considered: "Anonimowa sesja nie pozwoli od razu zapisać postępu ani wyniku." Resolution: kept; wymaganie logowania przed pierwszą rozgrywką może odrzucić graczy, którzy chcą najpierw sprawdzić, czy gra jest dla nich.
- FR-003: Gracz może zobaczyć mapę z planetami. Priority: must-have
  > Socrates: Counter-argument considered: "Mapa może być zbędnym ekranem pośrednim, a jedna lub dwie planety byłyby prostsze." Resolution: kept; mapa jest podstawowym krokiem gracza, a co najmniej trzy planety są potrzebne, ponieważ jedna nie daje celu podróży, a dwie nie dają graczowi realnego wyboru między celami.
- FR-004: Gracz może zaznaczyć lub odznaczyć planetę, aby zobaczyć informacje o niej. Priority: must-have
  > Socrates: Counter-argument considered: "Informacje o planetach mogłyby być stale widoczne, bez zaznaczania." Resolution: kept; zaznaczenie pełni dwie funkcje: pozwala sprawdzić podstawowe informacje o planecie oraz wybrać ją jako cel podróży po porównaniu dostępnych opcji.
- FR-005: Gracz może polecieć na inną planetę. Priority: must-have
  > Socrates: Counter-argument considered: "Lot mógłby być automatyczny po wyborze planety albo pominięty." Resolution: kept; lot na inną planetę jest podstawowym krokiem gracza, ponieważ bez niego nie ma możliwości handlu między planetami.

### Ship and cargo

- FR-006: Gracz może zobaczyć aktualny stan statku. Priority: must-have
  > Socrates: Counter-argument considered: "Informacja o statku mogłaby być ograniczona do samego obrazu statku." Resolution: kept; gracz musi widzieć parametry statku, w tym maksymalną powierzchnię magazynową, aby wiedzieć, ile towaru może przewozić, na przykład maksymalnie 20 jednostek.
- FR-007: Gracz może zobaczyć aktualny stan cargo i przewożonych towarów. Priority: must-have
  > Socrates: Counter-argument considered: "Cargo mogłoby być częścią ogólnego panelu statku i nie musi być stale widoczne." Resolution: kept; stały podgląd cargo wspiera decyzję o trasie, ponieważ gracz widzi, że ma towar potrzebny na planecie A, ale nie na planecie B, i może wybrać lot na planetę A.
- FR-008: Gracz może zobaczyć liczbę posiadanych kredytów. Priority: must-have
  > Socrates: Counter-argument considered: "Kredyty mogłyby być widoczne dopiero na rynku." Resolution: kept; liczba kredytów jest fundamentem gry handlowej i gracz musi znać swój budżet, aby ocenić możliwości zakupu oraz podejmować decyzje ekonomiczne.

### Market

- FR-009: Gracz może odwiedzić rynek na planecie. Priority: must-have
  > Socrates: Counter-argument considered: "Każda planeta mogłaby mieć wiele typów lokacji, co lepiej wspierałoby eksplorację." Resolution: kept; w MVP każda planeta ma tylko rynek, a inne typy lokacji pozostają możliwym rozszerzeniem doświadczenia eksploracji.
- FR-010: Gracz może zobaczyć towary produkowane na danej planecie. Priority: must-have
  > Socrates: Counter-argument considered: "Gracz mógłby sam odkrywać produkcję towarów przez eksperymentowanie." Resolution: kept; towary produkowane przez planetę są wyróżnione, ponieważ wysoka podaż może oznaczać atrakcyjną cenę, a gra ma wspierać decyzję gracza zamiast wymagać analizy w arkuszu kalkulacyjnym.
- FR-011: Gracz może zobaczyć towary, których na danej planecie brakuje. Priority: must-have
  > Socrates: Counter-argument considered: "Informacja o niedoborach mogłaby zbyt mocno podpowiadać optymalną sprzedaż." Resolution: kept; towary najbardziej potrzebne planecie są wyróżnione, ponieważ niski poziom podaży może oznaczać wysoką cenę, a gra ma wspierać szybką, przyjemną decyzję zamiast wymagać analizy w arkuszu.
- FR-012: Gracz może kupić towary na rynku planety. Priority: must-have
  > Socrates: Counter-argument considered: "Zakup mógłby być automatyczny albo ograniczony do jednego domyślnego towaru." Resolution: kept; zakup towarów jest podstawowym krokiem gry handlowej, ponieważ bez niego nie ma decyzji, co przewozić i na czym zarabiać.
- FR-013: Gracz może sprzedać towary na rynku planety. Priority: must-have
  > Socrates: Counter-argument considered: "Sprzedaż mogłaby następować automatycznie po dotarciu na planetę." Resolution: kept; sprzedaż jest podstawowym krokiem gry handlowej, ponieważ zamyka pętlę kupna, transportu i zarabiania.

### Session completion

- FR-014: Gracz może zobaczyć wynik sesji po osiągnięciu limitu 30 tur. Priority: must-have
  > Socrates: Counter-argument considered: "Gra mogłaby trwać bez końca, a wynik byłby zależny od czasu poświęconego przez gracza." Resolution: kept; limit 30 tur jest potrzebny, aby wyniki graczy można było uczciwie porównywać w high score. Nieskończona rozgrywka może być osobnym trybem post-MVP.
- FR-015: Gracz może w dowolnym momencie zakończyć grę po potwierdzeniu wyboru Tak lub Nie, a następnie rozpocząć nową sesję. Priority: must-have
  > Socrates: Counter-argument considered: "Potwierdzenie zakończenia może spowolnić rozgrywkę albo gracz może przypadkowo zakończyć dobrą sesję." Resolution: kept; gracz może zakończyć sesję, aby rozpocząć nową, gdy obecna mu nie odpowiada, albo aby wymusić zapis i wrócić później, gdy musi przerwać. Wznowienie po zapisie dotyczy zalogowanego gracza.

### Optional account and persistence

- FR-016: Gracz może zalogować się przez Google przed rozpoczęciem lub w trakcie gry. Priority: nice-to-have
- FR-017: Zalogowany gracz może utworzyć, odczytać, zaktualizować i usunąć zapis swojej sesji. Priority: nice-to-have
- FR-018: Zalogowany gracz może wznowić zapisaną sesję po ponownym otwarciu gry. Priority: nice-to-have
- FR-019: Zalogowany gracz może zapisać wynik ukończonej sesji w tabeli wyników. Priority: nice-to-have
- FR-020: Gracz może odczytać tabelę wyników i porównać swój wynik z wynikami innych graczy. Priority: nice-to-have
- FR-021: Anonimowy lub zalogowany gracz może kupić ulepszenie zwiększające maksymalną ładowność statku. Priority: must-have
  > Socrates: Counter-argument considered: "Ulepszenie może zwiększyć zakres i wymagać dodatkowego balansu ekonomii." Resolution: kept as must-have; po zarobieniu większej liczby kredytów początkowy limit cargo staje się wąskim gardłem, więc anonimowy gracz potrzebuje możliwości rozwinięcia ładowności, aby kontynuować rozwój jako handlarz.
- FR-022: Gracz może zobaczyć poziom konsumpcji towarów na danej planecie. Priority: must-have
  > Socrates: Counter-argument considered: "Informacja o konsumpcji może zbyt mocno podpowiadać optymalną decyzję i ograniczyć odkrywanie." Resolution: kept; konsumpcja jest informacją, na podstawie której gracz może przewidywać przyszłe zmiany cen na planecie i planować kolejne transakcje.
- FR-023: Gra może aktualizować ceny towarów po transakcjach na podstawie lokalnej podaży, popytu, produkcji i konsumpcji. Priority: must-have
  > Socrates: Counter-argument considered: "Dynamiczne ceny mogą zwiększyć trudność balansu oraz testowania, a zbyt częste zmiany mogą dawać graczowi poczucie braku kontroli." Resolution: kept as must-have; model cenowy jest konieczny, aby rynki planet były mini-symulacją zamiast losowym systemem i odzwierciedlały wpływ decyzji gracza na świat gry.

## Non-Functional Requirements

- Gra pozostaje używalna w przeglądarkach Chrome i Edge.
- Interakcje gry zapewniają natychmiastową reakcję widoczną dla gracza; zapis gry nie opóźnia reakcji interfejsu.
- Gdy opcjonalny zapis gry do chmury jest aktywny, zapis odbywa się w tle i nie wpływa na czas reakcji rozgrywki.
- Gdy opcjonalny zapis do chmury się nie powiedzie, gra ponawia próbę co sekundę maksymalnie pięć razy.
- Gdy pięć kolejnych prób zapisu się nie powiedzie, gracz otrzymuje powiadomienie o chwilowym problemie z zapisem; gra ponawia próby co 30 sekund.
- Gdy zapis po wcześniejszym błędzie się powiedzie, gracz otrzymuje powiadomienie, że gra została zapisana.

# TODO: mierzalny czas reakcji interfejsu i obsługiwane wersje przeglądarek — see Open Questions

## Business Logic

Cena towaru na każdej planecie wynika z relacji między jego lokalną podażą a popytem, a każda transakcja wpływa na tę relację.

Gra bierze pod uwagę lokalną konsumpcję, popyt, podaż i produkcję planety. Po każdej transakcji aktualizuje relację podaży i popytu oraz wynikającą z niej cenę towaru. Rezultatem jest cena towaru widoczna dla gracza na rynku. Gracz spotyka tę regułę podczas wyboru towaru do kupna oraz planety docelowej, na której chce go sprzedać.

# TODO: wzór wyniku sesji, szczegółowe reguły ekonomii i stan początkowy — see Open Questions
# TODO: kolejność zakończenia 30. tury oraz rozróżnienie zakończenia i przerwania sesji — see Open Questions

## Access Control

Gra jest dostępna anonimowo bez zakładania konta. Opcjonalne logowanie Google odblokowuje zapis gry i tabelę wyników. Wszyscy zalogowani gracze mają ten sam zakres uprawnień; MVP nie wprowadza dodatkowych ról.
Każdy gracz ma własny, niezależny stan sesji i danych. MVP nie obejmuje multiplayera ani wspólnego rynku.

# TODO: uprawnienia do odczytu tabeli wyników — see Open Questions

## Non-Goals

- MVP nie obejmuje multiplayera ani wspólnego rynku, ponieważ każdy gracz ma własny niezależny stan sesji.
- MVP nie obejmuje nieskończonego trybu gry, ponieważ limit 30 tur jest potrzebny do porównywania wyników.
- MVP nie obejmuje lokacji planet innych niż rynek, ponieważ rynek wystarcza do podstawowej pętli handlowej.
- MVP nie wymaga logowania przed pierwszą sesją, ponieważ anonimowy start zmniejsza próg wejścia.
- MVP nie obejmuje zaawansowanych wydarzeń losowych, ponieważ utrudniłyby balans i testowanie pierwszej wersji.

- FR-016–FR-020 (logowanie Google, zapis i wznowienie sesji oraz zapis i odczyt tabeli wyników) mają priorytet nice-to-have; zgodnie ze schematem PRD nie są warunkiem dostarczenia MVP. Notatki ujmują je również jako Secondary; docelowy zakres pierwszego wydania wymaga doprecyzowania.

# TODO: potwierdzenie zakresu funkcji konta i tabeli wyników w pierwszym wydaniu — see Open Questions

## Open Questions

1. **Czy końcowy checkpoint shaping został zaakceptowany?** — Notatki mają `current_phase: 7` i `quality_check_status: pending`, mimo że sekcja Quality cross-check wymienia obecne elementy. Nie zapisano finalizacji fazy 8 ani akceptacji kontroli jakości. Owner: użytkownik. Termin: nieustalony.
2. **Jak obliczany jest wynik sesji i zysk po sprzedaży?** — Nie określono wzoru wyniku, sposobu wyceny niesprzedanego cargo i ulepszeń ani uwzględnienia kosztów transakcji i podróży. Bez tych reguł nie można zweryfikować poprawności wyniku i porównywać sesji. Owner: użytkownik. Termin: nieustalony.
3. **Jakie są dokładne reguły ekonomii rynku?** — Notatki określają zależność ceny od lokalnej podaży, popytu, produkcji i konsumpcji oraz aktualizację po transakcjach, ale nie określają wzoru, granic cen, zaokrągleń, momentu naliczania produkcji i konsumpcji ani ceny rozliczenia zakupu lub sprzedaży wielu jednostek. Owner: użytkownik. Termin: nieustalony.
4. **Jaki jest stan początkowy i zestaw parametrów rozgrywki?** — Nie określono liczby początkowych kredytów, planety startowej, początkowego cargo i jego pojemności, zestawu planet i towarów, kosztów podróży i transakcji ani cen, dostępności i efektów ulepszeń ładowności. Co najmniej trzy planety wynikają z uzasadnienia FR-003; 20 jednostek cargo w FR-006 jest przykładem, a nie ustaloną wartością. Owner: użytkownik. Termin: nieustalony.
5. **Kiedy dokładnie kończy się sesja przy limicie 30 tur?** — Każdy przelot zwiększa turę o 1. Nie ustalono, czy po 30. przelocie gracz może jeszcze sprzedać towary lub wykonać inne operacje na rynku przed obliczeniem wyniku. Owner: użytkownik. Termin: nieustalony.
6. **Jak odróżnić zakończenie sesji od przerwania gry z możliwością wznowienia?** — FR-015 opisuje zakończenie gry po potwierdzeniu Tak lub Nie i rozpoczęcie nowej sesji, a uzasadnienie obejmuje również wymuszenie zapisu i późniejszy powrót. Nie ustalono statusu takiej sesji, momentu zapisu ani możliwości zapisania jej wyniku w tabeli, gdy nie osiągnięto 30 tur. Owner: użytkownik. Termin: nieustalony.
7. **Czy anonimowy gracz może odczytać tabelę wyników?** — Access Control mówi, że logowanie Google odblokowuje zapis gry i tabelę wyników, natomiast FR-020 pozwala odczytać tabelę „graczowi” bez wskazania wymogu logowania. Reguła dostępu wymaga uzgodnienia. Owner: użytkownik. Termin: nieustalony.
8. **Czy FR-016–FR-020 należą do pierwszego wydania?** — Mają priorytet nice-to-have, który według schematu oznacza zakres poza obowiązkowym MVP, ale są również zapisane jako Secondary oraz elementy opcjonalnego dostępu. Trzeba potwierdzić zakres pierwszego wydania i spójność FR-001 z opcjonalnym logowaniem opisanym w FR-016. Owner: użytkownik. Termin: nieustalony.
9. **Jakie są brakujące user stories i kryteria akceptacji?** — Notatki zawierają jedynie US-01 dla podstawowej pętli handlowej. Nie zawierają osobnych historii i kryteriów dla ulepszenia cargo, dynamicznych cen oraz opcjonalnego logowania, zapisu, wznowienia i tabeli wyników. Owner: użytkownik. Termin: nieustalony.
10. **Jaki mierzalny czas reakcji i jakie wersje przeglądarek mają obowiązywać?** — „Natychmiastowa reakcja” nie ma liczbowego progu, a wsparcie Chrome i Edge nie wskazuje wersji. Bez tych ustaleń kryteria jakości pozostają częściowo niejednoznaczne. Owner: użytkownik. Termin: nieustalony.
