## Level 5 · Cap. 1 — PWA (Progressive Web App)

Acest capitol descrie transformarea aplicației **VremeaAzi** într-o **Progressive Web App (PWA)**, conform `PLAN_Combined.md` (Nivel 5 — Cap. 1).

### Obiective
- Faci aplicația instalabilă pe telefon și desktop.
- Permiți funcționarea parțial offline (ultimele date meteo + UI de bază).
- Înveți să folosești `manifest.json`, `service-worker` și Cache API.

### Pași sugerați
- Creezi un `manifest.json` cu:
  - numele aplicației, iconuri, culori,
  - `display: "standalone"`.
- Adaugi un `service-worker.(js|ts)` care:
  - cache-uiește asset-urile statice (HTML, CSS, JS, fonturi),
  - cache-uiește ultimul set de date meteo pentru orașul curent,
  - afișează un mesaj clar când UI-ul rulează pe date din cache.
- Alegi o strategie de caching, de ex. `stale-while-revalidate` pentru datele meteo.

Detalii extra și cum se leagă de caching-ul pe backend (Redis) găsești în `PLAN_Combined.md` (Nivel 5 — Cap. 1). 

