-- Aftersong storage. Run once in the Supabase SQL editor.
-- The backend uses the service role key and enforces carer and family roles itself.
-- Row level security protects the same rows from direct client access: a signed-in carer can only
-- read or write rows that belong to a care home they are a member of.

create table if not exists public.records (
  collection  text        not null,
  id          text        not null,
  home_id     text,
  resident_id text,
  data        jsonb       not null,
  created_at  timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists records_home_idx     on public.records (collection, home_id);
create index if not exists records_resident_idx on public.records (collection, resident_id);

create table if not exists public.members (
  user_id uuid not null,
  home_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, home_id)
);

alter table public.records enable row level security;
alter table public.members enable row level security;

-- A carer sees their own membership rows only.
drop policy if exists members_self on public.members;
create policy members_self on public.members for select to authenticated using (user_id = auth.uid());

-- Records are visible to members of the record's care home. Rows with no home (family links, sample
-- data, run claims) are not exposed to clients at all.
drop policy if exists records_home_read on public.records;
create policy records_home_read on public.records for select to authenticated
  using (home_id in (select home_id from public.members where user_id = auth.uid()));

drop policy if exists records_home_write on public.records;
create policy records_home_write on public.records for all to authenticated
  using (home_id in (select home_id from public.members where user_id = auth.uid()))
  with check (home_id in (select home_id from public.members where user_id = auth.uid()));

-- Family access never touches these tables directly. It goes through the backend with a private link.
revoke all on public.records from anon;
revoke all on public.members from anon;
