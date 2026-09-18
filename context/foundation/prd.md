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

- Gracz anonimowy może ukończyć kompletną sesję: eksploruj → kup → leć → sprzedaj → zarób → zobacz wynik. Wynik to suma gotówki, wartości przewożonych towarów wycenionych po 100% cen bazowych i wartości statku, pokazana wraz z rozbiciem na te trzy składniki.
- Gracz może zalogować się przez Google OAuth przed rozpoczęciem lub w trakcie gry i widzi status zalogowania oraz informację, czy autozapis gry jest aktywny. Zalogowany gracz może zapisać stan gry, odczytać go po ponownym otwarciu i aktualizować z każdą nową turą; zapis nigdy nie jest usuwany.

### Secondary

- Zalogowany gracz może zapisać wynik i zobaczyć go w tabeli wyników.

### Guardrails

- Gra pozostaje grywalna anonimowo; logowanie nie jest wymagane do rozpoczęcia sesji.
- Podstawowa sesja mieści się w krótkiej rozgrywce przeznaczonej na około 10–20 minut.
- Operacje kupna, sprzedaży, podróży i obliczenia wyniku nie pozwalają na wydanie niedostępnych środków ani przekroczenie pojemności cargo.

## User Stories

### US-01: Gracz kończy sesję handlową z wynikiem

- **Given** Gracz rozpoczął anonimową sesję na planecie Seroton w turze 1, ma 1000 kredytów, pustą ładownię i statek o ładowności 20 jednostek.
- **When** Kupuje i sprzedaje towary oraz podróżuje między planetami, każdy przylot zwiększa numer tury o 1; w turze 30 naciska „leć”.
- **Then** Gra kończy sesję i pokazuje gotówkę, wartość przewożonych towarów, wartość statku oraz sumę tych trzech składników.

#### Acceptance Criteria

- Sesja rozpoczyna się na planecie Seroton ze statusem `Running` i `Turn = 1`.
- Przerwanie gry zachowuje status `Running`; zakończenie sesji ustawia `Finished`.
- Zapisana sesja `Running` może być wznowiona z zapisanym numerem `Turn`; sesja `Finished` jest zakończona.
- Podróże nie kosztują kredytów, a kupno nie ma dodatkowych opłat transakcyjnych.
- Każda sprzedaż podlega podatkowi planety: Seroton 5%, Lactozis-7C i Maslo-Prime 3%.
- Podatek = `round(wartość sprzedaży brutto × TAX)`; kredyty gracza zwiększają się o wartość sprzedaży brutto pomniejszoną o ten podatek.
- Pierwszy przylot na kolejną planetę rozpoczyna turę 2.
- Kupno i sprzedaż aktualizują kredyty oraz cargo.
- Samo rozpoczęcie tury 30 nie kończy sesji.
- Naciśnięcie „leć” przy `Turn = 30` ustawia status `Finished` i kończy sesję zamiast rozpoczynać kolejny lot.
- Wynik jest sumą gotówki, wartości towarów w cargo i wartości statku; wszystkie trzy składniki oraz suma są widoczne.
- Wartość cargo na koniec sesji = suma liczby jednostek każdego towaru pomnożonej przez jego cenę bazową (100%), niezależnie od bieżących cen na planetach.
- Wartość statku na koniec sesji = Cum Sum kosztów ulepszeń dla osiągniętego poziomu; poziom 1 jest wart 0 kredytów, a poziom 8 jest wart 47500 kredytów.

### US-02: Zalogowany gracz otrzymuje autozapis po przylocie

- **Given** Gracz jest zalogowany i trwa jego sesja.
- **When** Dolatuje do planety.
- **Then** Gra automatycznie zapisuje sesję i pokazuje na ekranie powiadomienie o autozapisie.

#### Acceptance Criteria

