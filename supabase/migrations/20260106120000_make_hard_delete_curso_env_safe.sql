create or replace function public.hard_delete_curso(
  p_curso_id uuid,
  p_escola_id uuid
)
returns void
language plpgsql
as $$
declare
  v_turma_ids uuid[];
  v_classe_ids uuid[];
begin
  -- Coletar turmas do curso
  select coalesce(array_agg(t.id), '{}') into v_turma_ids
  from public.turmas t
  where t.escola_id = p_escola_id
    and t.curso_id = p_curso_id;

  -- Coletar classes do curso
  select coalesce(array_agg(c.id), '{}') into v_classe_ids
  from public.classes c
  where c.escola_id = p_escola_id
    and c.curso_id = p_curso_id;

  -- Segurança: se houver matrícula, aborta
  if array_length(v_turma_ids, 1) is not null then
    if exists (select 1 from public.matriculas m where m.turma_id = any(v_turma_ids)) then
      raise exception 'CURSO_HAS_MATRICULAS';
    end if;
  end if;

  -- =========================
  -- Dependências de TURMAS
  -- =========================
  if array_length(v_turma_ids, 1) is not null then
    if to_regclass('public.cursos_oferta_legacy') is not null then
      delete from public.cursos_oferta_legacy
      where escola_id = p_escola_id and turma_id = any(v_turma_ids);
    end if;

    if to_regclass('public.historico_anos') is not null then
      delete from public.historico_anos
      where escola_id = p_escola_id and turma_id = any(v_turma_ids);
    end if;

    if to_regclass('public.notas_legacy') is not null then
      delete from public.notas_legacy
      where escola_id = p_escola_id and turma_id = any(v_turma_ids);
    end if;

    if to_regclass('public.presencas') is not null then
      delete from public.presencas
      where escola_id = p_escola_id and turma_id = any(v_turma_ids);
    end if;

    if to_regclass('public.rotinas') is not null then
      delete from public.rotinas
      where escola_id = p_escola_id and turma_id = any(v_turma_ids);
    end if;

    if to_regclass('public.secoes') is not null then
      delete from public.secoes
      where escola_id = p_escola_id and turma_id = any(v_turma_ids);
    end if;

    if to_regclass('public.sistemas_notas') is not null then
      delete from public.sistemas_notas
      where escola_id = p_escola_id and turma_id = any(v_turma_ids);
    end if;

    if to_regclass('public.turma_disciplinas_professores') is not null then
      delete from public.turma_disciplinas_professores
      where escola_id = p_escola_id and turma_id = any(v_turma_ids);
    end if;

    if to_regclass('public.turma_disciplinas_legacy_patch_fix') is not null then
      delete from public.turma_disciplinas_legacy_patch_fix
      where escola_id = p_escola_id and turma_id = any(v_turma_ids);
    end if;

    if to_regclass('public.turma_disciplinas') is not null then
      delete from public.turma_disciplinas
      where escola_id = p_escola_id and turma_id = any(v_turma_ids);
    end if;

    if to_regclass('public.candidaturas') is not null then
      delete from public.candidaturas
      where escola_id = p_escola_id and turma_preferencial_id = any(v_turma_ids);
    end if;
  end if;

  delete from public.turmas
  where escola_id = p_escola_id and curso_id = p_curso_id;

  -- =========================
  -- Dependências de CLASSES
  -- =========================
  if array_length(v_classe_ids, 1) is not null then
    if to_regclass('public.curso_matriz') is not null then
      delete from public.curso_matriz
      where escola_id = p_escola_id and classe_id = any(v_classe_ids);
    end if;

    if to_regclass('public.disciplinas_legacy') is not null then
      delete from public.disciplinas_legacy
      where escola_id = p_escola_id and classe_id = any(v_classe_ids);
    end if;

    if to_regclass('public.financeiro_tabelas') is not null then
      delete from public.financeiro_tabelas
      where escola_id = p_escola_id and classe_id = any(v_classe_ids);
    end if;

    if to_regclass('public.tabelas_mensalidade') is not null then
      delete from public.tabelas_mensalidade
      where escola_id = p_escola_id and classe_id = any(v_classe_ids);
    end if;

    if to_regclass('public.candidaturas') is not null then
      delete from public.candidaturas
      where escola_id = p_escola_id and classe_id = any(v_classe_ids);
    end if;
  end if;

  delete from public.classes
  where escola_id = p_escola_id and curso_id = p_curso_id;

  -- =========================
  -- Escopo do CURSO
  -- =========================
  if to_regclass('public.disciplinas_legacy') is not null then
    delete from public.disciplinas_legacy
    where escola_id = p_escola_id and curso_escola_id = p_curso_id;
  end if;

  delete from public.configuracoes_curriculo
  where escola_id = p_escola_id and curso_id = p_curso_id;

  delete from public.cursos
  where escola_id = p_escola_id and id = p_curso_id;
end;
$$;