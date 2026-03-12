## Level 1 · Cap. 3 — Variabile de mediu pentru API keys

Acest capitol explică mutarea cheilor API din frontend în **variabile de mediu**, pe backend sau în funcții serverless, conform `PLAN_Combined.md` (Nivel 1 — Cap. 3).

### Obiective
- Să nu mai expui cheile OpenWeatherMap / OpenTripMap în codul frontend.
- Să folosești `.env` și secretele platformei de hosting.
- Să simplifici apelurile din frontend la endpoint-uri proprii (`/api/...`).

### Pași sugerați
- Identifici cheile hardcodate în `script.js` și înlocuiești referințele cu apeluri la:
  - un backend Node (Express/Fastify) care citește cheile din `.env`, sau
  - funcții serverless (Vercel/Netlify Functions) care citesc cheile din environment configuration.
- Defini endpoint-uri clare:
  - `GET /api/weather?city=...`,
  - `GET /api/travel?lat=...&lon=...`.
- Normalizezi răspunsurile (ex. `{ success, data, error }`) pentru a simplifica partea de UI.

Contextul mai larg și legăturile cu backend/serverless sunt descrise în `PLAN_Combined.md` (Nivel 1 — Cap. 3). 

