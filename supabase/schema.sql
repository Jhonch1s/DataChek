-- Ejecutar una sola vez en el SQL Editor de un proyecto nuevo.
begin;
create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.staff enable row level security;
create policy "Read own membership" on public.staff for select to authenticated using (user_id = (select auth.uid()));
grant select on public.staff to authenticated;
revoke all on public.staff from anon;
revoke insert, update, delete on public.staff from authenticated;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 150),
  group_name text not null default '' check (char_length(group_name) <= 80)
);
create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 100)
);
create table public.documents (
  student_id uuid not null references public.students(id) on delete cascade,
  type_id uuid not null references public.document_types(id) on delete cascade,
  received boolean not null default false,
  expires_on date,
  primary key (student_id, type_id),
  check (received or expires_on is null)
);

alter table public.students enable row level security;
alter table public.document_types enable row level security;
alter table public.documents enable row level security;
create policy "Staff access" on public.students for all to authenticated
  using (exists (select 1 from public.staff where user_id = (select auth.uid())))
  with check (exists (select 1 from public.staff where user_id = (select auth.uid())));
create policy "Staff access" on public.document_types for all to authenticated
  using (exists (select 1 from public.staff where user_id = (select auth.uid())))
  with check (exists (select 1 from public.staff where user_id = (select auth.uid())));
create policy "Staff access" on public.documents for all to authenticated
  using (exists (select 1 from public.staff where user_id = (select auth.uid())))
  with check (exists (select 1 from public.staff where user_id = (select auth.uid())));
revoke all on public.students, public.document_types, public.documents from anon;
grant select, insert, update on public.students, public.document_types, public.documents to authenticated;
revoke delete on public.students, public.document_types, public.documents from authenticated;
commit;
