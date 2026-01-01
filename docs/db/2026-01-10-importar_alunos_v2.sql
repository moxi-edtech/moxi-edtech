-- =============================================================================
-- RPC: importar_alunos_v2 (novo modelo acadêmico)
-- Alinha importação de alunos com anos_letivos, curso_matriz, turma_disciplinas
-- Uso previsto: call importar_alunos_v2(p_escola_id, p_ano_letivo, p_import_id, p_alunos jsonb[])
-- Onde p_alunos é um array de objetos com chaves mínimas:
--   nome, bi, aluno_id (opcional), turma_id (opcional), turma_nome (opcional), curso_id (opcional), classe_id (opcional)
-- NOTA: ajuste conforme o payload real da sua automação de importação.
-- =============================================================================

create or replace function public.importar_alunos_v2(
  p_escola_id uuid,
  p_ano_letivo int,
  p_import_id uuid default null,
  p_alunos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_ano_id uuid;
  v_total int := 0;
  v_sucesso int := 0;
  v_erros int := 0;
  v_detail jsonb := '[]'::jsonb;
  rec jsonb;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_turma_nome text;
  v_curso_id uuid;
  v_classe_id uuid;
  v_bi text;
  v_nome text;
  v_err text;
begin
  if p_escola_id is null then
    raise exception 'p_escola_id é obrigatório';
  end if;
  if p_ano_letivo is null then
    raise exception 'p_ano_letivo é obrigatório';
  end if;

  -- Garante ano letivo
  insert into anos_letivos (escola_id, ano, data_inicio, data_fim, ativo)
  values (p_escola_id, p_ano_letivo, to_date(p_ano_letivo::text || '-01-01','YYYY-MM-DD'), to_date((p_ano_letivo+1)::text || '-12-31','YYYY-MM-DD'), true)
  on conflict (escola_id, ano) do update set ativo = true
  returning id into v_ano_id;

  -- Desativa outros anos da escola
  update anos_letivos set ativo = false where escola_id = p_escola_id and id <> v_ano_id;

  -- Loop alunos
  for rec in select * from jsonb_array_elements(p_alunos) loop
    v_total := v_total + 1;
    v_err := null;
    v_aluno_id := coalesce((rec->>'aluno_id')::uuid, gen_random_uuid());
    v_turma_id := (rec->>'turma_id')::uuid;
    v_turma_nome := nullif(rec->>'turma_nome','');
    v_curso_id := (rec->>'curso_id')::uuid;
    v_classe_id := (rec->>'classe_id')::uuid;
    v_bi := nullif(rec->>'bi','');
    v_nome := nullif(rec->>'nome','');

    begin
      if v_nome is null then
        raise exception 'Nome do aluno ausente';
      end if;

      -- Upsert aluno (minimal)
      insert into alunos(id, escola_id, nome, bi_numero, import_id)
      values (v_aluno_id, p_escola_id, v_nome, v_bi, p_import_id)
      on conflict (id) do update set nome = excluded.nome, bi_numero = excluded.bi_numero;

      -- Se turma não veio, tenta resolver por curso/classe/ano
      if v_turma_id is null then
        if v_curso_id is not null and v_classe_id is not null then
          select id into v_turma_id
          from turmas
          where escola_id = p_escola_id
            and curso_id = v_curso_id
            and classe_id = v_classe_id
            and ano_letivo = p_ano_letivo
          limit 1;
        end if;

        if v_turma_id is null and v_turma_nome is not null then
          select id into v_turma_id from turmas
          where escola_id = p_escola_id and nome = v_turma_nome and ano_letivo = p_ano_letivo
          limit 1;
        end if;
      end if;

      -- Se ainda não existe, cria turma mínima (curso/classe obrigatórios)
      if v_turma_id is null then
        if v_curso_id is null or v_classe_id is null then
          raise exception 'Sem turma e sem curso/classe para criar';
        end if;
        insert into turmas (escola_id, nome, curso_id, classe_id, turno, ano_letivo)
        values (p_escola_id, coalesce(v_turma_nome, 'Turma '||v_classe_id||' '||p_ano_letivo), v_curso_id, v_classe_id, 'M', p_ano_letivo)
        returning id into v_turma_id;
      end if;

      -- Matricula
      insert into matriculas (id, escola_id, aluno_id, turma_id, ano_letivo, ano_letivo_id, status, import_id)
      values (gen_random_uuid(), p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, v_ano_id, 'ativa', p_import_id)
      on conflict (aluno_id, turma_id) do nothing;

      v_sucesso := v_sucesso + 1;
      v_detail := v_detail || jsonb_build_array(jsonb_build_object('aluno', v_nome, 'status', 'ok'));
    exception when others then
      v_erros := v_erros + 1;
      v_detail := v_detail || jsonb_build_array(jsonb_build_object('aluno', v_nome, 'status', 'erro', 'msg', SQLERRM));
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'total', v_total,
    'sucesso', v_sucesso,
    'erros', v_erros,
    'detail', v_detail
  );
end;
$$;

comment on function public.importar_alunos_v2 is 'Importa alunos alinhando com anos_letivos, turmas e matriculas do modelo acadêmico novo';

