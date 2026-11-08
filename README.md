# BLOOM — CAFEC Malaysia Brewers Cup 2026

Personal practice dashboard: recipes, brews, practice days, rehearsal timer.
Vite + React + TypeScript + Tailwind, Framer Motion, Recharts. Backend: Google Apps Script + Google Sheet.

## Run locally

```bash
npm install
cp .env.example .env      # optional — without it, data stays in this browser ("Local only")
npm run dev               # http://localhost:5173
```

`npm run build` type-checks and builds to `dist/`. `npm run preview` serves the build.

Open **Settings (⚙) → Load demo data** to see the charts with 2 practice days / 4 brews.
Press **N** anywhere to start a new brew.

Put the official rules PDF at `public/rules.pdf` to enable the Rules tab viewer.

## Backend: Google Sheet + Apps Script

1. Create a new Google Sheet (e.g. "Bloom").
2. **Extensions → Apps Script**. Replace the contents of `Code.gs` with [`apps-script/Code.gs`](apps-script/Code.gs). Save.
3. **Project Settings (⚙) → Script Properties → Add property**: `API_TOKEN` = a long random string.
4. Optional: select `setup` in the function dropdown and **Run** once (authorise when prompted). It creates the
   `recipes`, `brews`, `days`, `settings` tabs. They are also created automatically on first write.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Copy the Web app URL (ends in `/exec`).
6. In `.env`:
   ```
   VITE_GAS_URL=https://script.google.com/macros/s/XXXX/exec
   VITE_GAS_TOKEN=<same value as API_TOKEN>
   ```
7. Restart `npm run dev`. The header pill should go **Syncing → Saved**.

When you change `Code.gs` later, use **Deploy → Manage deployments → Edit → Version: New version** so the URL stays the same.

**How sync works:** every change is applied locally first (localStorage), then queued and POSTed to the script.
If you're offline the queue is kept and retried every 15 s, on reconnect, and when the tab regains focus.
On load the app pulls everything and merges by `updatedAt` (last write wins, on both client and server). Deletes are
soft (`deleted = TRUE` in the Sheet). Each tab stores the full object in the `json` column, plus readable
`title` / `date` / `overall` columns for scanning.

POSTs are sent as `Content-Type: text/plain;charset=utf-8` so the browser doesn't send a CORS preflight
(Apps Script can't answer `OPTIONS`).

> **Security note:** `VITE_GAS_TOKEN` is compiled into the front-end bundle, so anyone who loads the site can read it.
> That's acceptable for a personal tool. To rotate it, change the Script Property and `.env`, then redeploy.

## Deploy (static)

**Vercel:** import the repo → framework "Vite" → add env vars `VITE_GAS_URL`, `VITE_GAS_TOKEN` → deploy.
**Netlify:** build command `npm run build`, publish directory `dist`, add the same env vars.
Routing is hash-based (`#/recipes`), so no rewrite rules are needed (a `_redirects` file is included anyway).

## Structure

```
apps-script/Code.gs        Apps Script backend (doGet list, doPost upsert/delete, token + LockService, LWW)
src/types.ts               Data model (Recipe, Brew, PracticeDay, Settings)
src/data/api.ts            Apps Script client
src/data/store.tsx         Store: localStorage cache, optimistic updates, retry queue, merge
src/lib/defaults.ts        Starter recipe, champion templates, dropdown options, temp hints
src/lib/calc.ts            Ratios, EY, submission check, day numbering, recipe diffing
src/lib/time.ts            Asia/Kuala_Lumpur formatting helpers
src/lib/demo.ts            Demo data
src/lib/export.ts          JSON / CSV export, JSON import
src/components/            Header + countdown, UI kit, charts (radar, pour curve, temp gauge), spec editor/view
src/pages/                 Dashboard, Recipes, Brews (form + detail), Compare, Days, Timer, Rules
```
