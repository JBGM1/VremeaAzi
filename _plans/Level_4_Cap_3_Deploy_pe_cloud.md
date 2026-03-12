## Level 4 · Cap. 3 — Deploy pe cloud

Acest capitol descrie opțiuni de **deploy pe cloud** pentru aplicația **VremeaAzi**, conform `PLAN_Combined.md` (Nivel 4 — Cap. 3).

### Obiective
- Publici aplicația astfel încât să fie accesibilă public, cu HTTPS și CDN.
- Separi responsabilitățile:
  - frontend static pe un provider de hosting static,
  - backend + DB pe un alt serviciu sau în același ecosistem.

### Pași sugerați
- Frontend:
  - Vercel, Netlify sau Cloudflare Pages pentru build & deploy automat din GitHub.
- Backend:
  - Railway, Render, Fly.io sau Vercel serverless functions (dacă backendul e doar API).
- Bază de date:
  - Supabase (PostgreSQL managed),
  - sau serviciul de DB al provider-ului ales (Railway/Render etc.).
- Configurezi:
  - environment variables pentru cheile API,
  - URL-urile între frontend și backend.

Legătura cu CI/CD și Docker este detaliată în `PLAN_Combined.md` (Nivel 4 — Cap. 3). 

