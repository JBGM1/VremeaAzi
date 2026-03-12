## Level 3 · Cap. 2 — Autentificare (Auth)

Acest capitol descrie introducerea autentificării în aplicația **VremeaAzi**, astfel încât favoritele și alte date să poată fi sincronizate între dispozitive, conform `PLAN_Combined.md` (Nivel 3 — Cap. 2).

### Obiective
- Permiți utilizatorilor să se logheze (email/parolă sau OAuth — Google/GitHub).
- Legi datele din baza de date (favorite, preferințe) de un `userId`.
- Înveți concepte de JWT, sesiuni, cookies și middleware de protecție a rutelor.

### Pași sugerați
- Dacă folosești Next.js:
  - integrezi **NextAuth.js** pentru OAuth + email/password,
  - protejezi anumite pagini sau API Routes cu middleware.
- Dacă folosești un backend separat:
  - implementezi login/register cu JWT sau sesiuni,
  - adaugi middleware pentru verificarea token-ului/sesiunii pe rutele protejate.
- Leagă favoritele și alte resurse de `userId`, astfel încât fiecare utilizator să-și vadă propriile date.

Legătura cu DB și restul infrastructurii este detaliată în `PLAN_Combined.md` (Nivel 3 — Cap. 2). 

