---
project: milky-way-trader
researched_at: 2026-09-17
recommended_platform: cloudflare-pages
runner_up: vercel
context_type: mvp
tech_stack:
  language: TypeScript 5.7.3
  framework: Phaser 4.0.0 + Vite 6.3.2 + HTML/CSS
  runtime: browser; Node.js 24.21.0 for build
  database: Supabase PostgreSQL
  identity: Supabase Auth + Google OAuth
---

## Recommendation

**Cloudflare Pages Free dla aplikacji webowej; Supabase Free dla PostgreSQL i Google OAuth/JWT.**

Statyczny wynik Vite nie wymaga serwera aplikacyjnego ani adaptera Cloudflare. Cloudflare uzyskał 24/24 punktów i najlepsze dopasowanie kosztowe: żądania statycznych zasobów są darmowe i nielimitowane; Workers/Pages Functions mają osobne limity i nie są potrzebne w obecnym MVP. [Ceny Pages](https://developers.cloudflare.com/pages/functions/pricing/).

Decyzja użytkownika o Cloudflare i Supabase została podana przed badaniem i pozostaje obowiązująca; badanie porównuje alternatywy oraz dokumentuje ryzyka, zamiast zmieniać tę decyzję. Nie jest to zgoda na wykonanie wdrożenia produkcyjnego. Logowanie Google jest must-have i jedyną metodą uwierzytelnienia. Gra anonimowa pozostaje dostępna. Dostawcy działają jako osobne usługi.

### Kontekst i odpowiedzi z wywiadu

| Ograniczenie | Odpowiedź | Źródło |
| --- | --- | --- |
| Trwałe połączenia/procesy serwerowe | Nie są potrzebne | PRD single-player; tech-stack has_realtime i has_background_jobs = false |
| Koszty | Obecnie tylko darmowe plany | Wcześniejsza jawna decyzja użytkownika |
| Doświadczenie hostingowe | Brak | Odpowiedź użytkownika „nie” |
| Geografia | Polska i Europa wystarczą | Odpowiedź użytkownika „tak” |
| Współlokalizacja usług | Zewnętrzny backend akceptowany | Wybór Cloudflare + Supabase |

PRD: średnia liczba użytkowników, mały QPS i wolumen danych; reakcja interfejsu do 1 sekundy. Zapis ma działać asynchronicznie, z ponowieniami określonymi w PRD. „Mały ruch” nie jest prognozą liczbową; 10k–100k żądań miesięcznie poniżej to scenariusz badawczy.

## Platform Comparison

Badanie wykonano równolegle dla sześciu platform, korzystając z oficjalnych źródeł. Wszystkie potrafią dostarczyć statyczne pliki tego stosu. Fly/Railway dodatkowo wymagają utrzymywania procesu serwującego te pliki.

Pass = 2, Partial = 1, Fail = 0. Wagi: CLI 3, managed 3, dokumentacja 2, API wdrożeń 3, integracja 1; maksimum 24. Oddzielne kary kosztowe/dopasowania są oceną autora dla tego MVP, a nie danymi dostawcy. Brak doświadczenia nie rozstrzyga remisów; wspólny dostawca DB nie daje premii.

| Platforma | CLI-first | Managed | Docs dla agentów | API wdrożeń | MCP/CI | Suma | Dopasowanie kosztowe |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| Cloudflare Pages | Pass | Pass | Pass | Pass | Pass | 24 | 24 po korekcie; najlepszy Free dla statycznego buildu |
| Vercel Hobby | Pass | Pass | Pass | Pass | Pass | 24 | 23; kara 1 za ograniczenie niekomercyjne |
| Netlify Free | Pass | Pass | Pass | Pass | Pass | 24 | 22; kara 2 za wspólny limit kredytów i ryzyko pauzy |
| Render Static Sites | Pass | Pass | Pass | Pass | Pass | 24 | 21; kara 3 za niski limit transferu |
| Railway Free | Pass | Pass | Pass | Pass | Pass | 24 | 17; kara 7 za proces serwera i niepewne zmieszczenie w kredycie |
| Fly.io | Pass | Partial | Pass | Pass | Pass | 21 | Poza shortlistą: nowe konta nie mają trwałego darmowego planu |

**Cloudflare:** Wrangler Pages, REST API, Markdown/llms i oficjalna integracja GitHub Actions spełniają pięć kryteriów. Free ma 500 buildów/miesiąc, jeden równoległy build, timeout 20 minut, 20k plików i 25 MiB na pojedynczy plik. Publikacja prebuilt dist przez Direct Upload przenosi build do GitHub Actions, którego własne limity trzeba sprawdzić przy planowaniu CI. [Limity Pages](https://developers.cloudflare.com/pages/platform/limits/), [CLI Pages](https://developers.cloudflare.com/workers/wrangler/commands/pages/), [oficjalne CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/), [llms](https://developers.cloudflare.com/pages/llms.txt).

**Vercel:** CLI/API, zarządzany hosting, dokumentacja dla agentów i oficjalne integracje spełniają kryteria. Hobby obejmuje 100 GB transferu i 1 mln Edge Requests/miesiąc, lecz wyłącznie osobiste projekty niekomercyjne. Hobby rollback obejmuje bezpośrednio poprzedni deployment produkcyjny. Vercel MCP: **Beta, sprawdzono 2026-09-17**; podstawową obsługę oprzeć na CLI/CI. [Hobby](https://vercel.com/docs/plans/hobby), [CLI rollback](https://vercel.com/docs/cli/rollback), [zasoby agentowe](https://vercel.com/docs/agent-resources), [MCP](https://vercel.com/docs/agent-resources/vercel-mcp).

**Netlify:** CLI, OpenAPI, managed hosting, llms i oficjalny MCP/CI spełniają kryteria. Nowy Free: 300 kredytów/miesiąc; deploy produkcyjny 15, transfer 20/GB, żądania 2/10k. Przykład 10 deployów + 5 GB + 100k żądań = 270 kredytów i 0 USD. Wyczerpanie puli zatrzymuje projekty zespołu. MCP jest udokumentowany bez oznaczenia beta w sprawdzonych materiałach; nie zakładamy przez to formalnej gwarancji GA. [Kredyty](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/), [pauzy](https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/), [CLI](https://cli.netlify.com/commands/deploy/), [API](https://open-api.netlify.com/), [MCP](https://docs.netlify.com/build/build-with-ai/agent-setup-guides/agent-setup-overview/), [llms](https://docs.netlify.com/llms.txt).

**Render:** Static Sites mają CDN, TLS i preview; nie dotyczy ich cold start Free Web Service. CLI, wersjonowane API, dokumentacja Markdown i podstawowy MCP spełniają kryteria. Obecny Hobby: 5 GB transferu i 500 minut pipeline/miesiąc; bez metody płatności przekroczenie może zatrzymać usługi, a z kartą możliwe są opłaty. Osobny docs MCP: **experimental, sprawdzono 2026-09-17**; nie opierać na nim procedur odzyskiwania. [Cennik](https://render.com/pricing), [Static Sites](https://render.com/docs/static-sites), [CLI](https://render.com/docs/cli), [rollback](https://render.com/docs/rollbacks), [agent docs](https://render.com/docs/llm-support), [podstawowy MCP](https://render.com/docs/mcp-server/).

**Railway:** CLI, GraphQL API, managed hosting, Markdown/llms i oficjalny MCP spełniają kryteria. Trial 5 USD/30 dni przechodzi w rzeczywisty Free z 1 USD kredytu miesięcznie; Hobby za 5 USD nie jest darmowy. Stały webserwer zużywa RAM/CPU, więc sam mały QPS nie gwarantuje zmieszczenia w Free. Retencja obrazów Free do rollback wynosi 24 godziny. [Plany](https://docs.railway.com/pricing/plans), [trial](https://docs.railway.com/pricing/free-trial), [CLI/CI](https://docs.railway.com/cli/deploying), [API](https://docs.railway.com/integrations/api), [MCP](https://docs.railway.com/ai/mcp-server), [llms](https://docs.railway.com/llms.txt).

**Fly.io:** CLI, Machines API, llms i oficjalne CI są dostępne; zarządzane VM pozostawiają dodatkowe pakowanie frontendu w kontener. Trial kończy się po 2 VM-hours albo 7 dniach; dalsze działanie jest płatne, więc nie realizuje jawnego wymagania darmowych planów. MCP: **experimental, sprawdzono 2026-09-17**; Pass za integrację wynika z oficjalnego CI. [Trial](https://fly.io/docs/about/free-trial/), [koszty](https://fly.io/docs/about/cost-management/), [statyczny hosting](https://fly.io/docs/languages-and-frameworks/static/), [API](https://fly.io/docs/machines/api/), [CI](https://fly.io/docs/launch/continuous-deployment-with-github-actions/), [MCP](https://fly.io/docs/flyctl/mcp-server/), [llms](https://fly.io/llms.txt).

### Shortlisted Platforms

#### 1. Cloudflare Pages + Supabase (Recommended)

Najlepsze dopasowanie do już wybranego statycznego frontendu i darmowych planów. Supabase stanowi backend API/Auth, więc na Pages nie trzeba uruchamiać procesu PostgreSQL ani serwera Phaser.

#### 2. Vercel Hobby + Supabase

Najbliższa alternatywa pod względem CLI, preview i darmowego transferu. Nadaje się pod warunkiem zachowania niekomercyjnego charakteru projektu; przyszłą monetyzację trzeba ponownie ocenić.

#### 3. Netlify Free + Supabase

Obsługuje statyczny wynik Vite i ma dobrą integrację agentową. Przy częstych produkcyjnych deployach lub większych plikach pula kredytów staje się istotniejsza niż liczba sesji.

### Koszt i Supabase

Nie można wyliczyć kosztu na podstawie samej liczby żądań. Przykładowo 100k odpowiedzi po 100 KB to około 10 GB transferu: dla Cloudflare statycznych zasobów nadal 0 USD, ale inne platformy mogą zużyć znaczną część Free. To scenariusz, nie pomiar aplikacji.

Supabase Free: 500 MB bazy, 50k MAU, 5 GB podstawowego egress, dwa aktywne projekty; pauza po tygodniu nieaktywności; brak automatycznych backupów i branchingu. Social OAuth jest dostępny w Free. Aktualny wariant może kosztować 0 USD w granicach tych limitów; nie gwarantuje to stałej dostępności DB. Nie kupujemy domeny ani dodatków w ramach tej decyzji. [Supabase pricing](https://supabase.com/pricing).

Wybrać europejski region projektu Supabase, np. Frankfurt, po potwierdzeniu dostępności przy tworzeniu. CDN frontendu nie replikuje bazy Supabase do każdego regionu. [Regiony](https://supabase.com/docs/guides/platform/regions).

## Anti-Bias Cross-Check: Cloudflare Pages + Supabase

### Devil's Advocate — Weaknesses

1. Tydzień bez aktywności może zatrzymać Supabase tuż przed demonstracją; statyczny ekran gry nadal działa, ale login i zapis nie.
2. RLS źle dopuszczające update lub insert mogą ujawnić cudzy stan mimo poprawnego logowania Google; publishable key jest publiczny i nie zastępuje polityk dostępu. [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
3. Powrót do poprzedniego frontendu nie cofa migracji SQL. Zmiana formatu zapisu bez kompatybilności może uniemożliwić „KONTYNUUJ”.
4. Zmienny adres preview i błędna lista przekierowań mogą uniemożliwić logowanie poza localhost. [Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls).

### Pre-Mortem — How This Could Fail

Pół roku po wdrożeniu gra wciąż ładuje mapę, więc właściciel początkowo uznaje hosting za niezawodny. Przed pokazem okazuje się jednak, że projekt Supabase został wstrzymany po okresie nieaktywności. Gracze anonimowi działają, lecz logowanie i zapis zawodzą. Interfejs pokazuje sukces przed potwierdzeniem odpowiedzi API, dlatego część osób zamyka kartę z przekonaniem, że postęp jest bezpieczny. Po przywróceniu bazy ujawnia się drugi problem: nowe wdrożenie zmieniło strukturę sesji, ale starsze zapisy nie mają wymaganych pól. Wycofanie aplikacji przywraca poprzedni JavaScript, lecz pozostawia migrację bazy, więc kontynuacja nadal nie działa. Testy wykonywano głównie na localhost z jednym kontem. Nikt nie sprawdził dwóch użytkowników ani powrotu z Google na adres preview, przez co błędy polityk i przekierowań dotarły do produkcji. Zakończone sesje przechowywano jako dodatkowe pełne kopie przy każdej turze; limit bazy zaczął rosnąć szybciej niż oczekiwano. Brak zewnętrznego eksportu danych utrudnił naprawę. Zespół odkrył, że darmowy hosting frontendu nie oznacza gwarancji działania całego systemu. Potrzebne były osobne kontrole dostępności backendu, testy właściciela zapisu, zgodne migracje i sprawdzona procedura odtworzenia. Problemem okazała się obsługa stanu, a nie renderowanie gry.

Narracja jest hipotetyczna; nie opisuje zaobserwowanego incydentu.

### Unknown Unknowns

- Projekt Pages Direct Upload nie może zostać później przełączony na Git integration bez utworzenia nowego projektu. Wybór ma znaczenie dla planowanych GitHub Actions. [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/).
- Wrangler Pages tail pokazuje logi Functions, nie błędy JavaScript w przeglądarce. Statyczna gra potrzebuje kontroli konsoli i network w przeglądarce. [Logi](https://developers.cloudflare.com/pages/functions/debugging-and-logging/).
- Supabase Free nie daje branchingu. Dwa osobne projekty pozwalają oddzielić produkcję od testów, w granicach puli Free. [Cennik](https://supabase.com/pricing).
- Klucze publishable/secret zastępują starsze anon/service_role; te ostatnie są oznaczone do deprecacji do końca 2026. JWT użytkownika pochodzi z Auth, a publishable key identyfikuje aplikację. **Przejście/deprecacja, sprawdzono 2026-09-17**; przy implementacji używać nowych kluczy. [Klucze API](https://supabase.com/docs/guides/getting-started/api-keys).
- RLS chroni właściciela danych, lecz nie dowodzi uczciwości wyniku policzonego przez klienta. Jeśli później wdrożymy leaderboard, trzeba osobno ustalić walidację wyników; nie dodajemy jej teraz do MVP.

## Operational Story

- **Preview deploys**: planowany Direct Upload przez GitHub Actions; branch main jako produkcyjny, branch PR jako preview przez flagę --branch. Zaufane preview mają stabilny alias brancha i osobny projekt Supabase do testów. Sekrety deploymentu nie są przekazywane niezaufanym fork PR. Allowlista OAuth obejmuje localhost i kontrolowane adresy, bez szerokiego wildcard dla obcych domen. [Preview](https://developers.cloudflare.com/pages/configuration/preview-deployments/).
- **Secrets**: CLOUDFLARE_API_TOKEN w GitHub Actions Secrets; wymagane Pages Edit w wybranym koncie, bez DNS i rozliczeń, z możliwie wąskim zakresem dopuszczanym przez API. Google client secret wyłącznie w konfiguracji providera Supabase. VITE_SUPABASE_URL i VITE_SUPABASE_PUBLISHABLE_KEY są konfiguracją publiczną wbudowaną w frontend. Klucze secret nigdy nie trafiają do VITE_*; ich zmiana wymaga rotacji w Supabase, a publicznej konfiguracji także nowego buildu. [CI credentials](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/), [API keys](https://supabase.com/docs/guides/getting-started/api-keys).
- **Rollback**: Pages dashboard → wybrany wcześniejszy udany deployment produkcyjny → rollback; alternatywnie REST POST /accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}/rollback. Preview nie jest celem rollbacku. Przywrócenie DB wymaga osobnej procedury; czasu odzyskania nie zmierzono. [Rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/), [API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/rollback/).
- **Approval**: plan pierwszego wdrożenia zatwierdza użytkownik. Po zatwierdzeniu zakresu CI merge do main uruchamia ustaloną publikację. Agent może czytać dokumentację/logi i przygotowywać lokalne zmiany; operacje niszczące na produkcji i rotację głównego sekretu wykonuje użytkownik ręcznie, zgodnie z AGENTS.md.
- **Logs**: npx.cmd --no-install wrangler pages deployment list --project-name=milky-way-trader --json odczytuje deploymenty po skonfigurowaniu konta/tokena. Build GitHub Actions: gh run view <run-id> --log po instalacji i logowaniu gh; obecnie gh nie jest dostępne. Supabase: dashboard Logs Explorer dla Auth/Postgres/API. Błędy gry: konsola/network przeglądarki. pages deployment tail będzie przydatne dopiero po dodaniu Functions. [CLI Pages](https://developers.cloudflare.com/workers/wrangler/commands/pages/), [gh logs](https://cli.github.com/manual/gh_run_view).

## Risk Register

L/M/H = niskie/średnie/wysokie. Prawdopodobieństwo i wpływ to ocena autora.

| Risk | Source | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| Pauza DB/Auth przed demonstracją | Devil's advocate | M | H | Sprawdzić projekt i login przed pokazem; przywrócić pauzowany projekt ręcznie, testować ponowienia zapisu |
| Cudzy zapis dostępny przez API | Devil's advocate | M | H | RLS user_id=auth.uid() przy odczycie i zapisie (USING/WITH CHECK); testować select/insert/update dla dwóch użytkowników i anonimowego klienta; brak delete zgodnie z PRD |
| Rollback frontendu nie naprawia schematu | Pre-mortem | M | H | Wersjonować format sesji; migracje kompatybilne wstecz; wypróbować odtworzenie eksportu |
| Brak backupu Free | Research finding | M | H | Regularny zaszyfrowany eksport poza repo i sprawdzony restore; Free nie zapewnia automatycznych backupów |
| OAuth działa tylko na localhost | Devil's advocate | M | H | Osobno skonfigurować Google callback Supabase i Supabase redirectTo dla localhost/produkcji/preview; testować powrót do gry |
| Wzrost danych Finished do limitu | Pre-mortem | M | M | Aktualizować jeden stan sesji podczas tur; zachować Finished; mierzyć DB, bez automatycznego usuwania wbrew PRD |
| Brak testowej gałęzi DB | Unknown unknowns | H | M | Osobny projekt testowy Free, lokalny development jeśli przekroczono pulę; brak obietnicy płatnego branchingu |
| Brak logów błędów klienta w tail | Unknown unknowns | H | M | Ręczna weryfikacja konsoli/network i OAuth/continue; nie uznawać CLI tail za test gry |
| Słaba przenośność trybu upload | Unknown unknowns | M | M | Wybrać Direct Upload świadomie; GitHub Actions jako ustalony deploy flow, migrację trybu przez nowy projekt |
| Powrót błędu zapisu blokuje UI | Research finding | M | H | Zapis asynchroniczny; retry co sekundę maks. pięć razy, potem co 30 sekund, status sukcesu po potwierdzeniu API |
| Beta/experimental integracje agentowe | Research finding | L | M | Dla alternatyw używać stabilnych CLI/API/CI zamiast uzależniać obsługę od Vercel Beta, Fly/Render experimental MCP |
| Migracja legacy kluczy Supabase | Unknown unknowns | M | M | Wdrażać nowe publishable keys; secret wyłącznie po stronie zaufanej, sprawdzić zależności przed deprecacją |

Eksporty Free zaleca sama dokumentacja Supabase. Narzędzie, sposób szyfrowania i harmonogram trzeba konkretyzować w planie wdrożenia. [Backupy](https://supabase.com/docs/guides/platform/backups).

## Getting Started

Poniższe działania są propozycją dla zatwierdzanego planu wdrożenia; nie zostały wykonane w ramach badania.

1. Utworzyć Supabase Free w regionie europejskim i skonfigurować wyłącznie Google OAuth: client ID/secret, Google redirect URI do callbacku Supabase, Site URL i allowlistę powrotów. Używać podstawowych scope identity; sprawdzić faktyczny dostęp konta spoza zespołu. Nie zakładać, że tryb Google Testing zawsze blokuje wszystkich spoza listy: podstawowe openid/email/profile mają wyjątek. [Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google), [Google app states](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).
2. Przygotować integrację SDK, schemat zapisów i RLS oraz publiczną konfigurację Vite. Pakiet @supabase/supabase-js nie jest jeszcze zależnością projektu. Przed produkcją sprawdzić login, save, continue i dostęp dwóch różnych użytkowników.
3. Zweryfikować na Node 24.21.0: npm.cmd ci, npx.cmd --no-install tsc --noEmit, npm.cmd run build-nolog. Wynikiem obecnej konfiguracji Vite 6.3.2 jest dist/; build nie wykonuje typecheck. Do interaktywnego rozwoju gry wystarcza npm.cmd run dev-nolog. Nie potrzeba adaptera SSR ani osobnego emulatora Workers dla tego statycznego zakresu.
4. Dodać Wrangler 4 jako devDependency: npm.cmd install --save-dev wrangler@4, a rozwiązaną wersję utrwalić w lockfile i planie. Wrangler obecnie nie jest zainstalowany. Po przygotowaniu konta/tokena i zatwierdzeniu planu: npx.cmd --no-install wrangler pages project create milky-way-trader --production-branch=main, następnie npx.cmd --no-install wrangler pages deploy dist --project-name=milky-way-trader --branch=main. To polecenia Pages, nie wrangler deploy dla Workers. [Wrangler install](https://developers.cloudflare.com/workers/wrangler/install-and-update/), [Wrangler 4](https://developers.cloudflare.com/workers/wrangler/migration/update-v3-to-v4/), [CLI Pages](https://developers.cloudflare.com/workers/wrangler/commands/pages/).
5. Zapisać zatwierdzony plan w context/deployment/deploy-plan.md; dopiero potem skonfigurować GitHub Actions w osobnym zadaniu. Zmierzyć rozmiar plików/transfer, sprawdzić OAuth produkcyjny i preview, retry zapisu oraz powrót do poprzedniego frontendu ze zgodnym schematem. Uwzględnić ustalenia istniejącego audytu context/changes/bootstrap-verification/verification-v2.md przed publiczną publikacją.

Polecenia projektu potwierdzono względem package.json, package-lock.json i vite/config.prod.mjs. Polecenia Pages sprawdzono w aktualnej dokumentacji Wrangler; nie wykonano instalacji CLI ani deployu i nie deklarujemy testu na obecnie nieistniejącej konfiguracji infrastruktury.

## Out of Scope

- Dockerfile i budowanie obrazów.
- Implementacja i konfiguracja CI/CD w tym zadaniu.
- Wieloregionowe HA/DR i architektura poza MVP.
- Wdrożenie produkcyjne i tworzenie kont/projektów.
- Wymóg server-side anti-cheat dla opcjonalnego leaderboardu.
