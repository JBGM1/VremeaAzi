## Plan combinat dezvoltare VremeaAzi

Această documentație combină ideile din:

- `Plan_claude.md` (structură pe **niveluri** și **capitole**),
- `PLAN_VremeaAzi.md` (detalii practice pe tooling, testare, backend, PWA, a11y, CI/CD),
într-un singur plan coerent, organizat pe niveluri de dificultate.

---

## Nivel 1 — Fundamente moderne

### Cap. 1 — Migrare la TypeScript

- Adaugi tipuri la funcțiile principale (ex: `checkWeather(query: string): Promise<void>`).
- Înveți: **type safety**, `interface`/`type`, generics — cerute în orice job frontend.
- Tooling minim: `typescript`, `tsconfig.json`, fără să schimbi încă arhitectura.

**Din planul VremeaAzi:**

- Poți începe cu fișierele extrase în `src/utils/format.ts`, `src/api/weather.ts`, `src/api/travel.ts`.
- Tipurile pentru răspunsurile OpenWeatherMap și OpenTripMap te ajută mult la refactor și la testare.

---

### Cap. 2 — Webpack sau Vite (bundler)

- Spargi `script.js` în module ES: de ex. `weather.(js|ts)`, `travel.(js|ts)`, `ui.(js|ts)`, `storage.(js|ts)`.
- Înveți: **module bundling**, tree-shaking, HMR (hot reload), build optimizat pentru producție.
- **Vite** este mai simplu și este standard în 2025/2026 pentru aplicații React/Vue/TS.

**Din planul VremeaAzi:**

- Inițializezi proiectul cu `npm init -y` și adaugi Vite (`npm install vite --save-dev`).
- Creezi `src/main.(js|ts)` în care:
  - imporți modulele (`api`, `ui`, `state`, `utils`),
  - faci inițializările (event listeners, încărcare oraș implicit).
- Schimbi în `index.html` scriptul clasic cu `<script type="module" src="/src/main.ts"></script>`.

---

### Cap. 3 — Variabile de mediu pentru API keys

- În prezent, cheile sunt hardcodate în `script.js` (vizibile în browser și în repo).
- Înveți: `.env`, `dotenv`, noțiunea de **secrete** (nu se commitează niciodată).

**Din planul VremeaAzi (backend / serverless):**

- Muți cheile în variabile de mediu pe backend sau în funcții serverless:
  - Node + Express/Fastify: folosești `.env` + `dotenv`.
  - Vercel/Netlify Functions: cheile se configurează în dashboard și nu ajung în client.
- Frontend-ul apelează doar endpoint-uri locale, ex. `/api/weather`, `/api/travel`, fără să „vadă” cheile.

---

## Nivel 2 — Frameworks și arhitectură

### Cap. 1 — Rescrie în React (sau Vue)

- Fiecare secțiune devine component:
  - `<WeatherHero>`, `<HourlyForecast>`, `<FiveDayForecast>`,
  - `<AirQuality>`, `<TravelGuide>`, `<MapSection>`.
- Înveți: **componentizare**, `props`, `state`, hooks (`useState`, `useEffect`).
- Bonus: poți adăuga TanStack Query (React Query) pentru fetch cu caching automat.

**Din planul VremeaAzi (arhitectură frontend):**

- Înainte să sari în React/Vue, poți:
  - introduce un „store” central (modul `state.(ts)`),
  - extrage funcții de randare: `renderHeroWeather`, `renderHourlyForecast`, `renderTravelGuide` etc.
- Acest pas îți face migrarea spre framework mult mai simplă (ai deja graniță clară între „date” și „UI”).

---

### Cap. 2 — Backend simplu cu Node.js + Express

- Muți apelurile către OpenWeatherMap / OpenTripMap pe backend, ca să ascunzi cheile.
- Creezi endpoint-uri precum:
  - `GET /api/weather?city=București`,
  - `GET /api/travel?lat=...&lon=...`.
- Înveți: **REST API**, Express.js, CORS, pattern de proxy.
- Bonus: adaugi **rate limiting** (protecție la prea multe request-uri).

**Din planul VremeaAzi (secțiunea Backend / serverless):**

- Structură sugerată:
  - folder `server/` cu un `index.(ts|js)` ce pornește Express,
  - module separate `weatherService`, `travelService` care apelează API-urile externe.
- Normalizare răspuns: `{ success, data, error }`, pentru a simplifica UI-ul.

---

### Cap. 3 — Next.js (React + SSR)

- Transformi aplicația în Next.js pentru:
  - pagini cu **SSR/SSG**,
  - URL-uri de tip `/weather/bucharest` — mult mai bune pentru SEO și share.
- Înveți: Server-Side Rendering, Static Generation, App Router, API Routes — foarte căutate în industrie.

**Legătură cu planul VremeaAzi:**

- Toată structura modulară, backend-ul și lucrul cu TypeScript se potrivesc perfect cu Next.js:
  - modulele de API și de state se mută aproape „copy-paste” în `app/` sau `pages/`,
  - PWA, SEO și a11y rămân relevante și în context Next.js.

---

## Nivel 3 — Date și persistență

### Cap. 1 — Bază de date + „favorite cities”

- Userul poate salva orașe favorite (acum folosești doar `localStorage`).
- Stack recomandat:
  - PostgreSQL + Prisma ORM,
  - sau MongoDB + Mongoose.
