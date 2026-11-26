-- Rigor Advanced Solutions: Supabase setup
-- Run this once in Supabase Dashboard > SQL Editor > New query.
-- It creates a single row table that holds the whole site's editable settings as JSON.

create table if not exists public.site_settings (
  id integer primary key,
  settings jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security: ON, with public read, and writes only for authenticated users.
-- The public site reads settings with the anon key. Admin saves should use a
-- signed in session (Supabase Auth), or, for a simple single owner site, you can
-- temporarily allow anon upsert and tighten it once Auth is wired up.
alter table public.site_settings enable row level security;

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
  on public.site_settings for select
  using (true);

drop policy if exists "Authenticated users can save site settings" on public.site_settings;
create policy "Authenticated users can save site settings"
  on public.site_settings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Optional, single owner shortcut (only if you do NOT use Supabase Auth yet):
-- drop policy if exists "Anon can save site settings" on public.site_settings;
-- create policy "Anon can save site settings"
--   on public.site_settings for all
--   using (true) with check (true);
-- Note: that shortcut lets anyone with your anon key overwrite settings.
-- Prefer Auth, or keep admin edits in localStorage until Auth is added.

-- Seed the row (id 1) with an empty object; the app merges it with its built in
-- defaults, so the live site is never blank even before the first admin save.
insert into public.site_settings (id, settings)
values (1, '{}'::jsonb)
on conflict (id) do nothing;
