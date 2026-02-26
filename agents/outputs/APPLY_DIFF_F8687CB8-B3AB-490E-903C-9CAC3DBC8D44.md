# Diff: adicionar pendências financeiras + ajustes de importação

```diff
*** Add File: supabase/migrations/20260225000000_importacao_pendencias_financeiro.sql
+CREATE TABLE IF NOT EXISTS public.import_financeiro_pendencias (
+  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
+  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
+  escola_id uuid NOT NULL,
+  import_id uuid NOT NULL REFERENCES public.import_migrations(id) ON DELETE CASCADE,
+  aluno_id uuid,
+  matricula_id uuid,
+  turma_id uuid,
+  motivo text NOT NULL,
+  mensagem text NOT NULL,
+  detalhes jsonb,
+  resolvido boolean DEFAULT false,
+  resolved_at timestamptz,
+  resolved_by uuid
+);
+
+CREATE INDEX IF NOT EXISTS import_financeiro_pendencias_import_id_idx
+  ON public.import_financeiro_pendencias (import_id);
+
+CREATE INDEX IF NOT EXISTS import_financeiro_pendencias_escola_id_idx
+  ON public.import_financeiro_pendencias (escola_id);
+
+CREATE INDEX IF NOT EXISTS import_financeiro_pendencias_matricula_id_idx
+  ON public.import_financeiro_pendencias (matricula_id);
+
+ALTER TABLE public.import_financeiro_pendencias ENABLE ROW LEVEL SECURITY;
+
+DROP POLICY IF EXISTS import_financeiro_pendencias_service_full ON public.import_financeiro_pendencias;
+CREATE POLICY import_financeiro_pendencias_service_full
+  ON public.import_financeiro_pendencias
+  FOR ALL
+  TO service_role
+  USING (true)
+  WITH CHECK (true);
+
+DROP POLICY IF EXISTS import_financeiro_pendencias_staff_read ON public.import_financeiro_pendencias;
+CREATE POLICY import_financeiro_pendencias_staff_read
+  ON public.import_financeiro_pendencias
+  FOR SELECT
+  TO authenticated
+  USING (
+    EXISTS (
+      SELECT 1
+      FROM public.import_migrations m
+      WHERE m.id = import_financeiro_pendencias.import_id
+        AND public.is_staff_escola(m.escola_id)
+    )
+  );
+
+DROP POLICY IF EXISTS import_financeiro_pendencias_staff_write ON public.import_financeiro_pendencias;
+CREATE POLICY import_financeiro_pendencias_staff_write
+  ON public.import_financeiro_pendencias
+  FOR INSERT
+  TO authenticated
+  WITH CHECK (
+    EXISTS (
+      SELECT 1
+      FROM public.import_migrations m
+      WHERE m.id = import_financeiro_pendencias.import_id
+        AND public.is_staff_escola(m.escola_id)
+    )
+  );
+
+GRANT ALL ON TABLE public.import_financeiro_pendencias TO anon, authenticated, service_role;
+
+CREATE OR REPLACE FUNCTION public.importar_alunos_v4(
+  p_import_id uuid,
+  p_escola_id uuid,
+  p_modo text DEFAULT 'migracao',
+  p_data_inicio_financeiro date DEFAULT NULL
+) RETURNS TABLE(
+  ok boolean,
+  imported integer,
+  turmas_created integer,
+  matriculas_pendentes integer,
+  errors integer
+)
+LANGUAGE plpgsql
+SECURITY DEFINER
+SET search_path TO 'public'
+AS $$
+declare
+  r record;
+  v_aluno_id uuid;
+  v_turma_id uuid;
+  v_turma_status text;
+  v_turma_curso_id uuid;
+  v_curso_id uuid;
+  v_imported int := 0;
+  v_matriculas_pendentes int := 0;
+  v_erros int := 0;
+  v_turmas_created int := 0;
+  v_code text;
+  v_course_code text;
+  v_class_num int;
+  v_shift text;
+  v_section text;
+  v_ano_letivo int;
+  v_rowcount int;
+  v_curriculo_publicado boolean := false;
+  v_matricula_status text := 'pendente';
+  v_matricula_ativo boolean := false;
+begin
+  for r in
+    select
+      sa.*,
+      sa.encarregado_nome as nome_encarregado,
+      sa.encarregado_telefone as telefone_encarregado,
+      sa.encarregado_email as email_encarregado
+    from public.staging_alunos sa
+    where sa.import_id = p_import_id
+  loop
+    begin
+      v_aluno_id := null;
+
+      -- A) DEDUP (BI > Nome+Data)
+      if nullif(btrim(r.bi_numero), '') is not null then
+        select a.id into v_aluno_id
+        from public.alunos a
+        where a.escola_id = p_escola_id
+          and a.bi_numero = btrim(r.bi_numero)
+        limit 1;
+      end if;
+
+      if v_aluno_id is null
+         and nullif(btrim(r.nome), '') is not null
+         and r.data_nascimento is not null
+      then
+        select a.id into v_aluno_id
+        from public.alunos a
+        where a.escola_id = p_escola_id
+          and lower(a.nome_completo) = lower(btrim(r.nome))
+          and a.data_nascimento = r.data_nascimento::date
+        limit 1;
+      end if;
+
+      -- B) UPSERT ALUNO
+      if v_aluno_id is null then
+        insert into public.alunos (
+          escola_id, nome, nome_completo, data_nascimento,
+          bi_numero, nif, sexo, telefone,
+          encarregado_nome, encarregado_telefone, encarregado_email,
+          numero_processo_legado,
+          status, import_id
+        ) values (
+          p_escola_id,
+          coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), '')),
+          coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), '')),
+          coalesce(r.data_nascimento::date, (r.raw_data->>'DATA_NASCIMENTO')::date),
+          coalesce(nullif(btrim(r.bi_numero), ''), nullif(btrim(r.raw_data->>'BI_NUMERO'), '')),
+          coalesce(nullif(btrim(r.nif), ''), nullif(btrim(r.raw_data->>'NIF'), '')),
+          coalesce(nullif(upper(btrim(r.sexo)), ''), nullif(upper(btrim(r.raw_data->>'GENERO')), '')),
+          coalesce(nullif(btrim(r.telefone), ''), nullif(btrim(r.raw_data->>'TELEFONE'), '')),
+          coalesce(nullif(btrim(r.nome_encarregado), ''), nullif(btrim(r.raw_data->>'NOME_ENCARREGADO'), '')),
+          coalesce(nullif(btrim(r.telefone_encarregado), ''), nullif(btrim(r.raw_data->>'TELEFONE_ENCARREGADO'), '')),
+          lower(coalesce(nullif(btrim(r.email_encarregado), ''), nullif(btrim(r.raw_data->>'EMAIL_ENCARREGADO'), ''))),
+          coalesce(nullif(btrim(r.numero_processo), ''), nullif(btrim(r.raw_data->>'NUMERO_PROCESSO'), '')),
+          'ativo',
+          p_import_id
+        )
+        returning id into v_aluno_id;
+      else
+        update public.alunos a
+        set
+          nome = coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), ''), a.nome),
+          nome_completo = coalesce(nullif(btrim(r.nome), ''), nullif(btrim(r.raw_data->>'NOME_COMPLETO'), ''), a.nome_completo),
+          data_nascimento = coalesce(r.data_nascimento::date, (r.raw_data->>'DATA_NASCIMENTO')::date, a.data_nascimento),
+          bi_numero = coalesce(nullif(btrim(r.bi_numero), ''), nullif(btrim(r.raw_data->>'BI_NUMERO'), ''), a.bi_numero),
+          nif = coalesce(nullif(btrim(r.nif), ''), nullif(btrim(r.raw_data->>'NIF'), ''), a.nif),
+          sexo = coalesce(nullif(upper(btrim(r.sexo)), ''), nullif(upper(btrim(r.raw_data->>'GENERO')), ''), a.sexo),
+          telefone = coalesce(nullif(btrim(r.telefone), ''), nullif(btrim(r.raw_data->>'TELEFONE'), ''), a.telefone),
+          encarregado_nome = coalesce(nullif(btrim(r.nome_encarregado), ''), nullif(btrim(r.raw_data->>'NOME_ENCARREGADO'), ''), a.encarregado_nome),
+          encarregado_telefone = coalesce(nullif(btrim(r.telefone_encarregado), ''), nullif(btrim(r.raw_data->>'TELEFONE_ENCARREGADO'), ''), a.encarregado_telefone),
+          encarregado_email = coalesce(lower(nullif(btrim(r.email_encarregado), '')), lower(nullif(btrim(r.raw_data->>'EMAIL_ENCARREGADO'), '')), a.encarregado_email),
+          numero_processo_legado = coalesce(a.numero_processo_legado, nullif(btrim(r.numero_processo), ''), nullif(btrim(r.raw_data->>'NUMERO_PROCESSO'), '')),
+          updated_at = now(),
+          import_id = p_import_id
+        where a.id = v_aluno_id;
+      end if;
+
+      v_imported := v_imported + 1;
+
+      -- C) MATRÍCULA (apenas no modo migração)
+      if p_modo = 'migracao' and nullif(btrim(r.turma_codigo), '') is not null then
+        v_turma_id := null;
+        v_turma_status := null;
+        v_turma_curso_id := null;
+        v_curso_id := null;
+        v_ano_letivo := coalesce(r.ano_letivo, extract(year from now())::int);
+
+        v_code := upper(regexp_replace(trim(r.turma_codigo), '\s+', '', 'g'));
+        if v_code ~ '^[A-Z0-9]{2,8}-\d{1,2}-(M|T|N)-[A-Z]{1,2}$' then
+          v_course_code := split_part(v_code, '-', 1);
+          v_class_num   := split_part(v_code, '-', 2)::int;
+          v_shift       := split_part(v_code, '-', 3);
+          v_section     := split_part(v_code, '-', 4);
+
+          -- Find curso ID if it exists, but don't create it
+          select c.id into v_curso_id
+          from public.cursos c
+          where c.escola_id = p_escola_id
+            and c.course_code = v_course_code
+          limit 1;
+
+          -- ✅ SSOT: procurar por turma_codigo (não turma_code)
+          select t.id, t.status_validacao, t.curso_id
+          into v_turma_id, v_turma_status, v_turma_curso_id
+          from public.turmas t
+          where t.escola_id = p_escola_id
+            and t.ano_letivo = v_ano_letivo
+            and t.turma_codigo = v_code
+          limit 1;
+
+          if v_curso_id is null then
+            v_curso_id := v_turma_curso_id;
+          end if;
+
+          v_curriculo_publicado := false;
+          if v_curso_id is not null then
+            select exists (
+              select 1
+              from public.curso_curriculos cc
+              join public.anos_letivos al on al.id = cc.ano_letivo_id
+              where cc.escola_id = p_escola_id
+                and cc.curso_id = v_curso_id
+                and al.ano = v_ano_letivo
+                and cc.status = 'published'
+            ) into v_curriculo_publicado;
+          end if;
+
+          if v_turma_id is null then
+            insert into public.turmas (
+              escola_id, ano_letivo, turma_code, curso_id, classe_num, turno, letra,
+              turma_codigo, nome, status_validacao, import_id
+            )
+            values (
+              p_escola_id, v_ano_letivo, v_code, v_curso_id, v_class_num, v_shift, v_section,
+              v_code, v_code || ' (Auto)',
+              case when v_curriculo_publicado then 'ativo' else 'rascunho' end,
+              p_import_id
+            )
+            -- ✅ SSOT: conflitar por turma_codigo (full unique)
+            on conflict (escola_id, ano_letivo, turma_codigo)
+            do update set curso_id = excluded.curso_id
+            returning id, status_validacao into v_turma_id, v_turma_status;
+
+            v_turmas_created := v_turmas_created + 1;
+          end if;
+
+          -- INSERT MATRICULA COM AUTO-CONFIRMAÇÃO QUANDO TURMA ATIVA + CURRÍCULO PUBLICADO
+          if v_turma_id is not null then
+            v_matricula_status := 'pendente';
+            v_matricula_ativo := false;
+            if v_turma_status = 'ativo' and v_curriculo_publicado then
+              v_matricula_status := 'ativo';
+              v_matricula_ativo := true;
+            end if;
+
+            insert into public.matriculas (
+              escola_id, aluno_id, turma_id, ano_letivo,
+              status, ativo, data_matricula,
+              numero_matricula,
+              data_inicio_financeiro,
+              import_id
+            ) values (
+              p_escola_id, v_aluno_id, v_turma_id, v_ano_letivo,
+              v_matricula_status, v_matricula_ativo, current_date,
+              null,
+              p_data_inicio_financeiro,
+              p_import_id
+            )
+            on conflict (escola_id, aluno_id, ano_letivo) do nothing;
+
+            get diagnostics v_rowcount = row_count;
+            if v_rowcount > 0 and v_matricula_status = 'pendente' then
+              v_matriculas_pendentes := v_matriculas_pendentes + 1;
+            end if;
+          end if;
+        end if;
+      end if;
+
+    exception when others then
+      v_erros := v_erros + 1;
+      insert into public.import_errors(import_id, message, raw_value)
+      values (p_import_id, sqlerrm, coalesce(r.nome, ''));
+    end;
+  end loop;
+
+  return query select true, v_imported, v_turmas_created, v_matriculas_pendentes, v_erros;
+end;
+$$;
```
