---
name: cicd-prod-deploy
description: Prod deploy i weryfikacja MilkyWayTrader przez GitHub Actions, z raportem i testem Chrome/Edge.
---

Z repozytorium uruchom jeden skrypt:

```powershell
node --use-system-ca <katalog-tego-skilla>/scripts/deploy.mjs --deploy-authorized
```

Flagę dodawaj tylko na zlecenie prod deploy; bez niej wykonuj samą weryfikację. Skrypt sprawdza main/origin, CI, Cloudflare, hashe i przeglądarki, zapisuje raport. Udane wydanie SHA wykorzystuje ponownie.

Przy PASS nie czytaj implementacji ani logów: obejrzyj wskazany zrzut menu, podaj URL/status i raport. Przy błędzie sprawdź wskazany log; nie ponawiaj automatycznie publikacji ani rollbacku. Nigdy nie wypisuj sekretów.

Skrypt nie commituje/pushuje. Nieopublikowany SHA: przygotuj selektywny commit; `git push` wymaga jawnej zgody według AGENTS.md. Historia wszystkich kroków: [references/first-run.md](references/first-run.md), czytaj tylko na pytanie o przebieg.
