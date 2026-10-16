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

## Enable camera pixel alignment for tracking

- **Context**: graphics and rendering
- **Problem**: when objects are rendered and are moving then they might appear in glitchy way due to lack of pixel alignment
- **Rule**: that problem is solved with phaser engine the camera pixel alignement flag needs to be set when tracking
- **Applies to**: implement

## Reuse display-label constants

- **Context**: when adding text to some view/user visible control
- **Problem**: when text is just entered to control then in tests we also need to use exact string to get a match, it makes a need to maintain same string in two places
- **Rule**: use constant value and use text through the reference
- **Applies to**: implement, impl-review

## Opening facility levels belong to the facility/planet pair

- **Context**: planetary facility definitions, initial state, investment quotes and projections.
- **Problem**: `PlanetFacilityDefinition.initialLevel` was one value per facility, so every planet opened with the same built facilities. The opening level is really a facility/planet property, and the initial state, the downgrade floor and the landed projection each consumed it.
- **Rule**: the opening level lives in `planetFacilityInitialLevels` in `src/game/definitions/planetFacilityDefinitions.ts`: a facility opens at level 1 only on the planet named by its `planetFacilityModifiers` specialization and unbuilt at level 0 on every other planet. Every catalogue used by quotes or projections exposes `initialLevelOf(facilityId, planetId)` next to `modifierOf`, and `tests/domain/planetCatalog.test.mjs` binds the opening-level record to the specialization pairs.
- **Applies to**: implement, impl-review
