## Level 1 · Cap. 1 — Migrare la TypeScript

Acest capitol descrie migrarea treptată a proiectului **VremeaAzi** la **TypeScript**, așa cum este prezentată în planul combinat `PLAN_Combined.md` (Nivel 1 — Cap. 1).

### Obiective
- Adaugi tipuri la funcțiile principale (ex: `checkWeather(query: string): Promise<void>`).
- Înveți să lucrezi cu `interface`, `type` și generics.
- Obții autocomplete și refactor mai sigur în tot proiectul.

### Pași sugerați
- Instalezi TypeScript și creezi `tsconfig.json`.
- Începi cu modulele fără dependențe de DOM:
  - `utils/format.(ts)` – funcții pure (`normalizeStr`, `windDir`, `dewPoint` etc.).
  - `api/weather.(ts)` și `api/travel.(ts)` – tipuri pentru răspunsurile API.
- Tipizezi treptat restul fișierelor, pe măsură ce înțelegi mai bine structura datelor.

Pentru detalii complete și context, vezi și `PLAN_Combined.md` (secțiunea „Nivel 1 — Fundamente moderne, Cap. 1”). 

