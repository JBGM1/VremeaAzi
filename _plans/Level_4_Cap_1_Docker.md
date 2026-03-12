## Level 4 · Cap. 1 — Docker

Acest capitol descrie containerizarea aplicației **VremeaAzi** folosind **Docker**, conform `PLAN_Combined.md` (Nivel 4 — Cap. 1).

### Obiective
- Rulezi frontend, backend și baza de date în containere separate.
- Obții un mediu de rulare reproductibil, ușor de partajat și de deploy-uit.
- Înveți concepte de imagini, containere, volume și networking între servicii.

### Pași sugerați
- Creezi un `Dockerfile` pentru backend (și, opțional, pentru frontend dacă nu e static).
- Creezi un `docker-compose.yml` care pornește:
  - backend (Node/Express sau Next.js),
  - baza de date (PostgreSQL/MongoDB),
  - Redis (dacă folosești caching),
  - opțional Nginx ca reverse proxy.
- Montezi volume pentru persistența datelor (DB) și configurezi rețeaua internă între servicii.

Contextul mai larg de DevOps și deployment este descris în `PLAN_Combined.md` (Nivel 4 — Cap. 1). 

