-- KLASSE: split curriculum status into horario + avaliacao
alter table public.curso_matriz
  add column if not exists status_horario text default 'incompleto',
  add column if not exists status_avaliacao text default 'incompleto';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'curso_matriz_status_horario_check'
  ) then
    alter table public.curso_matriz
      add constraint curso_matriz_status_horario_check
      check (status_horario is null or status_horario in ('completo','incompleto'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'curso_matriz_status_avaliacao_check'
  ) then
    alter table public.curso_matriz
      add constraint curso_matriz_status_avaliacao_check
      check (status_avaliacao is null or status_avaliacao in ('completo','incompleto'));
  end if;
end $$;

create or replace function public.curriculum_recalc_status(
  p_escola_id uuid,
  p_curso_matriz_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_role text;
begin
  select current_setting('request.jwt.claims', true)::jsonb ->> 'role' into v_user_role;

  if v_user_role not in ('service_role','admin','super_admin','global_admin')
     and not public.is_escola_admin(p_escola_id) then
    raise exception 'Sem permissão para recalcular currículo.';
  end if;

  if not public.has_access_to_escola_fast(p_escola_id) then
    raise exception 'Escola não autorizada para o usuário.';
  end if;

  update public.curso_matriz
  set
    status_horario = case
      when coalesce(entra_no_horario, false) = true and coalesce(carga_horaria_semanal, 0) > 0
        then 'completo'
      else 'incompleto'
    end,
    status_avaliacao = case
      when avaliacao_mode = 'inherit_school'
        or (avaliacao_mode = 'custom' and avaliacao_modelo_id is not null)
        or (avaliacao_mode = 'inherit_disciplina' and avaliacao_disciplina_id is not null)
        then 'completo'
      else 'incompleto'
    end,
    status_completude = case
      when coalesce(entra_no_horario, false) = true
        and coalesce(carga_horaria_semanal, 0) > 0
        and classificacao is not null
        and periodos_ativos is not null
        and array_length(periodos_ativos, 1) > 0
        and (
          avaliacao_mode = 'inherit_school'
          or (avaliacao_mode = 'custom' and avaliacao_modelo_id is not null)
          or (avaliacao_mode = 'inherit_disciplina' and avaliacao_disciplina_id is not null)
        )
        then 'completo'
      else 'incompleto'
    end
  where escola_id = p_escola_id
    and (p_curso_matriz_id is null or id = p_curso_matriz_id);
end;
$$;

grant execute on function public.curriculum_recalc_status(uuid, uuid) to authenticated;
grant execute on function public.curriculum_recalc_status(uuid, uuid) to service_role;

create or replace function public.trg_curriculum_recalc_status()
returns trigger
language plpgsql
as $$
begin
  new.status_horario := case
    when coalesce(new.entra_no_horario, false) = true and coalesce(new.carga_horaria_semanal, 0) > 0
      then 'completo'
    else 'incompleto'
  end;

  new.status_avaliacao := case
    when new.avaliacao_mode = 'inherit_school'
      or (new.avaliacao_mode = 'custom' and new.avaliacao_modelo_id is not null)
      or (new.avaliacao_mode = 'inherit_disciplina' and new.avaliacao_disciplina_id is not null)
      then 'completo'
    else 'incompleto'
  end;

  new.status_completude := case
    when coalesce(new.entra_no_horario, false) = true
      and coalesce(new.carga_horaria_semanal, 0) > 0
      and new.classificacao is not null
      and new.periodos_ativos is not null
      and array_length(new.periodos_ativos, 1) > 0
      and (
        new.avaliacao_mode = 'inherit_school'
        or (new.avaliacao_mode = 'custom' and new.avaliacao_modelo_id is not null)
        or (new.avaliacao_mode = 'inherit_disciplina' and new.avaliacao_disciplina_id is not null)
      )
      then 'completo'
    else 'incompleto'
  end;

  return new;
end;
$$;

drop trigger if exists trg_curriculum_recalc_status on public.curso_matriz;
create trigger trg_curriculum_recalc_status
before insert or update of
  carga_horaria_semanal,
  entra_no_horario,
  avaliacao_mode,
  avaliacao_modelo_id,
  avaliacao_disciplina_id,
  classificacao,
  periodos_ativos
on public.curso_matriz
for each row
execute function public.trg_curriculum_recalc_status();

update public.curso_matriz
set
  status_horario = case
    when coalesce(entra_no_horario, false) = true and coalesce(carga_horaria_semanal, 0) > 0
      then 'completo'
    else 'incompleto'
  end,
  status_avaliacao = case
    when avaliacao_mode = 'inherit_school'
      or (avaliacao_mode = 'custom' and avaliacao_modelo_id is not null)
      or (avaliacao_mode = 'inherit_disciplina' and avaliacao_disciplina_id is not null)
      then 'completo'
    else 'incompleto'
  end,
  status_completude = case
    when coalesce(entra_no_horario, false) = true
      and coalesce(carga_horaria_semanal, 0) > 0
      and classificacao is not null
      and periodos_ativos is not null
      and array_length(periodos_ativos, 1) > 0
      and (
        avaliacao_mode = 'inherit_school'
        or (avaliacao_mode = 'custom' and avaliacao_modelo_id is not null)
        or (avaliacao_mode = 'inherit_disciplina' and avaliacao_disciplina_id is not null)
      )
      then 'completo'
    else 'incompleto'
  end;