- Każdy przylot zalogowanego gracza rozpoczyna nową turę i uruchamia aktualizację zapisu obejmującą status sesji, bieżący numer `Turn` i `timestamp` oznaczający datę i czas zapisu.
- Zapis gry nigdy nie jest usuwany.
- Gracz otrzymuje widoczne powiadomienie o autozapisie.
- Autozapis po przylocie nie jest wykonywany dla anonimowego gracza.
- Gracz widzi status zalogowania i informację, czy autozapis jest aktywny.

### US-03: Gracz odczytuje globalną lub własną tabelę wyników

- **Given** Dostępna jest funkcja tabeli wyników o priorytecie nice-to-have.
- **When** Anonimowy gracz odczytuje all-time-hi-score albo zalogowany gracz odczytuje swoje the-best-of.
- **Then** Anonimowy gracz widzi globalną tabelę, a zalogowany gracz może zobaczyć własne najlepsze wyniki.

#### Acceptance Criteria

- Globalne all-time-hi-score jest dostępne bez logowania.
- Anonimowy gracz nie ma dostępu do własnych the-best-of.
- Zalogowany gracz ma dostęp do własnych the-best-of.

### US-04: Zalogowany gracz kontynuuje sesję albo rozpoczyna nową

- **Given** Zalogowany gracz opuścił grę i ma zapis poprzedniej sesji ze statusem `Running`.
- **When** Ponownie uruchamia grę i wybiera „KONTYNUUJ” albo „NOWA GRA”.
- **Then** „KONTYNUUJ” wczytuje poprzedni zapis, a „NOWA GRA” oznacza poprzednią sesję jako `Finished`, tworzy nową sesję `Running` i zapisuje ją z `Turn = 1`.

#### Acceptance Criteria

- Zalogowany gracz z zapisaną sesją `Running` ma do wyboru „KONTYNUUJ” i „NOWA GRA”.
- „KONTYNUUJ” wczytuje zapisany stan i jego numer `Turn`.
- „NOWA GRA” zmienia status ostatniej sesji na `Finished`, zachowuje jej zapis, tworzy nowy stan `Running` i zapisuje go w turze 1.
- Każdy zapisywany stan gry ma `timestamp` oznaczający datę i czas danego zapisu; znacznik jest aktualizowany przy każdym kolejnym zapisie, również przy zmianie statusu na `Finished`.
- Nowa sesja rozpoczyna się na Seroton z 1000 kredytów, pustą ładownią i statkiem poziomu 1 o ładowności 20 jednostek.
- Wczytywanie poprzedniego stanu i zapis nowej sesji w turze 1 są dostępne wyłącznie dla zalogowanych graczy.

## Functional Requirements

Cytaty Socrates dokumentują wcześniejszą dyskusję; aktualne wymagania i priorytety uwzględniają późniejsze decyzje użytkownika.

### Session and map

- FR-001: Gracz może rozpocząć grę z ekranu startowego, na którym widzi nazwę gry i może opcjonalnie zalogować się przez Google OAuth. Priority: must-have
  > Socrates: Counter-argument considered: "Ekran startowy może wydłużyć wejście do krótkiej sesji." Resolution: kept; ekran pokazuje nazwę gry, udostępnia opcjonalne logowanie przez Google OAuth, jest pierwszym kliknięciem potrzebnym do uruchomienia dźwięku, jeśli dźwięk zostanie dodany, oraz umożliwia rozpoczęcie nowej sesji.
- FR-002: Gracz może rozpocząć anonimową sesję. Priority: must-have
  > Socrates: Counter-argument considered: "Anonimowa sesja nie pozwoli od razu zapisać postępu ani wyniku." Resolution: kept; wymaganie logowania przed pierwszą rozgrywką może odrzucić graczy, którzy chcą najpierw sprawdzić, czy gra jest dla nich.
- FR-003: Gracz może zobaczyć mapę z planetami. Priority: must-have
  > Socrates: Counter-argument considered: "Mapa może być zbędnym ekranem pośrednim, a jedna lub dwie planety byłyby prostsze." Resolution: kept; mapa jest podstawowym krokiem gracza, a co najmniej trzy planety są potrzebne, ponieważ jedna nie daje celu podróży, a dwie nie dają graczowi realnego wyboru między celami.
