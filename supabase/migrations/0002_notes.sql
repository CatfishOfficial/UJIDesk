-- UJI Desk: saved scratchpad notes, one row each, synced like desks.
-- Run once, after 0001_accounts.sql: Supabase dashboard → SQL Editor → paste → Run.
-- Until it's run, notes still work but stay on each device.

create table public.notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  -- The page itself: { text, strokes, size }, as the app saves it.
  body jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

alter table public.notes enable row level security;

create policy "Students read their own notes" on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Students add their own notes" on public.notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Students update their own notes" on public.notes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Students delete their own notes" on public.notes
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.notes to authenticated;
