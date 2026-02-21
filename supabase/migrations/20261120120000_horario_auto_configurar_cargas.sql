-- KLASSE: Auto-configurar cargas horárias (horários)
create or replace function public.horario_auto_configurar_cargas(
  p_escola_id uuid,
  p_turma_id uuid,
  p_strategy text default 'preset_then_default',
  p_overwrite boolean default false
)
returns table(
  turma_disciplina_id uuid,
  disciplina_id uuid,
  disciplina_nome text,
  old_carga int,
  new_carga int,
  source text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_role text;
begin
  select current_setting('request.jwt.claims', true)::jsonb ->> 'role' into v_user_role;

  if v_user_role not in ('admin', 'super_admin', 'global_admin') and not public.is_escola_admin(p_escola_id) then
    raise exception 'Sem permissão para auto-configurar cargas.';
  end if;

  if not public.has_access_to_escola_fast(p_escola_id) then
    raise exception 'Escola não autorizada para o usuário.';
  end if;

  return query
  with alvo as (
    select
      td.id as turma_disciplina_id,
      td.carga_horaria_semanal as old_carga,
      td.entra_no_horario as td_entra,
      cm.disciplina_id,
      cm.carga_horaria_semanal as cm_carga,
      cm.entra_no_horario as cm_entra,
      dc.nome as disciplina_nome_value,
      dc.area as disciplina_area,
      dc.carga_horaria_semana as dc_carga
    from public.turma_disciplinas td
    join public.curso_matriz cm on cm.id = td.curso_matriz_id
    left join public.disciplinas_catalogo dc on dc.id = cm.disciplina_id
    where td.escola_id = p_escola_id
      and td.turma_id = p_turma_id
      and coalesce(td.entra_no_horario, cm.entra_no_horario, true) = true
      and (p_overwrite or coalesce(td.carga_horaria_semanal, 0) <= 0)
  ),
  calc as (
    select
      alvo.*,
      coalesce(
        nullif(cm_carga, 0),
        nullif(dc_carga, 0),
        case
          when lower(coalesce(disciplina_nome_value, '')) like '%portugues%'
            or lower(coalesce(disciplina_nome_value, '')) like '%língua%'
            or lower(coalesce(disciplina_nome_value, '')) like '%lingua%'
            then 4
          when lower(coalesce(disciplina_nome_value, '')) like '%matem%'
            then 4
          when lower(coalesce(disciplina_nome_value, '')) like '%fisic%'
            or lower(coalesce(disciplina_nome_value, '')) like '%quim%'
            or lower(coalesce(disciplina_nome_value, '')) like '%biolog%'
            then 3
          when lower(coalesce(disciplina_nome_value, '')) like '%hist%'
            or lower(coalesce(disciplina_nome_value, '')) like '%geograf%'
            or lower(coalesce(disciplina_nome_value, '')) like '%filos%'
            or lower(coalesce(disciplina_nome_value, '')) like '%sociol%'
            then 3
          when lower(coalesce(disciplina_nome_value, '')) like '%educa%'
            and lower(coalesce(disciplina_nome_value, '')) like '%fisic%'
            then 2
          when lower(coalesce(disciplina_nome_value, '')) like '%informat%'
            or lower(coalesce(disciplina_nome_value, '')) like '%tic%'
            or lower(coalesce(disciplina_nome_value, '')) like '%laborat%'
            then 2
          else 3
        end
      ) as new_carga,
      case
        when cm_carga is not null and cm_carga > 0 then 'curso_matriz'
        when dc_carga is not null and dc_carga > 0 then 'catalogo'
        when lower(coalesce(disciplina_nome_value, '')) like '%portugues%'
          or lower(coalesce(disciplina_nome_value, '')) like '%língua%'
          or lower(coalesce(disciplina_nome_value, '')) like '%lingua%'
          then 'default_linguagens'
        when lower(coalesce(disciplina_nome_value, '')) like '%matem%'
          then 'default_exatas'
        when lower(coalesce(disciplina_nome_value, '')) like '%fisic%'
          or lower(coalesce(disciplina_nome_value, '')) like '%quim%'
          or lower(coalesce(disciplina_nome_value, '')) like '%biolog%'
          then 'default_ciencias'
        when lower(coalesce(disciplina_nome_value, '')) like '%hist%'
          or lower(coalesce(disciplina_nome_value, '')) like '%geograf%'
          or lower(coalesce(disciplina_nome_value, '')) like '%filos%'
          or lower(coalesce(disciplina_nome_value, '')) like '%sociol%'
          then 'default_humanas'
        when lower(coalesce(disciplina_nome_value, '')) like '%educa%'
          and lower(coalesce(disciplina_nome_value, '')) like '%fisic%'
          then 'default_ed_fisica'
        when lower(coalesce(disciplina_nome_value, '')) like '%informat%'
          or lower(coalesce(disciplina_nome_value, '')) like '%tic%'
          or lower(coalesce(disciplina_nome_value, '')) like '%laborat%'
          then 'default_tic'
        else 'default'
      end as source
    from alvo
  ),
  updated as (
    update public.turma_disciplinas td
      set carga_horaria_semanal = calc.new_carga
    from calc
    where td.id = calc.turma_disciplina_id
      and calc.new_carga is not null
    returning td.id, calc.disciplina_id, calc.disciplina_nome_value as disciplina_nome, calc.old_carga, calc.new_carga, calc.source
  )
  select * from updated;
end;
$$;

grant execute on function public.horario_auto_configurar_cargas(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.horario_auto_configurar_cargas(uuid, uuid, text, boolean) to service_role;