- FR-004: Gracz może zaznaczyć lub odznaczyć planetę, aby zobaczyć informacje o niej. Priority: must-have
  > Socrates: Counter-argument considered: "Informacje o planetach mogłyby być stale widoczne, bez zaznaczania." Resolution: kept; zaznaczenie pełni dwie funkcje: pozwala sprawdzić podstawowe informacje o planecie oraz wybrać ją jako cel podróży po porównaniu dostępnych opcji.
- FR-005: Gracz może polecieć na inną planetę bez kosztu podróży przed turą 30; sesja rozpoczyna się w turze 1, a każdy przylot zwiększa numer tury o 1. Priority: must-have
  > Socrates: Counter-argument considered: "Lot mógłby być automatyczny po wyborze planety albo pominięty." Resolution: kept; lot na inną planetę jest podstawowym krokiem gracza, ponieważ bez niego nie ma możliwości handlu między planetami.

### Ship and cargo

- FR-006: Gracz może zobaczyć aktualny stan statku. Priority: must-have
  > Socrates: Counter-argument considered: "Informacja o statku mogłaby być ograniczona do samego obrazu statku." Resolution: kept; gracz musi widzieć parametry statku, w tym maksymalną powierzchnię magazynową, aby wiedzieć, ile towaru może przewozić, na przykład maksymalnie 20 jednostek.
- FR-007: Gracz może zobaczyć aktualny stan cargo i przewożonych towarów. Priority: must-have
  > Socrates: Counter-argument considered: "Cargo mogłoby być częścią ogólnego panelu statku i nie musi być stale widoczne." Resolution: kept; stały podgląd cargo wspiera decyzję o trasie, ponieważ gracz widzi, że ma towar potrzebny na planecie A, ale nie na planecie B, i może wybrać lot na planetę A.
- FR-008: Gracz może zobaczyć liczbę posiadanych kredytów. Priority: must-have
  > Socrates: Counter-argument considered: "Kredyty mogłyby być widoczne dopiero na rynku." Resolution: kept; liczba kredytów jest fundamentem gry handlowej i gracz musi znać swój budżet, aby ocenić możliwości zakupu oraz podejmować decyzje ekonomiczne.

### Ship upgrade costs

Koszt ulepszenia oznacza koszt osiągnięcia danego poziomu z poziomu poprzedniego. Wartość statku na koniec gry jest równa skumulowanej sumie kosztów dla osiągniętego poziomu (Cum Sum).

| Statek Level | Cargo (jednostki) | Upgrade cost (kredyty) | Cum Sum / wartość statku (kredyty) |
| ---: | ---: | ---: | ---: |
| 1 | 20 | 0 | 0 |
| 2 | 40 | 500 | 500 |
| 3 | 80 | 1000 | 1500 |
| 4 | 140 | 2000 | 3500 |
| 5 | 220 | 4000 | 7500 |
| 6 | 320 | 6000 | 13500 |
| 7 | 480 | 12000 | 25500 |
| 8 | 700 | 22000 | 47500 |

### Market

- FR-009: Gracz może odwiedzić rynek na planecie. Priority: must-have
  > Socrates: Counter-argument considered: "Każda planeta mogłaby mieć wiele typów lokacji, co lepiej wspierałoby eksplorację." Resolution: kept; w MVP każda planeta ma tylko rynek, a inne typy lokacji pozostają możliwym rozszerzeniem doświadczenia eksploracji.
- FR-010: Gracz może zobaczyć towary produkowane na danej planecie. Priority: must-have
  > Socrates: Counter-argument considered: "Gracz mógłby sam odkrywać produkcję towarów przez eksperymentowanie." Resolution: kept; towary produkowane przez planetę są wyróżnione, ponieważ wysoka podaż może oznaczać atrakcyjną cenę, a gra ma wspierać decyzję gracza zamiast wymagać analizy w arkuszu kalkulacyjnym.
