## Level 2 · Cap. 1 — Rescrie în React (sau Vue)

Acest capitol descrie cum poți migra treptat **VremeaAzi** la un framework modern (React sau Vue), conform `PLAN_Combined.md` (Nivel 2 — Cap. 1).

### Obiective
- Transformi fiecare zonă a aplicației într-un **component** clar:
  - `WeatherHero`, `HourlyForecast`, `FiveDayForecast`,
  - `AirQuality`, `TravelGuide`, `MapSection`.
- Înveți: props, state, lifecycle/hooks (`useState`, `useEffect`), data flow unidirecțional.
- Pregătești terenul pentru integrarea cu Next.js (SSR/SSG) dacă vei dori mai târziu.

### Pași sugerați
- Refactorizezi întâi arhitectura actuală în JS/TS pur:
  - creezi un modul `state.(ts)` pentru datele centrale,
  - extragi funcții de tip `renderX` pentru fiecare secțiune.
- Creezi un proiect nou React/Vue (ideal cu Vite) și copiezi logica treptat:
  - API calls (OpenWeatherMap, OpenTripMap) merg în hooks sau servicii,
  - UI actual devine JSX/templating Vue.
- Opțional: integrezi TanStack Query (React Query) pentru fetching + caching automată a datelor.

Detaliile și legăturile cu restul planului sunt în `PLAN_Combined.md` (Nivel 2 — Cap. 1). 

