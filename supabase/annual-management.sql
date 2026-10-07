-- Ejecutar una sola vez en SQL Editor sobre la base existente (setup.sql).
-- Conserva los alumnos y sus carnés. No ejecuta ningún pase de año.
begin;

alter table public.students add column if not exists is_active boolean not null default true;

-- Una baja libera el número de lista, sin borrar al estudiante ni su historial.
alter table public.students drop constraint if exists students_academic_year_group_name_list_number_key;
create unique index if not exists students_active_year_group_list_key
  on public.students (academic_year, group_name, list_number) where is_active;

create table if not exists public.student_group_history (
  student_id bigint not null references public.students(id),
  academic_year smallint not null,
  group_name text not null,
  group_code text,
  list_number smallint not null,
  primary key (student_id, academic_year)
);
alter table public.student_group_history enable row level security;
revoke all on public.student_group_history from anon;
grant select on public.student_group_history to authenticated;
drop policy if exists "Authenticated staff can read group history" on public.student_group_history;
create policy "Authenticated staff can read group history"
  on public.student_group_history for select to authenticated using (true);

insert into public.student_group_history (student_id, academic_year, group_name, group_code, list_number)
select id, academic_year, group_name, group_code, list_number from public.students
on conflict (student_id, academic_year) do nothing;

create or replace function public.record_student_group() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.student_group_history (student_id, academic_year, group_name, group_code, list_number)
  values (new.id, new.academic_year, new.group_name, new.group_code, new.list_number)
  on conflict (student_id, academic_year) do update set
    group_name = excluded.group_name,
    group_code = excluded.group_code,
    list_number = excluded.list_number;
  return new;
end;
$$;
drop trigger if exists record_student_group on public.students;
create trigger record_student_group after insert or update of academic_year, group_name, group_code, list_number
  on public.students for each row execute function public.record_student_group();

create or replace function public.advance_student_group(
  source_year smallint,
  source_group text,
  target_group text,
  target_code text default null,
  excluded_ids bigint[] default '{}'
) returns integer
language plpgsql security definer set search_path = '' as $$
declare moved integer;
begin
  if (select auth.uid()) is null then raise exception 'Inicia sesión para realizar el pase.'; end if;
  if source_year < 2000 or source_year >= 2100 or nullif(btrim(source_group), '') is null
    or nullif(btrim(target_group), '') is null or char_length(btrim(target_group)) > 80 then
    raise exception 'Año o grupo inválido.';
  end if;

  -- Evita que dos pases al mismo grupo asignen el mismo número de lista.
  perform pg_catalog.pg_advisory_xact_lock((source_year + 1)::integer, pg_catalog.hashtext(btrim(target_group)));
  with candidates as (
    select id, row_number() over (order by list_number, id)
      + coalesce((select max(list_number) from public.students
                  where academic_year = source_year + 1 and group_name = btrim(target_group) and is_active), 0) as next_number
    from public.students
    where academic_year = source_year and group_name = source_group and is_active
      and not (id = any(coalesce(excluded_ids, '{}'::bigint[])))
  ), changed as (
    update public.students s set
      academic_year = source_year + 1,
      group_name = btrim(target_group),
      group_code = nullif(btrim(target_code), ''),
      list_number = c.next_number
    from candidates c where s.id = c.id returning s.id
  )
  select count(*) into moved from changed;
  if moved = 0 then raise exception 'No hay estudiantes para avanzar.'; end if;
  return moved;
end;
$$;
revoke all on function public.advance_student_group(smallint, text, text, text, bigint[]) from public, anon;
grant execute on function public.advance_student_group(smallint, text, text, text, bigint[]) to authenticated;

commit;