- FR-011: Gracz może zobaczyć towary, których na danej planecie brakuje. Priority: must-have
  > Socrates: Counter-argument considered: "Informacja o niedoborach mogłaby zbyt mocno podpowiadać optymalną sprzedaż." Resolution: kept; towary najbardziej potrzebne planecie są wyróżnione, ponieważ niski poziom podaży może oznaczać wysoką cenę, a gra ma wspierać szybką, przyjemną decyzję zamiast wymagać analizy w arkuszu.
- FR-012: Gracz może kupić towary na rynku planety bez dodatkowych opłat transakcyjnych. Priority: must-have
  > Socrates: Counter-argument considered: "Zakup mógłby być automatyczny albo ograniczony do jednego domyślnego towaru." Resolution: kept; zakup towarów jest podstawowym krokiem gry handlowej, ponieważ bez niego nie ma decyzji, co przewozić i na czym zarabiać.
- FR-013: Gracz może sprzedać towary na rynku planety; od każdej sprzedaży pobierany jest podatek według TAX planety, a gracz otrzymuje wartość sprzedaży brutto pomniejszoną o `round(wartość sprzedaży brutto × TAX)`. Priority: must-have
  > Socrates: Counter-argument considered: "Sprzedaż mogłaby następować automatycznie po dotarciu na planetę." Resolution: kept; sprzedaż jest podstawowym krokiem gry handlowej, ponieważ zamyka pętlę kupna, transportu i zarabiania.

### Session completion

- FR-014: Gracz może zakończyć sesję, naciskając „leć” przy `Turn = 30`, co ustawia status `Finished`, i zobaczyć wynik równy sumie gotówki, wartości towarów w cargo wycenionych po 100% cen bazowych i wartości statku, wraz z rozbiciem na te trzy składniki i sumą. Priority: must-have
  > Socrates: Counter-argument considered: "Gra mogłaby trwać bez końca, a wynik byłby zależny od czasu poświęconego przez gracza." Resolution: kept; limit 30 tur jest potrzebny, aby wyniki graczy można było uczciwie porównywać w high score. Nieskończona rozgrywka może być osobnym trybem post-MVP.
- FR-015: Gracz może w dowolnym momencie zakończyć sesję po potwierdzeniu wyboru Tak lub Nie, co ustawia status `Finished`, a następnie rozpocząć nową sesję ze statusem `Running` i `Turn = 1`; przerwanie gry z możliwością wznowienia zachowuje status `Running`. Priority: must-have
  > Socrates: Counter-argument considered: "Potwierdzenie zakończenia może spowolnić rozgrywkę albo gracz może przypadkowo zakończyć dobrą sesję." Resolution: kept; gracz może zakończyć sesję, aby rozpocząć nową, gdy obecna mu nie odpowiada, albo aby wymusić zapis i wrócić później, gdy musi przerwać. Wznowienie po zapisie dotyczy zalogowanego gracza.

### Account and persistence

- FR-016: Gracz może zalogować się przez Google OAuth przed rozpoczęciem lub w trakcie gry; jest to jedyna metoda logowania. Priority: must-have
- FR-017: Zalogowany gracz może utworzyć, odczytać i zaktualizować zapis swojej sesji obejmujący status `Running` lub `Finished`, numer tury `Turn` oraz `timestamp` oznaczający datę i czas danego zapisu; zapis nigdy nie jest usuwany, a z każdą nową turą jest aktualizowany wraz ze znacznikiem czasu. Priority: must-have
- FR-018: Zalogowany gracz może po ponownym uruchomieniu gry wybrać „KONTYNUUJ”, aby wczytać zapisaną sesję o statusie `Running` i kontynuować od zapisanego numeru `Turn`, albo „NOWA GRA”, aby zakończyć poprzednią sesję i rozpocząć nową; sesja `Finished` nie może być wznowiona do dalszej rozgrywki. Priority: must-have
- FR-019: Zalogowany gracz może zapisać wynik ukończonej sesji w tabeli wyników. Priority: nice-to-have
- FR-020: Anonimowy lub zalogowany gracz może odczytać globalne all-time-hi-score i porównać swój wynik z wynikami innych graczy. Priority: nice-to-have
- FR-021: Anonimowy lub zalogowany gracz może kupić ulepszenie zwiększające poziom i maksymalną ładowność statku zgodnie z tabelą Ship upgrade costs; wartość statku w wyniku końcowym jest równa Cum Sum osiągniętego poziomu. Priority: must-have
  > Socrates: Counter-argument considered: "Ulepszenie może zwiększyć zakres i wymagać dodatkowego balansu ekonomii." Resolution: kept as must-have; po zarobieniu większej liczby kredytów początkowy limit cargo staje się wąskim gardłem, więc anonimowy gracz potrzebuje możliwości rozwinięcia ładowności, aby kontynuować rozwój jako handlarz.
