## Level 4 · Cap. 2 — CI/CD cu GitHub Actions

Acest capitol descrie configurarea unui pipeline de **CI/CD cu GitHub Actions** pentru proiectul **VremeaAzi**, conform `PLAN_Combined.md` (Nivel 4 — Cap. 2).

### Obiective
- Rulezi automat:
  - instalarea dependențelor,
  - testele (unit + E2E),
  - build-ul aplicației.
- Opțional: declanșezi deploy automat după ce toate verificările trec.

### Pași sugerați
- Creezi un workflow (ex. `.github/workflows/ci.yml`) care:
  - pornește la `push` și/sau `pull_request`,
  - rulează `npm ci` / `npm install`,
  - rulează `npm test` (Vitest/Jest) și, dacă există, `npm run test:e2e`,
  - rulează `npm run build`.
- Adaugi un workflow separat pentru **deploy**, care se execută doar pe branch-ul principal (ex. `main`).
- Stochezi în **secrets** valorile sensibile (chei API, connection strings).

Detalii suplimentare și cum se leagă cu Docker și deploy găsești în `PLAN_Combined.md` (Nivel 4 — Cap. 2). 

