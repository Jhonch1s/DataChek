-- Ejecutar después de annual-management.sql. No modifica grados ni realiza pases.
begin;

create table public.school_groups (
  id bigint generated always as identity primary key,
  academic_year smallint not null check (academic_year between 2000 and 2100),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  unique (academic_year, name)
);

-- Incluye grupos actuales y los que ya figuran en el historial.
insert into public.school_groups (academic_year, name)
select academic_year, group_name from public.students
union
select academic_year, group_name from public.student_group_history
on conflict (academic_year, name) do nothing;

alter table public.school_groups enable row level security;
revoke all on public.school_groups from anon;
grant select, insert, update on public.school_groups to authenticated;
grant usage, select on sequence public.school_groups_id_seq to authenticated;
create policy "Authenticated staff can read groups"
  on public.school_groups for select to authenticated using (true);
create policy "Authenticated staff can add groups"
  on public.school_groups for insert to authenticated with check (true);
create policy "Authenticated staff can rename groups"
  on public.school_groups for update to authenticated using (true) with check (true);

-- Renombrar un grupo propaga el nombre a las fichas y al historial de ese año.
alter table public.students add constraint students_school_group_fk
  foreign key (academic_year, group_name)
  references public.school_groups (academic_year, name) on update cascade;
alter table public.student_group_history add constraint history_school_group_fk
  foreign key (academic_year, group_name)
  references public.school_groups (academic_year, name) on update cascade;

commit;