- FR-022: Gracz może zobaczyć poziom konsumpcji towarów na danej planecie. Priority: must-have
  > Socrates: Counter-argument considered: "Informacja o konsumpcji może zbyt mocno podpowiadać optymalną decyzję i ograniczyć odkrywanie." Resolution: kept; konsumpcja jest informacją, na podstawie której gracz może przewidywać przyszłe zmiany cen na planecie i planować kolejne transakcje.
- FR-023: Gra wylicza mnożnik ceny bazowej na początku każdej tury na podstawie stanu magazynowego i progów ilości bazowych `tier1` oraz `tier2` danego towaru oraz aktualizuje ceny po transakcjach i aktualizacji zapasów na koniec tury, niezależnie dla każdej planety i towaru, zgodnie z FR-026. Priority: must-have
  > Socrates: Counter-argument considered: "Dynamiczne ceny mogą zwiększyć trudność balansu oraz testowania, a zbyt częste zmiany mogą dawać graczowi poczucie braku kontroli." Resolution: kept as must-have; model cenowy jest konieczny, aby rynki planet były mini-symulacją zamiast losowym systemem i odzwierciedlały wpływ decyzji gracza na świat gry.

### Authentication and save status

- FR-025: Gracz widzi status zalogowania i informację, czy autozapis gry jest aktywny. Priority: must-have

### Planet Resource Economy

- FR-026: The system shall calculate the price of each resource independently for each planet based on its current stock level. Each resource shall define `productionPerTurn`, `consumptionPerTurn`, `basePrice`, `tier1`, and `tier2`. At the end of each turn, the stock level shall be updated as `stock = max(0, stock + productionPerTurn - consumptionPerTurn)`. The resource price shall be calculated as a percentage of `basePrice` using the following rules: when `stock < tier1`, the price shall scale linearly from 200% of `basePrice` at `stock = 0` to 100% at `stock = tier1`; when `tier1 <= stock <= tier2`, the price shall remain at 100% of `basePrice`; when `tier2 < stock < tier1 + tier2`, the price shall scale linearly from 100% at `stock = tier2` to 50% at `stock = tier1 + tier2`; when `stock >= tier1 + tier2`, the price shall remain at 50% of `basePrice`. Player purchases shall decrease the planet's stock and player sales shall increase it, causing subsequent prices to be recalculated from the resulting stock level. A single transaction shall use the price calculated before that transaction and shall not recalculate the price for individual units within the transaction. Wszystkie operacje ekonomiczne są wykonywane na liczbach całkowitych. Cena jednostkowa transakcji = `round(basePrice × mnożnik ceny)`; wartość transakcji brutto = liczba jednostek × zaokrąglona cena jednostkowa ustalona przed transakcją. Na początku każdej tury mnożnik ceny bazowej wynika ze stanu magazynowego na danej planecie oraz progów ilości bazowych `tier1` i `tier2` towaru z tabeli Commodity base quantities. Priority: must-have

### Commodity base prices (100%)

| Towar | Cena bazowa w kredytach |
| --- | ---: |
| Pasza | 20 |
| Mleko | 50 |
| Jogurt | 70 |
| Ser | 120 |
| Masło | 280 |
| Osłony statku | 520 |
| Komputer pokładowy | 900 |
| Artefakty Obcych | 2400 |

