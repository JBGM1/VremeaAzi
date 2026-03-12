## Level 3 · Cap. 3 — Redis caching

Acest capitol descrie folosirea lui **Redis** pentru caching la nivel de backend, astfel încât răspunsurile de la OpenWeatherMap (și alte API-uri) să fie servite mai rapid și cu mai puține request-uri externe, conform `PLAN_Combined.md` (Nivel 3 — Cap. 3).

### Obiective
- Reduci numărul de apeluri către API-urile externe.
- Îmbunătățești timpul de răspuns pentru utilizator.
- Înveți să lucrezi cu TTL, invalidare de cache și strategii de caching.

### Pași sugerați
- Rulezi un server Redis local (sau folosești un Redis managed în cloud).
- În backend:
  - înainte de a apela OpenWeatherMap, verifici dacă există date în cache pentru `city` sau pentru coordonatele cerute,
  - dacă da → returnezi datele din Redis,
  - dacă nu → faci request la API, salvezi rezultatul în Redis cu un TTL (ex. 10 minute) și apoi îl returnezi.
- Extinzi caching-ul și pentru date de travel/ghid, dacă are sens.

Relația dintre acest caching și caching-ul din PWA (pe frontend) este explicată în `PLAN_Combined.md` (Nivel 3 — Cap. 3). 

