## Level 5 · Cap. 2 — Grafice cu Chart.js sau Recharts

Acest capitol descrie adăugarea de **grafice** pentru a vizualiza datele meteo și de calitate a aerului în **VremeaAzi**, conform `PLAN_Combined.md` (Nivel 5 — Cap. 2).

### Obiective
- Reprezinți vizual:
  - temperatura pe ultimele ore/zile (line chart),
  - precipitațiile (bar chart),
  - evoluția indicelui de calitate a aerului (AQI).
- Înveți bazele data visualization și integrarea unei librării de charting.

### Pași sugerați
- Alegi o librărie:
  - pentru React: **Recharts**, **Nivo**, **Victory** etc.,
  - pentru JS simplu: **Chart.js**.
- Defini un component (sau modul) dedicat graficelor:
  - primește datele deja procesate (ex. `[timestamp, temperature]`),
  - se ocupă doar de desenarea graficului.
- Integrezi graficele în secțiunile existente:
  - „Prognoză orară”,
  - „Prognoză 5 zile”,
  - „Calitatea aerului”.

Mai multe detalii conceptuale și cum se leagă de structura de date ai în `PLAN_Combined.md` (Nivel 5 — Cap. 2). 

