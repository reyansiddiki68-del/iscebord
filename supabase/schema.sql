-- ISCE Board demo portal persistent state table.
-- Run once in Supabase SQL Editor. Never expose the service-role key in browser code.
create table if not exists public.portal_state (
  id text primary key default 'main' check (id = 'main'),
  payload jsonb not null default '{"users":[],"applications":[],"students":[],"notices":[],"examFormsOpen":true,"resultsPublished":false,"nextSchool":1002,"nextStudent":10001,"sessions":{}}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.portal_state enable row level security;
revoke all on table public.portal_state from anon, authenticated;
