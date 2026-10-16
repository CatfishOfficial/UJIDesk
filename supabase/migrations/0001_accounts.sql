-- UJI Desk accounts: one state row per student and one row per saved desk.
-- Run once on a new Supabase project: Supabase dashboard → SQL Editor → paste → Run.
--
-- Row-level security means each signed-in student can only ever read or write
-- their own rows; the publishable key in the app can't reach anyone else's.

-- Progress, settings, the live board and small flags, as the app saves them.
-- `rev` goes up by one on every save, so two devices can't silently overwrite
-- each other (the app only saves over the version it last saw).
create table public.user_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  board jsonb not null default '{}'::jsonb,
  flags jsonb not null default '{}'::jsonb,
  rev bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Saved desks, one row each, keyed by the id the app already gives them.
-- Times come from the app (when the desk was made and last saved there).
create table public.desks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  snapshot jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_state_touch before update on public.user_state
for each row execute function public.touch_updated_at();

alter table public.user_state enable row level security;
alter table public.desks enable row level security;

create policy "Students read their own state" on public.user_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Students create their own state" on public.user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Students update their own state" on public.user_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Students read their own desks" on public.desks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Students add their own desks" on public.desks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Students update their own desks" on public.desks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Students delete their own desks" on public.desks
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update on public.user_state to authenticated;
grant select, insert, update, delete on public.desks to authenticated;

-- "Delete my account": removes the caller's sign-in, and with it (cascade) their
-- state and desks. Runs with the owner's rights because auth.users isn't
-- writable from the app; it only ever deletes the caller.
create function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