- Înveți: CRUD, relații, migrations, patterns de acces la date.

**Conexiune cu planul VremeaAzi:**

- Poți porni de la logica existentă de „recent searches” și să o extinzi:
  - preferințele persistă între dispozitive,
  - se sincronizează via backend și DB.

---

### Cap. 2 — Autentificare (Auth)

- Login/register pentru a sincroniza favoritele pe mai multe dispozitive.
- Stack posibil:
  - NextAuth.js (dacă ești pe Next.js),
  - sau Supabase Auth (OAuth cu Google/GitHub).
- Înveți: JWT, sesiuni, middleware de autentificare — esențial în aplicații reale.

---

### Cap. 3 — Redis caching

- Vremea pentru un oraș nu se schimbă la fiecare secundă.
- Cache-uiești răspunsurile OpenWeatherMap în Redis, de ex. **10 minute**.
- Înveți: strategii de caching, TTL, invalidare cache, optimizare de performanță.

**Legat de PWA și caching din planul VremeaAzi:**

- Pe backend: Redis pentru cache „global”.
- Pe frontend: Cache API + Service Worker pentru offline și timp de răspuns mic.

---

## Nivel 4 — DevOps și deployment

### Cap. 1 — Docker

- Containerizezi aplicația:
  - `Dockerfile` pentru backend și/sau frontend,
  - `docker-compose.yml` pentru a porni împreună backend + DB + Redis.
- Înveți: imagini, volume, networking între servicii.
- Bonus: container Nginx ca reverse proxy.

---

### Cap. 2 — CI/CD cu GitHub Actions

- La fiecare `git push`:
  - rulezi `npm install`,
  - rulezi testele (Vitest/Jest, Playwright/Cypress),
  - rulezi `npm run build`.
- Înveți: workflows, folosirea de **secrete** în CI, pipeline de build.

**Din planul VremeaAzi (CI/CD și deploy):**

- Poți avea joburi separate pentru:
  - `lint + unit tests`,
  - `build`,
  - `deploy` (trigger doar pe `main` sau pe tag-uri).

---

### Cap. 3 — Deploy pe cloud

- Frontend:
  - Vercel, Netlify sau Cloudflare Pages (CDN, HTTPS automat).
- Backend:
  - Railway, Render, Fly.io sau Vercel serverless functions.
- Bază de date:
  - Supabase (PostgreSQL managed),
  - sau serviciul DB al platformei alese.

**Ce se leagă din planul VremeaAzi:**

- Structura cu API proxy și env vars pe server se potrivește direct cu aceste servicii.

---

## Nivel 5 — Features avansate

### Cap. 1 — PWA (Progressive Web App)

- Aplicația devine **instalabilă pe telefon** și funcționează parțial offline.
- Adaugi:
  - `manifest.json` (nume, iconuri, culori, `display: "standalone"`),
  - `service-worker.(js|ts)` cu caching pentru asset-uri și date meteo.
- Înveți: Cache API, strategii de caching (`stale-while-revalidate`), background sync, push notifications.

**Detalii din planul VremeaAzi (secțiunea PWA și offline):**

- Cache-uiești:
  - HTML, CSS, JS și fonturi,
  - ultimul set de date meteo pentru orașul curent.
- La lipsă rețea, afișezi clar: „Date din cache – pot fi depășite”.

---

### Cap. 2 — Grafice cu Chart.js sau Recharts

- Vizualizezi:
  - temperatura ultimelor 24h ca **grafic de tip linie**,
  - precipitațiile ca **grafic bar**,
  - evoluția indicelui de calitate a aerului (AQI).
- Înveți: data visualization, integrarea librăriilor de charting — util în dashboard-uri, fintech etc.

**Legat de planul VremeaAzi (secțiunea „Date și vizualizare”):**

- Poți începe cu o singură componentă grafică (ex. temperatură vs. oră) și extinde ulterior.

---

### Cap. 3 — WebSockets pentru date în timp real

- În loc să faci fetch periodic, backend-ul trimite update-uri în timp real (ex. schimbări de temperatură sau alertă meteo).
- Stack posibil: `socket.io` sau WebSockets native.
- Înveți: event-driven architecture, subscription-based updates.

---

## Recomandare de parcurs unificat

Un traseu rezonabil, combinând ambele planuri:

1. **Nivel 1**
  - Cap. 1–3: Vite + TypeScript + variabile de mediu / secrete.
  - În paralel, introduci **testare unitară și E2E** (Vitest + Playwright) pentru funcțiile și fluxurile critice.
2. **Nivel 2**
  - Cap. 1: migrare graduală spre React/Vue (sau direct Next.js dacă vrei SSR).
  - Cap. 2: backend cu Node/Express sau funcții serverless pentru API proxy.
3. **Nivel 3**
  - Cap. 1–3: DB pentru favorite, auth, Redis caching.
4. **Nivel 4**
  - Cap. 1–3: Docker, CI/CD cu GitHub Actions, deploy pe cloud.
5. **Nivel 5**
  - Cap. 1–3: PWA, grafice, WebSockets — polish avansat pentru produs.

Pe lângă aceste etape, continuă să îmbunătățești:

- **a11y + SEO** (navigare cu tastatura, ARIA, meta tags, OpenGraph),
- **UX de erori** (mesaje clare când API-urile pică),
- **observabilitate** (logging structurat, integrare cu un serviciu de error tracking dacă vrei).