### Commodity base quantities

Na początku każdej tury stan magazynowy danego towaru na planecie oraz progi ilości bazowych `tier1` i `tier2` wyznaczają mnożnik ceny bazowej zgodnie z FR-026. Poniższe wartości określają oba progi dla każdego towaru.

| Towar | Ilość bazowa (tier 1) | Ilość bazowa (tier 2) |
| --- | ---: | ---: |
| Pasza | 300 | 900 |
| Mleko | 300 | 900 |
| Jogurt | 50 | 150 |
| Ser | 50 | 150 |
| Masło | 50 | 150 |
| Osłony statku | 25 | 75 |
| Komputer pokładowy | 25 | 75 |
| Artefakty Obcych | 25 | 75 |

### Planet resource configuration

Stan początkowy określa zapas towaru na początku sesji. Produkcja i konsumpcja są liczbą jednostek na turę i odpowiadają `productionPerTurn` oraz `consumptionPerTurn` z FR-026. Skróty z konfiguracji oznaczają: Osłony — Osłony statku, Komputer — Komputer pokładowy, Artefakty — Artefakty Obcych.

| Planeta | Towar | Stan początkowy | Produkcja na turę | Konsumpcja na turę |
| --- | --- | ---: | ---: | ---: |
| Seroton | Pasza | 500 | 550 | 500 |
| Seroton | Mleko | 300 | 600 | 300 |
| Seroton | Jogurt | 0 | 0 | 150 |
| Seroton | Ser | 150 | 300 | 150 |
| Seroton | Masło | 0 | 0 | 100 |
| Seroton | Osłony statku | 0 | 50 | 10 |
| Seroton | Komputer pokładowy | 0 | 0 | 10 |
| Seroton | Artefakty Obcych | 0 | 0 | 10 |
| Lactozis-7C | Pasza | 500 | 400 | 500 |
| Lactozis-7C | Mleko | 300 | 0 | 300 |
| Lactozis-7C | Jogurt | 0 | 500 | 150 |
| Lactozis-7C | Ser | 150 | 0 | 150 |
| Lactozis-7C | Masło | 0 | 0 | 100 |
| Lactozis-7C | Osłony statku | 0 | 0 | 10 |
| Lactozis-7C | Komputer pokładowy | 0 | 50 | 10 |
| Lactozis-7C | Artefakty Obcych | 0 | 0 | 10 |
| Maslo-Prime | Pasza | 500 | 700 | 500 |
| Maslo-Prime | Mleko | 300 | 0 | 300 |
| Maslo-Prime | Jogurt | 0 | 400 | 150 |
| Maslo-Prime | Ser | 150 | 0 | 150 |
| Maslo-Prime | Masło | 0 | 0 | 100 |
| Maslo-Prime | Osłony statku | 0 | 0 | 10 |
| Maslo-Prime | Komputer pokładowy | 0 | 0 | 10 |
| Maslo-Prime | Artefakty Obcych | 0 | 50 | 10 |

### Planet sales tax

Domyślna stawka `TAX` na każdej planecie wynosi 3%; na Seroton wynosi 5%. Podatek jest naliczany od całkowitej wartości brutto każdej transakcji sprzedaży i zaokrąglany do liczby całkowitej przez `round`.

| Planeta | TAX |
| --- | ---: |
| Seroton | 5% |
| Lactozis-7C | 3% |
| Maslo-Prime | 3% |

### Initial session, autosave and personal scores

- FR-027: Gracz może rozpocząć nową sesję na planecie Seroton z 1000 kredytów, pustą ładownią i statkiem poziomu 1 o ładowności 20 jednostek; dla zalogowanego gracza wybór „NOWA GRA” zmienia status ostatniej sesji na `Finished`, tworzy nową sesję `Running` i zapisuje ją z `Turn = 1`; parametry początkowe rozgrywki są określone w pliku konfiguracyjnym. Priority: must-have
- FR-028: Zalogowany gracz może otrzymać automatyczną aktualizację zapisu sesji po każdym przylocie do planety, z bieżącym numerem `Turn` i `timestamp`, oraz widoczne na ekranie powiadomienie o autozapisie. Priority: must-have
- FR-029: Zalogowany gracz może odczytać własne najlepsze wyniki w the-best-of; anonimowy gracz nie ma dostępu do tej funkcji. Priority: nice-to-have

