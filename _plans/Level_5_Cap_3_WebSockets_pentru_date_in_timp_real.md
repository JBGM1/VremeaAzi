## Level 5 · Cap. 3 — WebSockets pentru date în timp real

Acest capitol descrie folosirea **WebSockets** pentru a livra date în timp real în aplicația **VremeaAzi**, conform `PLAN_Combined.md` (Nivel 5 — Cap. 3).

### Obiective
- Înlocuiești sau completezi fetch-urile periodice cu update-uri push de la server.
- Poți afișa:
  - alerte meteo în timp real,
  - actualizări de temperatură/fenomene fără reload.
- Înveți principiile arhitecturii event-driven.

### Pași sugerați
- Alegi un stack:
  - `socket.io` pe Node.js,
  - sau WebSockets native + o abstracție ușoară.
- În backend:
  - menții o conexiune WebSocket cu clienții,
  - emiți evenimente când detectezi schimbări (sau la intervale regulate).
- În frontend:
  - te conectezi la WebSocket la încărcarea aplicației,
  - asculți evenimente și actualizezi state-ul/UI în consecință.

Conexiunea cu restul infrastructurii (backend, caching, grafice) este prezentată în `PLAN_Combined.md` (Nivel 5 — Cap. 3). 

