## Level 2 · Cap. 2 — Backend simplu cu Node.js + Express

Acest capitol descrie crearea unui backend simplu în **Node.js + Express** pentru a ascunde cheile API și a centraliza logica de acces la OpenWeatherMap și OpenTripMap, conform `PLAN_Combined.md` (Nivel 2 — Cap. 2).

### Obiective
- Expui endpoint-uri proprii:
  - `GET /api/weather?city=...`,
  - `GET /api/travel?lat=...&lon=...`.
- Cheile OpenWeatherMap / OpenTripMap sunt stocate doar pe server, nu în frontend.
- Structură clară de servicii și error handling unitar.

### Pași sugerați
- Creezi un director `server/` cu un entry-point (ex. `index.(js|ts)`):
  - configurezi Express,
  - adaugi rutele `/api/weather` și `/api/travel`.
- Creezi servicii separate:
  - `weatherService` — apelează OpenWeatherMap, parsează răspunsul,
  - `travelService` — apelează OpenTripMap + Wikipedia.
- Folosești `.env` + `dotenv` pentru chei și setezi CORS doar pentru origin-ul aplicației tale.
- Normalizezi răspunsurile în format `{ success, data, error }`.

Mai multe detalii și exemple conceptuale ai în `PLAN_Combined.md` (Nivel 2 — Cap. 2). 

