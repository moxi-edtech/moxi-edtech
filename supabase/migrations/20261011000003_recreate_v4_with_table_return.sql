begin;

-- ================================================================
-- RECRIAÇÃO RPC IMPORTAÇÃO V4 
-- Apaga a função existente e recria com o tipo de retorno TABLE(...).
-- ================================================================

-- Drop a função existente para permitir a alteração do tipo de retorno
DROP FUNCTION IF EXISTS public.importar_alunos_v4(uuid, uuid, text, date);

-- Recria a função com o tipo de retorno TABLE(...)
create or replace function public.importar_alunos_v4(
  p_import_id uuid,
  p_escola_id uuid,
  p_modo text default 'migracao',
  p_data_inicio_financeiro date default null
)
returns table (ok bool, imported int, turmas_created int, matriculas_pendentes int, errors int)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_curso_id uuid;
  v_imported int := 0;
  v_matriculas_pendentes int := 0;
  v_erros int := 0;
  v_turmas_created int := 0;
  v_code text;
  v_course_code text;
  v_class_num int;
  v_shift text;
  v_section text;
  v_ano_letivo int;
begin
  for r in
    select * from public.staging_alunos where import_id = p_import_id
  loop
    begin
      v_aluno_id := null;

      -- A) DEDUP (BI > Nome+Data)
      if nullif(btrim(r.bi_numero), '') is not null then
        select a.id into v_aluno_id
        from public.alunos a
        where a.escola_id = p_escola_id
          and a.bi_numero = btrim(r.bi_numero)
        limit 1;
      end if;

      if v_aluno_id is null
         and nullif(btrim(r.nome), '') is not null
         and r.data_nascimento is not null
      then
        select a.id into v_aluno_id
        from public.alunos a
        where a.escola_id = p_escola_id
          and lower(a.nome_completo) = lower(btrim(r.nome))
          and a.data_nascimento = r.data_nascimento::date
        limit 1;
      end if;

      -- B) UPSERT ALUNO
      if v_aluno_id is null then
        insert into public.alunos (
          escola_id, nome, nome_completo, data_nascimento,
          bi_numero, nif, sexo, telefone,
          encarregado_nome, encarregado_telefone, encarregado_email,
          numero_processo_legado,
          status, import_id
        ) values (
          p_escola_id,
          coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), '')),
          coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), '')),
          coalesce(r.data_nascimento::date, (r.raw_data->>'DATA_NASCIMENTO')::date),
          coalesce(nullif(btrim(r.bi_numero), ''), nullif(btrim(r.raw_data->>'BI_NUMERO'), '')),
          coalesce(nullif(btrim(r.nif), ''), nullif(btrim(r.raw_data->>'NIF'), '')),
          coalesce(nullif(upper(btrim(r.sexo)), ''), nullif(upper(btrim(r.raw_data->>'GENERO')), '')),
          coalesce(nullif(btrim(r.telefone), ''), nullif(btrim(r.raw_data->>'TELEFONE'), '')),
          coalesce(nullif(btrim(r.nome_encarregado), ''), nullif(btrim(r.raw_data->>'NOME_ENCARREGADO'), '')),
          coalesce(nullif(btrim(r.telefone_encarregado), ''), nullif(btrim(r.raw_data->>'TELEFONE_ENCARREGADO'), '')),
          lower(coalesce(nullif(btrim(r.email_encarregado), ''), nullif(btrim(r.raw_data->>'EMAIL_ENCARREGADO'), ''))),
          coalesce(nullif(btrim(r.numero_processo), ''), nullif(btrim(r.raw_data->>'NUMERO_PROCESSO'), '')),
          'ativo',
          p_import_id
        )
        returning id into v_aluno_id;
      else
        update public.alunos a
        set
          nome = coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), ''), a.nome),
          nome_completo = coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), ''), a.nome_completo),
          data_nascimento = coalesce(r.data_nascimento::date, (r.raw_data->>'DATA_NASCIMENTO')::date, a.data_nascimento),
          bi_numero = coalesce(nullif(btrim(r.bi_numero), ''), nullif(btrim(r.raw_data->>'BI_NUMERO'), ''), a.bi_numero),
          nif = coalesce(nullif(btrim(r.nif), ''), nullif(btrim(r.raw_data->>'NIF'), ''), a.nif),
          sexo = coalesce(nullif(upper(btrim(r.sexo)), ''), nullif(upper(btrim(r.raw_data->>'GENERO')), ''), a.sexo),
          telefone = coalesce(nullif(btrim(r.telefone), ''), nullif(btrim(r.raw_data->>'TELEFONE'), ''), a.telefone),
          encarregado_nome = coalesce(nullif(btrim(r.nome_encarregado), ''), nullif(btrim(r.raw_data->>'NOME_ENCARREGADO'), ''), a.encarregado_nome),
          encarregado_telefone = coalesce(nullif(btrim(r.telefone_encarregado), ''), nullif(btrim(r.raw_data->>'TELEFONE_ENCARREGADO'), ''), a.encarregado_telefone),
          encarregado_email = coalesce(lower(nullif(btrim(r.email_encarregado), '')), lower(nullif(btrim(r.raw_data->>'EMAIL_ENCARREGADO'), '')), a.encarregado_email),
          numero_processo_legado = coalesce(a.numero_processo_legado, nullif(btrim(r.numero_processo), ''), nullif(btrim(r.raw_data->>'NUMERO_PROCESSO'), '')),
          updated_at = now(),
          import_id = p_import_id
        where a.id = v_aluno_id;
      end if;

      v_imported := v_imported + 1;

      -- C) MATRÍCULA (apenas no modo migração)
      if p_modo = 'migracao' and nullif(btrim(r.turma_codigo), '') is not null then
        v_turma_id := null;
        v_curso_id := null;
        v_ano_letivo := coalesce(r.ano_letivo, extract(year from now())::int);

        v_code := upper(regexp_replace(trim(r.turma_codigo), '\s+', '', 'g'));
        if v_code ~ '^[A-Z0-9]{2,8}-\d{1,2}-(M|T|N)-[A-Z]{1,2}$' then
          v_course_code := split_part(v_code, '-', 1);
          v_class_num   := split_part(v_code, '-', 2)::int;
          v_shift       := split_part(v_code, '-', 3);
          v_section     := split_part(v_code, '-', 4);

          -- Find curso ID if it exists, but don't create it
          select c.id into v_curso_id from public.cursos c where c.escola_id = p_escola_id and c.course_code = v_course_code limit 1;

          -- UPSERT TURMA
          select t.id into v_turma_id from public.turmas t where t.escola_id = p_escola_id and t.ano_letivo = v_ano_letivo and t.turma_code = v_code limit 1;

          if v_turma_id is null then
            insert into public.turmas (escola_id, ano_letivo, turma_code, curso_id, classe_num, turno, letra, turma_codigo, nome, status_validacao, import_id)
            values (p_escola_id, v_ano_letivo, v_code, v_curso_id, v_class_num, v_shift, v_section, v_code, v_code || ' (Auto)', 'rascunho', p_import_id)
            on conflict (escola_id, ano_letivo, turma_code) do update set curso_id = excluded.curso_id
            returning id into v_turma_id;
            v_turmas_created := v_turmas_created + 1;
          end if;

          -- INSERT MATRICULA PENDENTE
          if v_turma_id is not null then
            insert into public.matriculas (
              escola_id, aluno_id, turma_id, ano_letivo,
              status, ativo, data_matricula,
              numero_matricula,
              data_inicio_financeiro,
              import_id
            ) values (
              p_escola_id, v_aluno_id, v_turma_id, v_ano_letivo,
              'pendente', false, current_date,
              null,
              p_data_inicio_financeiro,
              p_import_id
            )
            on conflict (escola_id, aluno_id, ano_letivo) do nothing;

            v_matriculas_pendentes := v_matriculas_pendentes + 1;
          end if;

        end if; -- fim do if v_code ~ ...
      end if; -- fim do if p_modo = 'migracao'

    exception when others then
      v_erros := v_erros + 1;
      insert into public.import_errors(import_id, message, raw_value)
      values (p_import_id, sqlerrm, coalesce(r.nome, ''));
    end;
  end loop;

  return query select true, v_imported, v_turmas_created, v_matriculas_pendentes, v_erros;
