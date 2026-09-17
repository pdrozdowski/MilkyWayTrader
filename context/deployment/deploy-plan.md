# Pierwsze wdrożenie MilkyWayTrader

Plan zatwierdzony przez użytkownika 2026-09-17. Podstawa: `../foundation/infrastructure.md` i `../foundation/tech-stack.md`.
Stan wykonania i wyniki: [verification.md](verification.md). Instrukcja kont i publikacji: [README.md](README.md).

## Cel i zakres

Opublikować obecny starter Phaser na **Cloudflare Pages Free**, przygotować **Supabase Free i Google OAuth** oraz uruchomić automatyczne wdrożenia przez GitHub Actions.

Zgodnie z ustaleniami tworzymy nowe konta/projekty. Implementacja logowania, ekonomii i zapisów gry pozostaje kolejnym etapem. Pierwsze wdrożenie udostępnia działające demo.

## Przygotowanie projektu i usług

- [x] Zapisać zatwierdzony plan w `context/deployment/deploy-plan.md`.
- [x] Naprawić pięć podatności HIGH przez `npm audit fix` bez `--force`. Zachować obecne główne wersje Phaser, Vite i TypeScript; utrwalić poprawki w lockfile.
- [x] Dodać Wrangler 4 jako lokalną devDependency. Sprawdzić czystą instalację, typecheck i `build-nolog`, publikujący `dist/`.
- [x] Uzupełnić ignorowanie plików `.env`, zachowując możliwość commitowania `.env.example`. Szablon zawiera tylko publiczne nazwy konfiguracji Supabase.
- [ ] Utworzyć projekt Cloudflare Pages **Direct Upload** `milky-way-trader`, z produkcyjnym branchem `main`. Korzystać z przydzielonej domeny `pages.dev`. Direct Upload jest zgodny z wybranym CI; późniejsza zmiana na Git integration wymaga nowego projektu. [Dokumentacja Cloudflare](https://developers.cloudflare.com/pages/get-started/direct-upload/).
- [ ] Utworzyć projekty Supabase `milky-way-trader-prod` i `milky-way-trader-test`, oba Free, w regionie Frankfurt. Jeżeli region jest niedostępny, wstrzymać tworzenie zamiast wybierać region poza Europą.
- [ ] Utworzyć projekt Google Cloud z dwoma klientami OAuth typu Web: produkcyjnym i testowym. Na tym etapie ekran zgody pozostaje w trybie Testing, z kontem właściciela jako użytkownikiem testowym.
- [ ] W każdym Supabase włączyć Google jako jedyną metodę logowania. Odpowiedni callback Supabase dodać do klienta Google; client secret przechowywać wyłącznie w konfiguracji providera. [Konfiguracja Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google).

Rejestrację kont i wprowadzanie sekretów wykonuje użytkownik w panelach usług. Sekrety nie trafiają do rozmowy ani repozytorium.

## Publikacja i automatyzacja

- [ ] Utworzyć token Cloudflare z uprawnieniem Pages Edit ograniczonym do wybranego konta.
- [ ] Wdrożyć lokalnie zbudowane `dist/` jako preview brancha `staging`. Sprawdzić demo przed pierwszą publikacją produkcyjną.
- [ ] Ustawić przekierowania Supabase: produkcja do rzeczywistego adresu aplikacji; testy do stabilnego aliasu `staging` oraz `http://localhost:8080/`. Używać dokładnych adresów.
- [x] Dodać workflow GitHub Actions: Ubuntu 24.04, Node 24.21.0, `actions/checkout@v7`, `actions/setup-node@v7`, `npm ci`, typecheck, audyt i `build-nolog`.
- [x] Po udanych kontrolach: push do `main` publikuje produkcję; PR z tego samego repozytorium publikuje preview; PR z forka uruchamia wyłącznie kontrole bez sekretów. Produkcyjne wdrożenia wykonywać pojedynczo.
- [ ] Token Cloudflare zapisać w GitHub Actions Secrets, account ID w Variables. Token przekazywać tylko do kroku publikacji lokalnym Wranglerem.
- [x] Przygotować selektywny commit zmian wdrożeniowych. Zachować obecną historię Git i istniejące zmiany użytkownika.
- [ ] `git push origin main` wykonać po jawnej zgodzie wymaganej przez `AGENTS.md`, po sprawdzeniu preview.
- [ ] Zapisać adresy usług, wersje narzędzi, wynik weryfikacji oraz identyfikator pierwszego udanego deploymentu.

## Kryteria odbioru

- Czysta instalacja, typecheck i build kończą się sukcesem; audyt nie wykazuje HIGH ani CRITICAL. Niepowodzenie blokuje publikację.
- Preview i produkcja działają przez HTTPS w Chrome i Edge; sceny oraz zasoby demo ładują się bez błędów konsoli i brakujących plików.
- Workflow potwierdza automatyczną publikację `main`; niezaufany PR nie otrzymuje tokenu.
- Oba projekty Supabase oraz konfiguracje Google OAuth są przygotowane. Test logowania w aplikacji nastąpi po implementacji integracji.
- Dokumentacja opisuje rollback do wcześniejszego udanego deploymentu produkcyjnego. Pierwszy deployment stanowi punkt odniesienia dla kolejnych wydań. [Rollback Pages](https://developers.cloudflare.com/pages/configuration/rollbacks/).

Wszystkie usługi pozostają na darmowych planach, bez zakupu domeny i płatnych dodatków.
