## Level 1 · Cap. 2 — Webpack sau Vite (bundler)

Acest capitol descrie introducerea unui bundler modern (de preferat **Vite**) pentru proiectul **VremeaAzi**, așa cum este prezentat în `PLAN_Combined.md` (Nivel 1 — Cap. 2).

### Obiective
- Spargi `script.js` într-o serie de module ES (API, UI, utils, state).
- Configurezi un bundler (recomandat: **Vite**) pentru:
  - HMR (hot reload),
  - build optimizat pentru producție,
  - integrare ușoară cu TypeScript și ulterior cu React/Vue.

### Pași sugerați
- Inițializezi `npm` și instalezi Vite ca dev dependency.
- Creezi `src/main.(js|ts)` și muți logica de inițializare acolo.
- Creezi module precum:
  - `src/api/weather.(js|ts)`,
  - `src/api/travel.(js|ts)`,
  - `src/ui/theme.(js|ts)`,
  - `src/ui/search.(js|ts)`,
  - `src/utils/format.(js|ts)`.
- Actualizezi `index.html` pentru a încărca `<script type="module" src="/src/main.(js|ts)">`.

Mai multe detalii și legături cu restul planului găsești în `PLAN_Combined.md` (Nivel 1 — Cap. 2). 

