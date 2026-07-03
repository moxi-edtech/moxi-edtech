CREATE OR REPLACE FUNCTION public.importar_alunos_v4(
  p_import_id uuid,
  p_escola_id uuid,
  p_modo text DEFAULT 'migracao',
  p_data_inicio_financeiro date DEFAULT NULL
) RETURNS TABLE(
  ok boolean,
  imported integer,
  turmas_created integer,
  matriculas_pendentes integer,
  errors integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  r record;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_turma_status text;
  v_turma_curso_id uuid;
  v_turma_classe_id uuid;
  v_curso_id uuid;
  v_classe_id uuid;
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
  v_rowcount int;
  v_curriculo_publicado boolean := false;
  v_matricula_status text := 'pendente';
  v_matricula_ativo boolean := false;
  v_existing_turmas_count int := 0;
  v_existing_classes_count int := 0;
begin
  for r in
    select
      sa.*,
      sa.encarregado_nome as nome_encarregado,
      sa.encarregado_telefone as telefone_encarregado,
      sa.encarregado_email as email_encarregado
    from public.staging_alunos sa
    where sa.import_id = p_import_id
  loop
    begin
      v_aluno_id := null;

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

      if p_modo = 'migracao' and (
        nullif(btrim(r.turma_codigo), '') is not null
        or r.classe_numero is not null
        or nullif(btrim(r.turno_codigo), '') is not null
        or nullif(btrim(r.turma_letra), '') is not null
      ) then
        v_turma_id := null;
        v_turma_status := null;
        v_turma_curso_id := null;
        v_turma_classe_id := null;
        v_curso_id := null;
        v_classe_id := null;
        v_existing_turmas_count := 0;
        v_existing_classes_count := 0;
        v_ano_letivo := coalesce(r.ano_letivo, extract(year from now())::int);

        v_code := nullif(upper(regexp_replace(trim(coalesce(r.turma_codigo, '')), '\s+', '', 'g')), '');
        v_course_code := nullif(upper(regexp_replace(coalesce(r.curso_codigo, ''), '[^A-Za-z0-9]', '', 'g')), '');
        v_class_num := r.classe_numero;
        v_shift := case
          when upper(coalesce(r.turno_codigo, '')) in ('M', 'MANHA', 'MANHÃ', 'MATUTINO') then 'M'
          when upper(coalesce(r.turno_codigo, '')) in ('T', 'TARDE', 'VESPERTINO') then 'T'
          when upper(coalesce(r.turno_codigo, '')) in ('N', 'NOITE', 'NOTURNO') then 'N'
          when left(upper(coalesce(r.turno_codigo, '')), 1) in ('M', 'T', 'N') then left(upper(coalesce(r.turno_codigo, '')), 1)
          else null
        end;
        v_section := nullif(upper(regexp_replace(coalesce(r.turma_letra, ''), '[^A-Za-z0-9]', '', 'g')), '');

        if v_code is not null and v_code ~ '^[A-Z0-9]{2,8}-\d{1,2}-(M|T|N)-[A-Z0-9]{1,3}$' then
          v_course_code := coalesce(v_course_code, split_part(v_code, '-', 1));
          v_class_num := coalesce(v_class_num, split_part(v_code, '-', 2)::int);
          v_shift := coalesce(v_shift, split_part(v_code, '-', 3));
          v_section := coalesce(v_section, split_part(v_code, '-', 4));
        elsif v_course_code is not null and v_class_num is not null and v_shift is not null and v_section is not null then
          v_code := format('%s-%s-%s-%s', v_course_code, v_class_num, v_shift, v_section);
        else
          v_code := null;
        end if;

        if v_code is null and v_class_num is not null and v_shift is not null and v_section is not null then
          select
            count(*),
            max(t.id),
            max(t.status_validacao),
            max(t.curso_id),
            max(t.classe_id),
            max(t.turma_codigo)
          into
            v_existing_turmas_count,
            v_turma_id,
            v_turma_status,
            v_turma_curso_id,
            v_turma_classe_id,
            v_code
          from public.turmas t
          where t.escola_id = p_escola_id
            and t.ano_letivo = v_ano_letivo
            and t.classe_num = v_class_num
            and upper(coalesce(t.turno, '')) = v_shift
            and upper(coalesce(t.letra, '')) = v_section;

          if v_existing_turmas_count > 1 then
            raise exception 'Turma ambígua para %ª classe % turno turma % no ano %. Informe CURSO_CODIGO ou TURMA_CODIGO.',
              v_class_num, v_shift, v_section, v_ano_letivo;
          end if;

          if v_existing_turmas_count = 1 then
            v_curso_id := v_turma_curso_id;
            v_classe_id := v_turma_classe_id;
          end if;
        end if;

        if v_code is null and v_course_code is null and v_class_num is not null then
          select
            count(*),
            max(cl.id),
            max(cl.curso_id),
            max(coalesce(nullif(c.course_code, ''), nullif(c.codigo, '')))
          into
            v_existing_classes_count,
            v_classe_id,
            v_curso_id,
            v_course_code
          from public.classes cl
          join public.cursos c on c.id = cl.curso_id
          where cl.escola_id = p_escola_id
            and cl.numero = v_class_num;

          if v_existing_classes_count > 1 then
            raise exception 'Classe % encontrada em múltiplos cursos. Informe CURSO_CODIGO ou TURMA_CODIGO para concluir a importação.', v_class_num;
          end if;

          if v_existing_classes_count = 1 and v_shift is not null and v_section is not null and v_course_code is not null then
            v_course_code := upper(regexp_replace(v_course_code, '[^A-Za-z0-9]', '', 'g'));
            v_code := format('%s-%s-%s-%s', v_course_code, v_class_num, v_shift, v_section);
          end if;
        end if;

        if v_code is null then
          raise exception 'Dados de turma insuficientes para %s. Informe TURMA_CODIGO ou mapeie CURSO_CODIGO + CLASSE_NUMERO + TURNO_CODIGO + TURMA_LETRA.',
            coalesce(r.nome, 'aluno sem nome');
        end if;

        if v_course_code is null then
          v_course_code := split_part(v_code, '-', 1);
        end if;
        if v_class_num is null then
          v_class_num := split_part(v_code, '-', 2)::int;
        end if;
        if v_shift is null then
          v_shift := split_part(v_code, '-', 3);
        end if;
        if v_section is null then
          v_section := split_part(v_code, '-', 4);
        end if;

        if v_curso_id is null then
          select c.id into v_curso_id
          from public.cursos c
          where c.escola_id = p_escola_id
            and upper(regexp_replace(coalesce(nullif(c.course_code, ''), nullif(c.codigo, '')), '[^A-Za-z0-9]', '', 'g')) = v_course_code
          limit 1;
        end if;

        select t.id, t.status_validacao, t.curso_id, t.classe_id
        into v_turma_id, v_turma_status, v_turma_curso_id, v_turma_classe_id
        from public.turmas t
        where t.escola_id = p_escola_id
          and t.ano_letivo = v_ano_letivo
          and t.turma_codigo = v_code
        limit 1;

        if v_turma_id is not null and v_turma_curso_id is not null then
          v_curso_id := v_turma_curso_id;
        end if;

        if v_turma_id is not null and v_turma_classe_id is not null then
          v_classe_id := v_turma_classe_id;
        end if;

        if v_curso_id is null then
          raise exception 'Curso não encontrado para sigla % na turma %.', v_course_code, v_code;
        end if;

        if v_classe_id is null then
          select cl.id into v_classe_id
          from public.classes cl
          where cl.escola_id = p_escola_id
            and cl.curso_id = v_curso_id
            and cl.numero = v_class_num
          limit 1;
        end if;

        if v_classe_id is null then
          raise exception 'Classe % não encontrada para o curso % na turma %.', v_class_num, v_course_code, v_code;
        end if;

        v_curriculo_publicado := false;
        if v_curso_id is not null then
          select exists (
            select 1
            from public.curso_curriculos cc
            join public.anos_letivos al on al.id = cc.ano_letivo_id
            where cc.escola_id = p_escola_id
              and cc.curso_id = v_curso_id
              and al.ano = v_ano_letivo
              and cc.status = 'published'
          ) into v_curriculo_publicado;
        end if;

        if v_turma_id is null then
          insert into public.turmas (
            escola_id, ano_letivo, turma_code, curso_id, classe_id, classe_num, turno, letra,
            turma_codigo, nome, status_validacao, import_id
          )
          values (
            p_escola_id, v_ano_letivo, v_code, v_curso_id, v_classe_id, v_class_num, v_shift, v_section,
            v_code, v_code || ' (Auto)',
            case when v_curriculo_publicado then 'ativo' else 'rascunho' end,
            p_import_id
          )
          on conflict (escola_id, ano_letivo, turma_codigo)
          do update set
            curso_id = excluded.curso_id,
            classe_id = coalesce(public.turmas.classe_id, excluded.classe_id),
            classe_num = excluded.classe_num,
            turno = excluded.turno,
            letra = excluded.letra
          returning id, status_validacao into v_turma_id, v_turma_status;

          v_turmas_created := v_turmas_created + 1;
        end if;

        if v_turma_id is not null then
          v_matricula_status := 'pendente';
          v_matricula_ativo := false;
          if v_turma_status = 'ativo' and v_curriculo_publicado then
            v_matricula_status := 'ativo';
            v_matricula_ativo := true;
          end if;

          insert into public.matriculas (
            escola_id, aluno_id, turma_id, ano_letivo,
            status, ativo, data_matricula,
            numero_matricula,
            data_inicio_financeiro,
            import_id
          ) values (
            p_escola_id, v_aluno_id, v_turma_id, v_ano_letivo,
            v_matricula_status, v_matricula_ativo, current_date,
            null,
            p_data_inicio_financeiro,
            p_import_id
          )
          on conflict (escola_id, aluno_id, ano_letivo) do nothing;

          get diagnostics v_rowcount = row_count;
          if v_rowcount > 0 and v_matricula_status = 'pendente' then
            v_matriculas_pendentes := v_matriculas_pendentes + 1;
          end if;
        end if;
      end if;

    exception when others then
      v_erros := v_erros + 1;
      insert into public.import_errors(import_id, message, raw_value)
      values (p_import_id, sqlerrm, coalesce(r.nome, ''));
    end;
  end loop;

  return query select true, v_imported, v_turmas_created, v_matriculas_pendentes, v_erros;
end;
$$;
