## Level 3 · Cap. 1 — Bază de date + „favorite cities”

Acest capitol descrie adăugarea unei baze de date pentru a salva orașe favorite și, pe viitor, alte preferințe ale utilizatorului, conform `PLAN_Combined.md` (Nivel 3 — Cap. 1).

### Obiective
- Extinzi logica actuală de `recent searches` (localStorage) la nivel de backend + DB.
- Perimiți utilizatorilor să salveze favorite sincronizate între dispozitive.
- Înveți să lucrezi cu un ORM modern și cu migrations.

### Pași sugerați
- Alegi un stack:
  - PostgreSQL + Prisma,
  - sau MongoDB + Mongoose (dacă preferi NoSQL).
- Defini un model de date simplu:
  - tabel/colecție `CityFavorite` legat eventual de un `User` (după ce ai Auth).
- Creezi endpoint-uri:
  - `GET /api/favorites`,
  - `POST /api/favorites` (adaugă oraș),
  - `DELETE /api/favorites/:id`.
- Integrezi în frontend:
  - buton „⭐ Favorite” pe lângă numele orașului,
  - listă de orașe favorite în sidebar sau într-o secțiune dedicată.

Mai multe conexiuni cu restul arhitecturii regăsești în `PLAN_Combined.md` (Nivel 3 — Cap. 1). 

