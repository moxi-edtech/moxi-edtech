begin;

-- Corrige a função de importação de alunos v4 para usar o campo 'sexo' em vez de 'genero'
-- que não existe na tabela staging_alunos.

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
          btrim(r.nome),
          btrim(r.nome),
          r.data_nascimento::date,
          nullif(btrim(r.bi_numero), ''),
          nullif(btrim(r.nif), ''),
          nullif(upper(btrim(r.sexo)), ''),
          nullif(btrim(r.telefone), ''),
          nullif(btrim(r.nome_encarregado), ''),
          nullif(btrim(r.telefone_encarregado), ''),
          lower(nullif(btrim(r.email_encarregado), '')),
          nullif(btrim(r.numero_processo), ''),
          'ativo',
          p_import_id
        )
        returning id into v_aluno_id;
      else
        update public.alunos a
        set
          telefone = coalesce(nullif(btrim(r.telefone), ''), a.telefone),
          encarregado_nome = coalesce(nullif(btrim(r.nome_encarregado), ''), a.encarregado_nome),
          encarregado_telefone = coalesce(nullif(btrim(r.telefone_encarregado), ''), a.encarregado_telefone),
          encarregado_email = coalesce(lower(nullif(btrim(r.email_encarregado), '')), a.encarregado_email),
          numero_processo_legado = coalesce(a.numero_processo_legado, nullif(btrim(r.numero_processo), '')),
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

commit;
