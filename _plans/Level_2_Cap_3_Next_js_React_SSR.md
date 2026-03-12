## Level 2 · Cap. 3 — Next.js (React + SSR)

Acest capitol descrie migrarea sau rescrierea aplicației **VremeaAzi** în **Next.js**, pentru a beneficia de Server-Side Rendering (SSR) și Static Site Generation (SSG), conform `PLAN_Combined.md` (Nivel 2 — Cap. 3).

### Obiective
- Obții pagini SEO-friendly, cu URL-uri de tip `/weather/bucharest`.
- Folosești SSR/SSG pentru a genera pagini cu date meteo direct pe server.
- Integrezi mai ușor autentificarea, API Routes și caching server-side.

### Pași sugerați
- Creezi un proiect Next.js (ideal cu TypeScript) și definești:
  - pagini pentru afișarea vremii (`/`, `/weather/[city]`),
  - API Routes pentru `/api/weather` și `/api/travel` (sau reutilizezi backend-ul Express).
- Refolosești modulele deja extrase:
  - `api/weather`, `api/travel`, `state`, `utils/format`.
- Integrezi bunele practici de PWA, a11y și SEO:
  - meta tags, Open Graph, manifest, service worker (acolo unde e relevant).

Contextul și legăturile cu restul nivelurilor se găsesc în `PLAN_Combined.md` (Nivel 2 — Cap. 3). 

