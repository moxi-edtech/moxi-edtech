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
  -- 1) Coletar turmas do curso
  select coalesce(array_agg(t.id), '{}') into v_turma_ids
  from public.turmas t
  where t.escola_id = p_escola_id
    and t.curso_id = p_curso_id;

  -- 2) Coletar classes do curso
  select coalesce(array_agg(c.id), '{}') into v_classe_ids
  from public.classes c
  where c.escola_id = p_escola_id
    and c.curso_id = p_curso_id;

  -- 3) Segurança extra (em DB): se houver matrícula em alguma turma, aborta.
  if array_length(v_turma_ids, 1) is not null then
    if exists (
      select 1
      from public.matriculas m
      where m.turma_id = any(v_turma_ids)
    ) then
      raise exception 'CURSO_HAS_MATRICULAS';
    end if;
  end if;

  -- ==========================================================
  -- A) LIMPAR DEPENDÊNCIAS DAS TURMAS (antes de deletar turmas)
  -- ==========================================================
  if array_length(v_turma_ids, 1) is not null then
    delete from public.cursos_oferta_legacy col
      where col.escola_id = p_escola_id and col.turma_id = any(v_turma_ids);

    delete from public.historico_anos ha
      where ha.escola_id = p_escola_id and ha.turma_id = any(v_turma_ids);

    delete from public.notas_legacy nl
      where nl.escola_id = p_escola_id and nl.turma_id = any(v_turma_ids);

    delete from public.presencas pr
      where pr.escola_id = p_escola_id and pr.turma_id = any(v_turma_ids);

    delete from public.rotinas rt
      where rt.escola_id = p_escola_id and rt.turma_id = any(v_turma_ids);

    delete from public.secoes sc
      where sc.escola_id = p_escola_id and sc.turma_id = any(v_turma_ids);

    delete from public.sistemas_notas sn
      where sn.escola_id = p_escola_id and sn.turma_id = any(v_turma_ids);

    delete from public.turma_disciplinas_professores tdp
      where tdp.escola_id = p_escola_id and tdp.turma_id = any(v_turma_ids);

    delete from public.turma_disciplinas_legacy_patch_fix tdl
      where tdl.escola_id = p_escola_id and tdl.turma_id = any(v_turma_ids);

    delete from public.turma_disciplinas td
      where td.escola_id = p_escola_id and td.turma_id = any(v_turma_ids);

    -- candidaturas pode referenciar turma_preferencial_id
    delete from public.candidaturas ca
      where ca.escola_id = p_escola_id and ca.turma_preferencial_id = any(v_turma_ids);
  end if;

  -- Agora podemos deletar turmas do curso (já garantimos sem matrículas)
  delete from public.turmas t
  where t.escola_id = p_escola_id
    and t.curso_id = p_curso_id;

  -- ==========================================================
  -- B) LIMPAR DEPENDÊNCIAS DAS CLASSES (antes de deletar classes)
  -- ==========================================================
  if array_length(v_classe_ids, 1) is not null then
    delete from public.curso_matriz cm
      where cm.escola_id = p_escola_id and cm.classe_id = any(v_classe_ids);

    delete from public.disciplinas_legacy dl
      where dl.escola_id = p_escola_id and dl.classe_id = any(v_classe_ids);

    delete from public.financeiro_tabelas ft
      where ft.escola_id = p_escola_id and ft.classe_id = any(v_classe_ids);

    delete from public.tabelas_mensalidade tm
      where tm.escola_id = p_escola_id and tm.classe_id = any(v_classe_ids);

    delete from public.candidaturas ca
      where ca.escola_id = p_escola_id and ca.classe_id = any(v_classe_ids);
  end if;

  -- Deletar classes do curso
  delete from public.classes c
  where c.escola_id = p_escola_id
    and c.curso_id = p_curso_id;

  -- ==========================================================
  -- C) RESTO DO ESCopo DO CURSO
  -- ==========================================================
  delete from public.disciplinas_legacy d
  where d.escola_id = p_escola_id
    and d.curso_escola_id = p_curso_id;

  delete from public.configuracoes_curriculo cc
  where cc.escola_id = p_escola_id
    and cc.curso_id = p_curso_id;

  delete from public.cursos c
  where c.escola_id = p_escola_id
    and c.id = p_curso_id;

end;
$$;