## Non-Functional Requirements

- Gra pozostaje używalna w przeglądarkach Chrome i Edge.
- Gracz widzi reakcję na interakcję w czasie maksymalnie 1 sekundy; zapis gry nie opóźnia reakcji interfejsu.
- Gdy autozapis gry do chmury jest aktywny, zapis odbywa się w tle i nie wpływa na czas reakcji rozgrywki.
- Gdy zapis do chmury się nie powiedzie, gra ponawia próbę co sekundę maksymalnie pięć razy.
- Gdy pięć kolejnych prób zapisu się nie powiedzie, gracz otrzymuje powiadomienie o chwilowym problemie z zapisem; gra ponawia próby co 30 sekund.
- Gdy zapis po wcześniejszym błędzie się powiedzie, gracz otrzymuje powiadomienie, że gra została zapisana.

## Business Logic

The system shall calculate the price of each resource independently for each planet based on its current stock level.

Each resource shall define `productionPerTurn`, `consumptionPerTurn`, `basePrice`, `tier1`, and `tier2`. At the end of each turn, the stock level shall be updated as `stock = max(0, stock + productionPerTurn - consumptionPerTurn)`. Parametry początkowe rozgrywki są określone w pliku konfiguracyjnym: planeta startowa Seroton, 1000 kredytów, pusta ładownia i statek poziomu 1 o ładowności 20 jednostek. Koszt podróży wynosi 0 kredytów; kupno nie ma dodatkowych opłat transakcyjnych. Od każdej sprzedaży pobierany jest podatek planety: domyślnie TAX = 3%, a na Seroton TAX = 5%, zgodnie z tabelą Planet sales tax. Towary i ich ceny bazowe (100%) określa tabela Commodity base prices w Functional Requirements. Dostępne planety to Seroton, Lactozis-7C i Maslo-Prime; zapasy początkowe oraz produkcję i konsumpcję każdego towaru na każdej planecie określa tabela Planet resource configuration.

Na początku każdej tury stan magazynowy oraz progi ilości bazowych `tier1` i `tier2` towaru z tabeli Commodity base quantities wyznaczają mnożnik ceny bazowej. The resource price shall be calculated as a percentage of `basePrice` using the following rules: when `stock < tier1`, the price shall scale linearly from 200% of `basePrice` at `stock = 0` to 100% at `stock = tier1`; when `tier1 <= stock <= tier2`, the price shall remain at 100% of `basePrice`; when `tier2 < stock < tier1 + tier2`, the price shall scale linearly from 100% at `stock = tier2` to 50% at `stock = tier1 + tier2`; when `stock >= tier1 + tier2`, the price shall remain at 50% of `basePrice`. Wszystkie operacje ekonomiczne są wykonywane na liczbach całkowitych. Cena jednostkowa transakcji = `round(basePrice × mnożnik ceny)`; wartość transakcji brutto = liczba jednostek × zaokrąglona cena jednostkowa ustalona przed transakcją. Przy sprzedaży podatek = `round(wartość transakcji brutto × TAX)`; przychód netto = wartość transakcji brutto − podatek. Podatek jest naliczany raz od całej transakcji sprzedaży.

