# Rigor Advanced Solutions (RAS) — Standalone Website

Extremely elegant, professional, high tech website for Rigor Advanced Solutions, an AI consulting and development business in Denver, Colorado.

- **Stack:** React + TypeScript + Vite, no extra router, CSS variables for theming
- **Design:** dark navy `#040b18`, accent blue `#56c8f5`, lighter blue headings `#abd8f8`, no white font, Outfit headings, Plus Jakarta Sans body, glowing network globe hero
- **Pages:** Home, Services, About, Contact, plus an Admin view
- **Phone:** +1 (720) 326 9999, shown with spaces. Location: Denver, Colorado only, no street address.
- **Admin:** edit fonts, colours, business name, phone, location, and every heading, paragraph, button, label, service detail, form label, and footer line. Saves to Supabase when configured, otherwise to the browser's localStorage, so the site works out of the box.
- **Rules kept from the approved design:** RAS logo and full name on their own header row, nav on a separate row below, phone optimised with breathing room on the left, no Contact Us / Explore buttons, closing bands, or footer on Home, Services, or About, only on Contact. No hyphens in visible copy, commas are used instead.

## Run it locally

```bash
npm install
npm run dev
```

Open the address Vite prints, usually http://localhost:5173

## Build it

```bash
npm run build
npm run preview
```

`npm run build` runs `tsc -b && vite build` and outputs to `dist/`.

## Deploy — Vercel + Supabase (recommended, free)

### Step 1: Supabase database

1. Create a free account at https://supabase.com and start a **New Project**.
2. In the Supabase Dashboard, go to **SQL Editor > New query**, paste the whole contents of `supabase.sql` in this repo, and run it. It creates the `site_settings` table and Row Level Security policies (public read, authenticated write).
3. Go to **Project Settings > API** and copy your **Project URL** and **anon public key**.

### Step 2: Push to GitHub

```bash
git init
git add .
git commit -m "Rigor Advanced Solutions website"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/rigor-advanced-solutions.git
git push -u origin main
```

`.env` is gitignored, so your keys never go to GitHub.

### Step 3: Deploy the frontend on Vercel

1. Sign in to https://vercel.com with GitHub and click **Add New Project > Import**, then select this repository. Vercel auto detects Vite: build command `npm run build`, output directory `dist`.
2. Before clicking **Deploy**, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key
3. Click **Deploy**. Every future `git push` to `main` automatically rebuilds and redeploys.
4. Add your custom domain in Vercel (**Settings > Domains**), for example `rigoradvancedsolutions.com`, and follow Vercel's DNS instructions at your domain registrar. Vercel provides free SSL automatically.

Cloudflare Pages works the same way: import the repo, same build settings, same two environment variables.

### SPA routing

`vercel.json` in this repo already contains the rewrite that sends every path to `/index.html`, so refreshing a subpage never 404s. Cloudflare Pages handles SPA fallbacks automatically as long as there is no custom `404.html` in the build output.

## Admin

Open the site, click **Admin** at the top, edit any field, press **Save Changes**, then **Preview Site** to see it live.

- With Supabase configured, saves go to the `site_settings` table (row id 1) and are shared across every visitor and device.
- Without Supabase keys, saves go to localStorage in that browser only, and the site still works fully.
- **Reset to Original** restores the approved design and saves that as well.

Admin saves currently use the anon key, so the RLS policy in `supabase.sql` (authenticated write) will block anon saves until Supabase Auth is added. Until then, either add Auth and sign in, or use the optional anon write policy noted in `supabase.sql`, understanding that anyone with the anon key could then overwrite settings. The site reads settings publicly either way.

## Files

- `src/App.tsx` — all pages, header, footer, and the Admin panel
- `src/lib/settings.ts` — default copy, colours, fonts, and the settings type
- `src/lib/store.ts` — load/save settings (Supabase first, localStorage fallback)
- `src/lib/supabase.ts` — Supabase client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- `src/index.css` — all styling, responsive breakpoints, phone layout
- `supabase.sql` — settings table + RLS
- `vercel.json` — SPA rewrite
- `.env.example` — the two environment variables to set
