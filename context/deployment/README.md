# Deployment

Zatwierdzony zakres: [deploy-plan.md](deploy-plan.md). Faktyczne wyniki i brakujące kroki: [verification.md](verification.md).

Pierwsza publikacja obejmuje demo Phaser. Supabase i Google OAuth przygotowujemy dla przyszłej integracji; obecny frontend nie korzysta z bazy ani nie oferuje logowania.

## 1. Konta i Cloudflare

1. Zarejestruj konto [Cloudflare](https://dash.cloudflare.com/sign-up) na darmowym planie. Dla adresu `pages.dev` nie potrzebujesz kupować domeny ani dodawać strefy DNS.
2. Odczytaj Account ID z panelu konta Workers & Pages lub adresu dashboardu konta.
3. W API Tokens utwórz Custom Token: **Account / Cloudflare Pages / Edit**, tylko dla wybranego konta. Bez uprawnień DNS i rozliczeń.
4. W katalogu głównym projektu (obok `package.json`) utwórz ignorowany przez Git plik `.env.deploy.local`. Skrypty `deploy:preview` i `deploy:production` wczytują go do środowiska Wrangler. Wpisz w nim wartości dwóch zmiennych opisanych poniżej; nie wklejaj ich do rozmowy. Token nie może mieć prefiksu `VITE_`. Ten plik jest przeznaczony wyłącznie dla CLI wdrożeniowego, nie dla buildu Vite.
5. Z katalogu głównego projektu utwórz Pages **Direct Upload**:

```powershell
npx.cmd --no-install wrangler pages project create milky-way-trader --production-branch=main --env-file .env.deploy.local
```

Wrangler 4.133.0 może w kontekście agenta automatycznie delegować tworzenie nowego projektu Pages do Workers. Jeśli API potwierdza brak projektu, a polecenie zgłasza delegację i błąd entry-point, utwórz wybrany w planie projekt Pages z jednorazowym `--force`:

```powershell
npx.cmd --no-install wrangler pages project create milky-way-trader --production-branch=main --env-file .env.deploy.local --force
```

W tej komendzie flaga wyłącza delegację do Workers; nie usuwa projektu. Dla istniejącego projektu kolejne `pages deploy` działają bez niej. Nie dodawaj `--force` do usuwania ani pobierania konfiguracji, gdzie ma inne znaczenie. Zachowanie sprawdzono w kodzie zainstalowanego Wranglera podczas pierwszego wdrożenia.

Zawartość lokalnego pliku (zastąp przykładowe wartości, nie commituj pliku):

```dotenv
CLOUDFLARE_ACCOUNT_ID=twoje_account_id
CLOUDFLARE_API_TOKEN=twoj_token_pages_edit
```

Jeśli projekt już istnieje, najpierw sprawdź `wrangler pages project list --env-file .env.deploy.local`; nie usuwaj istniejącego projektu. Zapisz rzeczywistą przydzieloną domenę w verification.md. Nie zakładaj dostępności konkretnego adresu `milky-way-trader.pages.dev`.

## 2. Preview i pierwsza produkcja

Wymagany Node 24.21.0; narzędzia instalowane z lockfile. Polecenia publikacji zawsze najpierw wykonują typecheck, audyt HIGH/CRITICAL, build bez telemetrii startera i kontrolę limitów zasobów Pages Free.

```powershell
npm.cmd ci
npm.cmd run deploy:preview
```

Preview używa brancha `staging`. Odczytaj URL deploymentu i stabilny alias `staging` z odpowiedzi Wrangler/panelu Pages. W Chrome i Edge sprawdź Main Menu → Game → Game Over → Main Menu, odświeżenie, konsolę i brak odpowiedzi 404 dla zasobów. Dopiero po udanym teście:

```powershell
npm.cmd run deploy:production
npx.cmd --no-install wrangler pages deployment list --project-name=milky-way-trader --json --env-file .env.deploy.local
```

Produkcja używa brancha `main`. Zapisz URL, deployment ID, commit i czas UTC. Jeśli lokalne drzewo jest zmienione, Wrangler oznacza lokalny deployment jako dirty; nie przedstawiaj go jako dokładnego commita. Powtórz test Chrome/Edge na produkcji.

Gdy firmowy certyfikat uniemożliwia npm dostęp do registry, Node 24 obsługuje systemowy magazyn CA: ustaw dla procesu `NODE_OPTIONS=--use-system-ca`. Nie wyłączaj walidacji TLS. Jeżeli sandbox blokuje globalny cache npm, użyj `npm.cmd ci --cache .cache/npm`.

## 3. Supabase Free

1. Zarejestruj konto [Supabase](https://supabase.com/dashboard/sign-up) i utwórz organizację Free.
2. Utwórz dwa projekty: `milky-way-trader-prod` oraz `milky-way-trader-test`. Wybierz Frankfurt (`eu-central-1`). Jeśli niedostępny, wstrzymaj tworzenie i uzgodnij inny region europejski.
3. Hasła baz przechowuj w menedżerze haseł. Nie dodawaj ich do `.env.example`, repozytorium ani rozmowy.
4. W każdym projekcie w Authentication / Sign In / Providers wyłącz Email i pozostałe niewykorzystywane providery. Włącz Google po przygotowaniu klientów opisanych poniżej. Gra anonimowa jest trybem aplikacji, nie dodatkową metodą Supabase Anonymous Sign-In.
5. Produkcja: **Site URL** i Redirect URLs ustaw na dokładny rzeczywisty URL produkcji zakończony `/`. Testy: Site URL na stabilny alias staging, Redirect URLs na ten alias oraz `http://localhost:8080/`. Bez szerokich wildcardów. Logowanie na dynamicznych preview PR wymaga późniejszego dodania konkretnego adresu do allowlisty.
6. W Settings / API Keys odczytaj URL i **publishable key**. Skopiuj `.env.example` do ignorowanego `.env.local` i używaj danych projektu testowego w lokalnym rozwoju. Obecny starter ich nie odczytuje; konfigurację buildów prod/test dodamy wraz z integracją SDK.

W pierwszym wdrożeniu nie tworzymy tabel sesji ani migracji. Przed późniejszym udostępnieniem danych przez API obowiązują RLS i test izolacji dwóch użytkowników. Klucze secret/service_role nie trafiają do `VITE_*`.

Free obejmuje dwa aktywne projekty; backend może pauzować po tygodniu nieaktywności i nie ma automatycznych backupów. Przed demonstracją sprawdź oba projekty; eksport danych będzie potrzebny po wdrożeniu persystencji.

## 4. Google OAuth

1. W [Google Cloud Console](https://console.cloud.google.com/) utwórz projekt `MilkyWayTrader`. Nie włączaj płatnych usług ani konta rozliczeniowego dla tej konfiguracji.
2. W Google Auth Platform skonfiguruj branding i odbiorców External, status Testing oraz adres właściciela jako użytkownika testowego. Używaj tylko podstawowych scope `openid`, `email`, `profile`. Tryb Testing przy podstawowych scope identity ma wyjątki; sama lista użytkowników testowych nie stanowi zabezpieczenia dostępu do gry.
3. Utwórz dwóch klientów OAuth **Web application**: `MilkyWayTrader Production` i `MilkyWayTrader Test`.
4. W każdym Supabase odczytaj callback z konfiguracji Google providera, w postaci `https://<project-ref>.supabase.co/auth/v1/callback`. Dodaj właściwy callback jako **Authorized redirect URI** odpowiedniego klienta Google. Jest to callback Supabase, nie adres Cloudflare ani localhost.
5. Wprowadź client ID oraz client secret odpowiedniego klienta wyłącznie w konfiguracji Google providera właściwego Supabase. Zapisz ustawienia i włącz provider.
6. Gotowość w tym etapie oznacza zapisane konfiguracje i zgodne callbacki. Pełny test loginu i przejście ekranu zgody do In production nastąpią przy implementacji logowania w aplikacji.

Nie konfigurujemy SMTP ani logowania przez email.

## 5. GitHub Actions

W repozytorium [pdrozdowski/MilkyWayTrader](https://github.com/pdrozdowski/MilkyWayTrader), Settings / Secrets and variables / Actions ustaw:

| Miejsce | Nazwa | Wartość |
| --- | --- | --- |
| Secrets | `CLOUDFLARE_API_TOKEN` | Token Pages Edit |
| Variables | `CLOUDFLARE_ACCOUNT_ID` | ID wybranego konta Cloudflare |

Sekret Google pozostaje w Supabase. W CI nie są potrzebne hasła PostgreSQL ani klucze secret Supabase.

Workflow `.github/workflows/deploy.yml`:

- push do `main`: walidacja i deployment produkcyjny;
- PR do `main` z tego repozytorium: walidacja i preview `pr-<numer>`; takie PR traktujemy jako zaufane;
- PR z forka: sama walidacja, bez kroku publikacji i bez tokenu Cloudflare;
- Run workflow: `staging` jako domyślne preview lub `production` tylko z `main`;
- produkcyjne uruchomienia są kolejkowane; nie przerywamy trwającej publikacji.

Workflow ma `contents: read`; checkout nie zachowuje poświadczeń. Token Cloudflare jest dostępny tylko w kroku publikacji. Nie stosujemy `pull_request_target`. Skrypty walidacji nie dostają sekretów wdrożenia. W prywatnym repo sprawdź pozostałą darmową pulę GitHub Actions; nie włączaj płatnego przekraczania limitów.

Przed pierwszym pushem sprawdź selektywny commit i preview. `AGENTS.md` wymaga osobnej jawnej zgody przed `git push origin main`. Po pushu sprawdź rzeczywisty zielony wynik w Actions i URL produkcji; sam plik workflow nie potwierdza udanego wdrożenia CI.

## 6. Rollback i diagnostyka

Cloudflare dashboard → Workers & Pages → `milky-way-trader` → Deployments → poprzedni udany **produkcyjny** deployment → Rollback. Pierwsze wdrożenie nie ma wcześniejszego celu; jego ID zapisz jako punkt odniesienia dla następnych wydań. Preview nie jest celem rollbacku produkcji.

Rollback frontendu nie cofa zmian bazy. Obecny zakres nie zawiera migracji; przy przyszłych zmianach schematu trzeba zachować kompatybilność zapisów. Nie używaj `wrangler rollback` (dotyczy Workers) jako polecenia rollbacku Pages.

Logi publikacji: GitHub Actions / Cloudflare Deployments. Błędy JS i zasobów: konsola i Network w przeglądarce; Pages Functions tail nie zbiera błędów statycznego klienta.

## Źródła

- [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare CI i tokeny](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [Limity Pages Free](https://developers.cloudflare.com/pages/platform/limits/)
- [Rollback Pages](https://developers.cloudflare.com/pages/configuration/rollbacks/)
- [Google OAuth przez Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Free](https://supabase.com/pricing)