end;
$$;


-- ================================================================
-- 2) RPC aprovar_turmas - AJUSTADA (REINSTATE)
-- reaplica a mesma funcao para garantir consistencia
-- ================================================================
create or replace function public.aprovar_turmas(
  p_escola_id uuid,
  p_turma_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  is_admin bool;
  r record;

  v_turma_codigo text;
  v_curso_codigo text;
  v_curso_id uuid;
begin
  -- Segurança
  select public.is_escola_admin(p_escola_id, auth.uid()) into is_admin;
  if not is_admin then
    raise exception 'Apenas administradores podem aprovar turmas.';
  end if;

  -- Loop determinístico pelas turmas aprovadas
  for r in
    select
      t.id,
      t.escola_id,
      coalesce(t.turma_code, t.turma_codigo) as turma_codigo
    from public.turmas t
    where t.escola_id = p_escola_id
      and t.id = any(p_turma_ids)
    for update
  loop
    v_turma_codigo := r.turma_codigo;

    if v_turma_codigo is null or btrim(v_turma_codigo) = '' then
      raise exception 'Turma % sem codigo/turma_codigo. Não é possível inferir curso.', r.id;
    end if;

    -- Inferir curso_codigo do TURMA_CODIGO: CURSO-CLASSE-TURNO-LETRA
    v_curso_codigo := split_part(v_turma_codigo, '-', 1);

    if v_curso_codigo is null or btrim(v_curso_codigo) = '' then
      raise exception 'Turma % com código inválido (%).', r.id, v_turma_codigo;
    end if;

    -- 1) Upsert do curso (cria se não existe, senão aprova)
    insert into public.cursos (escola_id, course_code, nome, status_aprovacao, created_at, updated_at)
    values (p_escola_id, v_curso_codigo, 'Curso ' || v_curso_codigo, 'aprovado', now(), now())
    on conflict (escola_id, course_code)
    do update set
      status_aprovacao = 'aprovado',
      updated_at = now()
    returning id into v_curso_id;

    -- 2) Garantir que a turma aponta para o curso inferido
    update public.turmas
    set
      curso_id = v_curso_id,
      status_validacao = 'aprovado',
      updated_at = now()
    where id = r.id
      and escola_id = p_escola_id;

    -- 3) Ativar matrículas pendentes dessa turma
    update public.matriculas m
    set
      status = 'ativa',
      ativo = true,
      updated_at = now()
    where m.escola_id = p_escola_id
      and m.turma_id = r.id
      and m.status is distinct from 'ativa';
  end loop;
end;
$$;

commit;
