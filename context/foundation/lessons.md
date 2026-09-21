# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Używaj systemowego magazynu certyfikatów Windows od pierwszej próby

- **Context**: Lokalne operacje HTTPS na tym stanowisku Windows: Git clone/fetch/pull/push oraz żądania Node.js 24/npm, w tym instalacja zależności, audyt i deployment. Przeczytaj tę regułę przed pierwszym poleceniem sieciowym.
- **Problem**: Git domyślnie używa OpenSSL i powtarzalnie zatrzymuje operacje na błędzie `unable to get local issuer certificate`; wystąpiło to zarówno przy klonowaniu startera, jak i pierwszym pushu wdrożenia. Node/npm również zgłaszały błędy zaufania certyfikatu. Ponawianie dopiero po awarii marnuje czas, mimo że systemowy magazyn certyfikatów rozwiązał te problemy we wcześniejszych uruchomieniach.
- **Rule**: Na tym stanowisku Windows od pierwszej próby wykonuj operacje Git HTTPS jako `git -c http.sslBackend=schannel <polecenie>` (np. `git -c http.sslBackend=schannel push origin main`), a żądania HTTPS Node.js 24/npm z `node --use-system-ca ...` lub procesowym `NODE_OPTIONS=--use-system-ca`. Zachowuj weryfikację TLS: nie używaj `http.sslVerify=false`, `strict-ssl=false` ani `NODE_TLS_REJECT_UNAUTHORIZED=0`, nie zmieniaj trwale konfiguracji Git/npm bez osobnego polecenia użytkownika i nadal przestrzegaj wymaganej zgody na push.
- **Applies to**: all

## Nie dodawaj migracji snapshotów przed dojrzałością aplikacji

- **Context**: Zmiany stanu aplikacji.
- **Problem**: Zapisany stan gry w starszej wersji u użytkowników będzie niekompatybilny z nowym stanem i może spowodować crash.
- **Rule**: Nie implementuj migracji snapshotów stanu przed osiągnięciem odpowiedniego poziomu dojrzałości aplikacji.
- **Applies to**: all