Player purchases shall decrease the planet's stock and player sales shall increase it, causing subsequent prices to be recalculated from the resulting stock level. A single transaction shall use the price calculated before that transaction and shall not recalculate the price for individual units within the transaction. Stan sesji obejmuje status `Running` albo `Finished` oraz numer tury `Turn`. Nowa sesja ma status `Running` i `Turn = 1`; pierwszy przylot ustawia `Turn = 2`, a każdy kolejny przylot zwiększa `Turn` o 1. Naciśnięcie „leć” przy `Turn = 30` ustawia `Finished` i kończy sesję zamiast rozpoczynać kolejny lot. Potwierdzone wcześniejsze zakończenie sesji także ustawia `Finished`. Przerwanie gry zachowuje status `Running`; po ponownym uruchomieniu zalogowany gracz z takim zapisem wybiera „KONTYNUUJ” albo „NOWA GRA”. „KONTYNUUJ” wczytuje poprzedni stan `Running` i jego zapisany `Turn`. „NOWA GRA” zmienia status ostatniej sesji na `Finished`, tworzy nową sesję `Running` i zapisuje ją z `Turn = 1`. Wczytywanie poprzedniej sesji oraz zapis nowej sesji w turze 1 dotyczą wyłącznie zalogowanych graczy. Wynik = gotówka + wartość towarów w cargo + wartość statku; wartość cargo = suma liczby jednostek każdego towaru × jego cena bazowa (100%), niezależnie od bieżących cen rynkowych. Wartość statku = Cum Sum kosztów ulepszeń dla osiągniętego poziomu zgodnie z tabelą Ship upgrade costs; statek początkowy poziomu 1 jest wart 0 kredytów. Gracz widzi rozbicie na te trzy składniki oraz sumę. Każdy przylot zalogowanego gracza rozpoczyna nową turę i aktualizuje zapis wraz z `Turn` oraz `timestamp`, z powiadomieniem na ekranie. Zapis gry nigdy nie jest usuwany; wybór „NOWA GRA” zachowuje zapis poprzedniej sesji ze statusem `Finished`.

## Access Control

Gra jest dostępna anonimowo bez zakładania konta. Logowanie przez Google OAuth jest dostępne przed rozpoczęciem lub w trakcie gry i odblokowuje zapis oraz wznowienie sesji. Google OAuth jest jedyną metodą logowania i należy do must-have; logowanie pozostaje opcjonalne dla gracza rozpoczynającego anonimową sesję. Tabela wyników pozostaje nice-to-have. Wszyscy zalogowani gracze mają ten sam zakres uprawnień; MVP nie wprowadza dodatkowych ról. Zalogowany gracz ma dostęp wyłącznie do własnego zapisu sesji. Wczytanie poprzedniej sesji przez „KONTYNUUJ” oraz zapis nowej sesji w turze 1 po wyborze „NOWA GRA” są dostępne wyłącznie po zalogowaniu.
Każdy gracz ma własny, niezależny stan sesji i danych. MVP nie obejmuje multiplayera ani wspólnego rynku.

Globalne all-time-hi-score można odczytać anonimowo. Własne the-best-of są dostępne wyłącznie dla zalogowanego gracza. Autozapis po przylocie jest dostępny wyłącznie dla zalogowanego gracza.

## Non-Goals

- MVP nie obejmuje multiplayera ani wspólnego rynku, ponieważ każdy gracz ma własny niezależny stan sesji.
- MVP nie obejmuje nieskończonego trybu gry, ponieważ limit 30 tur jest potrzebny do porównywania wyników.
- MVP nie obejmuje lokacji planet innych niż rynek, ponieważ rynek wystarcza do podstawowej pętli handlowej.
- MVP nie wymaga logowania przed pierwszą sesją, ponieważ anonimowy start zmniejsza próg wejścia.
- MVP nie obejmuje zaawansowanych wydarzeń losowych, ponieważ utrudniłyby balans i testowanie pierwszej wersji.

- FR-019, FR-020 i FR-029 (zapis i odczyt globalnych i własnych tabel wyników) mają priorytet nice-to-have i nie są warunkiem dostarczenia MVP. Logowanie przez Google OAuth, status zalogowania i autozapisu oraz zapis i wznowienie sesji (FR-016, FR-017, FR-018, FR-025 i FR-028) należą do obowiązkowego MVP.

## Open Questions

Brak otwartych pytań.
