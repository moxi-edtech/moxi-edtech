diff --git a/supabase/migrations/20270629120000_onboarding_implantation_checklist_foundation.sql b/supabase/migrations/20270629120000_onboarding_implantation_checklist_foundation.sql
new file mode 100644
index 00000000..c086f752
--- /dev/null
+++ b/supabase/migrations/20270629120000_onboarding_implantation_checklist_foundation.sql
@@ -0,0 +1,446 @@
+BEGIN;
+
+ALTER TABLE public.onboarding_requests
+  ADD COLUMN IF NOT EXISTS implantation_status varchar(50) NOT NULL DEFAULT 'implantacao_em_andamento'
+    CHECK (implantation_status IN ('implantacao_em_andamento', 'aguardando_aceite', 'aceite_validado')),
+  ADD COLUMN IF NOT EXISTS implantation_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
+  ADD COLUMN IF NOT EXISTS implantation_checklist_updated_at timestamptz NOT NULL DEFAULT now();
+
+CREATE OR REPLACE FUNCTION public.default_onboarding_implantation_checklist()
+RETURNS jsonb
+LANGUAGE sql
+STABLE
+SET search_path = public, pg_catalog, pg_temp
+AS $$
+  SELECT jsonb_build_array(
+    jsonb_build_object('code', 'curriculo_configurado', 'label', 'Currículo configurado', 'completed', false, 'note', null, 'completed_at', null),
+    jsonb_build_object('code', 'turmas_criadas', 'label', 'Turmas criadas', 'completed', false, 'note', null, 'completed_at', null),
+    jsonb_build_object('code', 'disciplinas_configuradas', 'label', 'Disciplinas e pautas configuradas', 'completed', false, 'note', null, 'completed_at', null),
+    jsonb_build_object('code', 'alunos_importados', 'label', 'Alunos importados', 'completed', false, 'note', null, 'completed_at', null),
+    jsonb_build_object('code', 'encarregados_importados', 'label', 'Encarregados importados', 'completed', false, 'note', null, 'completed_at', null),
+    jsonb_build_object('code', 'formacao_secretaria_concluida', 'label', 'Formação da secretaria concluída', 'completed', false, 'note', null, 'completed_at', null),
+    jsonb_build_object('code', 'formacao_docentes_concluida', 'label', 'Formação dos docentes concluída', 'completed', false, 'note', null, 'completed_at', null),
+    jsonb_build_object('code', 'sistema_em_operacao', 'label', 'Sistema em operação', 'completed', false, 'note', null, 'completed_at', null)
+  );
+$$;
+
+UPDATE public.onboarding_requests
+SET
+  implantation_checklist = public.default_onboarding_implantation_checklist(),
+  implantation_checklist_updated_at = now()
+WHERE coalesce(jsonb_array_length(implantation_checklist), 0) = 0;
+
+CREATE OR REPLACE FUNCTION public.update_influencer_onboarding_implantation_checklist(
+  p_session_id uuid,
+  p_codigo text,
+  p_tracking_token text,
+  p_items jsonb
+)
+RETURNS jsonb
+LANGUAGE plpgsql
+SECURITY DEFINER
+SET search_path = public, pg_catalog, pg_temp
+AS $$
+DECLARE
+  v_session jsonb;
+  v_codigo_upper text := upper(trim(coalesce(p_codigo, '')));
+  v_member_id uuid;
+  v_member_name text;
+  v_request public.onboarding_requests%ROWTYPE;
+  v_normalized jsonb;
+  v_completed_count integer;
+  v_total_count integer;
+  v_next_status text;
+BEGIN
+  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
+  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
+    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
+  END IF;
+
+  v_member_id := (v_session->'session'->>'member_id')::uuid;
+  v_member_name := coalesce(v_session->'session'->>'member_name', 'Parceiro');
+
+  SELECT *
+    INTO v_request
+  FROM public.onboarding_requests r
+  WHERE r.tracking_token = p_tracking_token
+    AND upper(coalesce(r.financeiro->>'influencer_codigo', '')) = v_codigo_upper
+  FOR UPDATE;
+
+  IF NOT FOUND THEN
+    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_not_found');
+  END IF;
+
+  WITH defaults AS (
+    SELECT *
+    FROM (
+      VALUES
+        (1, 'curriculo_configurado', 'Currículo configurado'),
+        (2, 'turmas_criadas', 'Turmas criadas'),
+        (3, 'disciplinas_configuradas', 'Disciplinas e pautas configuradas'),
+        (4, 'alunos_importados', 'Alunos importados'),
+        (5, 'encarregados_importados', 'Encarregados importados'),
+        (6, 'formacao_secretaria_concluida', 'Formação da secretaria concluída'),
+        (7, 'formacao_docentes_concluida', 'Formação dos docentes concluída'),
+        (8, 'sistema_em_operacao', 'Sistema em operação')
+    ) AS t(sort_order, code, label)
+  ),
+  provided AS (
+    SELECT
+      code,
+      coalesce(completed, false) AS completed,
+      nullif(btrim(note), '') AS note,
+      completed_at
+    FROM jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
+      AS x(code text, completed boolean, note text, completed_at timestamptz)
+  )
+  SELECT jsonb_agg(
+    jsonb_build_object(
+      'code', d.code,
+      'label', d.label,
+      'completed', coalesce(p.completed, false),
+      'note', p.note,
+      'completed_at', CASE
+        WHEN coalesce(p.completed, false)
+          THEN coalesce(p.completed_at, now())
+        ELSE null
+      END
+    )
+    ORDER BY d.sort_order
+  )
+  INTO v_normalized
+  FROM defaults d
+  LEFT JOIN provided p
+    ON p.code = d.code;
+
+  SELECT
+    count(*) FILTER (WHERE coalesce((item->>'completed')::boolean, false)),
+    count(*)
+  INTO v_completed_count, v_total_count
+  FROM jsonb_array_elements(v_normalized) item;
+
+  v_next_status := CASE
+    WHEN v_completed_count = v_total_count
+      AND v_total_count > 0
+      AND v_request.implantation_status = 'aceite_validado'
+      THEN 'aceite_validado'
+    WHEN v_completed_count = v_total_count AND v_total_count > 0 THEN 'aguardando_aceite'
+    ELSE 'implantacao_em_andamento'
+  END;
+
+  UPDATE public.onboarding_requests
+  SET
+    implantation_checklist = v_normalized,
+    implantation_status = v_next_status,
+    implantation_checklist_updated_at = now()
+  WHERE id = v_request.id;
+
+  INSERT INTO public.audit_logs (
+    escola_id,
+    portal,
+    acao,
+    tabela,
+    registro_id,
+    entity,
+    entity_id,
+    details
+  )
+  VALUES (
+    v_request.escola_id,
+    'influencer_portal',
+    'ONBOARDING_IMPLANTATION_CHECKLIST_UPDATED',
+    'onboarding_requests',
+    v_request.id::text,
+    'onboarding_requests',
+    v_request.id::text,
+    jsonb_build_object(
+      'member_id', v_member_id,
+      'member_name', v_member_name,
+      'influencer_codigo', v_codigo_upper,
+      'implantation_status', v_next_status,
+      'completed_count', v_completed_count,
+      'total_count', v_total_count
+    )
+  );
+
+  RETURN jsonb_build_object(
+    'ok', true,
+    'implantation_status', v_next_status,
+    'completed_count', v_completed_count,
+    'total_count', v_total_count,
+    'checklist', v_normalized
+  );
+END;
+$$;
+
+GRANT EXECUTE ON FUNCTION public.default_onboarding_implantation_checklist() TO anon, authenticated;
+GRANT EXECUTE ON FUNCTION public.update_influencer_onboarding_implantation_checklist(uuid, text, text, jsonb) TO anon, authenticated;
+
+CREATE OR REPLACE FUNCTION public.get_influencer_member_portal_by_session(
+  p_session_id uuid,
+  p_codigo text
+)
+RETURNS jsonb
+LANGUAGE plpgsql
+SECURITY DEFINER
+SET search_path = public, pg_catalog, pg_temp
+AS $$
+DECLARE
+  v_session jsonb;
+BEGIN
+  v_session := public.get_influencer_portal_session(p_session_id, p_codigo);
+
+  IF coalesce((v_session->>'ok')::boolean, false) = false THEN
+    RETURN jsonb_build_object('ok', false, 'error', 'session_not_found');
+  END IF;
+
+  RETURN (
+    WITH session_row AS (
+      SELECT
+        (v_session->'session'->>'codigo')::text AS codigo,
+        (v_session->'session'->>'member_id')::uuid AS member_id,
+        (v_session->'session'->>'member_name')::text AS member_name
+    ),
+    affiliate_context AS (
+      SELECT
+        a.codigo,
+        coalesce(a.nome, a.codigo) AS nome,
+        a.materiais_json,
+        sr.member_id,
+        sr.member_name
+      FROM session_row sr
+      JOIN public.afiliados a
+        ON a.codigo = sr.codigo
+       AND a.ativo = true
+      JOIN public.afiliado_membros m
+        ON m.id = sr.member_id
+       AND m.afiliado_id = a.id
+       AND m.ativo = true
+    ),
+    dias AS (
+      SELECT generate_series(
+        CURRENT_DATE - INTERVAL '6 days',
+        CURRENT_DATE,
+        INTERVAL '1 day'
+      )::date AS dia
+    ),
+    counts AS (
+      SELECT
+        ml.created_at::date AS dia,
+        count(*) AS total
+      FROM public.marketing_leads ml
+      JOIN affiliate_context ac
+        ON upper(ml.afiliado_codigo) = ac.codigo
+      WHERE ml.created_at >= CURRENT_DATE - INTERVAL '6 days'
+      GROUP BY 1
+    ),
+    trend AS (
+      SELECT coalesce(
+        jsonb_agg(
+          jsonb_build_object(
+            'dia', to_char(d.dia, 'DD/MM'),
+            'total', coalesce(c.total, 0)
+          )
+          ORDER BY d.dia ASC
+        ),
+        '[]'::jsonb
+      ) AS data
+      FROM dias d
+      LEFT JOIN counts c ON d.dia = c.dia
+    ),
+    onboarding AS (
+      SELECT jsonb_build_object(
+        'total', count(*),
+        'pendentes', count(*) FILTER (WHERE obr.status = 'pendente'),
+        'em_configuracao', count(*) FILTER (WHERE obr.status = 'em_configuracao'),
+        'fechadas', count(*) FILTER (WHERE obr.status = 'activo'),
+        'escolas', coalesce((
+          SELECT jsonb_agg(
+            jsonb_build_object(
+              'data', recent.created_at,
+              'status', recent.status,
+              'escola', recent.escola_nome,
+              'plano', recent.financeiro->>'plano_interesse',
+              'plano_label', recent.financeiro->>'plano_interesse_label',
+              'total_alunos', recent.financeiro->>'total_alunos',
+              'token', recent.tracking_token,
+              'faixa_propina', recent.faixa_propina,
+              'implantation_status', recent.implantation_status,
+              'implantation_checklist', coalesce(recent.implantation_checklist, public.default_onboarding_implantation_checklist()),
+              'implantation_progress', jsonb_build_object(
+                'completed', (
+                  SELECT count(*)
+                  FROM jsonb_array_elements(coalesce(recent.implantation_checklist, public.default_onboarding_implantation_checklist())) item
+                  WHERE coalesce((item->>'completed')::boolean, false)
+                ),
+                'total', jsonb_array_length(coalesce(recent.implantation_checklist, public.default_onboarding_implantation_checklist()))
+              ),
+              'steps', coalesce((
+                SELECT jsonb_agg(
+                  jsonb_build_object(
+                    'code', s.step_code,
+                    'title', s.title,
+                    'status', s.status,
+                    'owner', s.owner_type,
+                    'deadline', s.deadline_at,
+                    'completed_at', s.completed_at
+                  )
+                  ORDER BY public.onboarding_step_sort_order(s.step_code), s.created_at ASC
+                )
+                FROM public.onboarding_steps s
+                WHERE s.onboarding_id = recent.id
+              ), '[]'::jsonb),
+              'calls', coalesce((
+                SELECT jsonb_agg(
+                  jsonb_build_object(
+                    'id', log.id,
+                    'realizado_em', log.created_at,
+                    'member_name', coalesce(log.details->>'member_name', ''),
+                    'step_title', coalesce(log.details->>'step_title', ''),
+                    'notes', coalesce(log.details->>'notes', '')
+                  )
+                  ORDER BY log.created_at DESC
+                )
+                FROM public.audit_logs log
+                WHERE log.acao = 'PARTNER_CALL_FOLLOWUP'
+                  AND log.entity = 'onboarding_requests'
+                  AND log.entity_id = recent.id::text
+              ), '[]'::jsonb),
+              'uploads', coalesce((
+                SELECT jsonb_agg(
+                  jsonb_build_object(
+                    'id', u.id,
+                    'step_code', u.step_code,
+                    'file_path', u.file_path,
+                    'status', u.status,
+                    'rejection_reason', u.rejection_reason,
+                    'created_by', u.created_by,
+                    'created_at', u.created_at
+                  )
+                  ORDER BY u.created_at DESC
+                )
+                FROM public.onboarding_uploads u
+                WHERE u.onboarding_id = recent.id
+              ), '[]'::jsonb),
+              'escola_tel', recent.escola_tel,
+              'escola_email', recent.escola_email,
+              'director_nome', recent.director_nome,
+              'director_tel', recent.director_tel,
+              'escola_morada', recent.escola_morada,
+              'escola_municipio', recent.escola_municipio,
+              'escola_provincia', recent.escola_provincia,
+              'escola_nif', recent.escola_nif
+            )
+            ORDER BY recent.created_at DESC
+          )
+          FROM (
+            SELECT
+              id,
+              created_at,
+              status,
+              escola_nome,
+              financeiro,
+              tracking_token,
+              faixa_propina,
+              implantation_status,
+              implantation_checklist,
+              escola_tel,
+              escola_email,
+              director_nome,
+              director_tel,
+              escola_morada,
+              escola_municipio,
+              escola_provincia,
+              escola_nif
+            FROM public.onboarding_requests
+            WHERE upper(coalesce(financeiro->>'influencer_codigo', '')) = (SELECT codigo FROM affiliate_context LIMIT 1)
+            ORDER BY created_at DESC
+            LIMIT 50
+          ) recent
+        ), '[]'::jsonb)
+      ) AS data
+      FROM public.onboarding_requests obr
+      WHERE upper(coalesce(obr.financeiro->>'influencer_codigo', '')) = (SELECT codigo FROM affiliate_context LIMIT 1)
+    ),
+    leads AS (
+      SELECT coalesce((
+        SELECT jsonb_agg(
+          jsonb_build_object(
+            'data', recent.created_at,
+            'status', recent.status,
+            'score', recent.score,
+            'escola_hint',
+              CASE
+                WHEN length(recent.escola) > 5 THEN left(recent.escola, 3) || '***' || right(recent.escola, 2)
+                ELSE left(recent.escola, 1) || '***'
+              END
+          )
+          ORDER BY recent.created_at DESC
+        )
+        FROM (
+          SELECT created_at, status, score, escola
+          FROM public.marketing_leads
+          WHERE upper(afiliado_codigo) = (SELECT codigo FROM affiliate_context LIMIT 1)
+          ORDER BY created_at DESC
+          LIMIT 50
+        ) recent
+      ), '[]'::jsonb) AS data
+    ),
+    stats AS (
+      SELECT jsonb_build_object(
+        'total_diagnosticos', count(*),
+        'novos', count(*) FILTER (WHERE ml.status = 'NOVO'),
+        'em_contacto', count(*) FILTER (WHERE ml.status = 'EM_CONTACTO'),
+        'convertidos', count(*) FILTER (WHERE ml.status = 'CONVERTIDO'),
+        'trend', (SELECT data FROM trend),
+        'onboarding', coalesce((SELECT data FROM onboarding), jsonb_build_object(
+          'total', 0,
+          'pendentes', 0,
+          'em_configuracao', 0,
+          'fechadas', 0,
+          'escolas', '[]'::jsonb
+        )),
+        'leads', (SELECT data FROM leads)
+      ) AS data
+      FROM public.marketing_leads ml
+      WHERE upper(ml.afiliado_codigo) = (SELECT codigo FROM affiliate_context LIMIT 1)
+    )
+    SELECT coalesce(
+      (
+        SELECT jsonb_build_object(
+          'ok', true,
+          'codigo', ac.codigo,
+          'nome', ac.nome,
+          'member', jsonb_build_object(
+            'id', ac.member_id,
+            'name', ac.member_name
+          ),
+          'materiais', coalesce(ac.materiais_json, '[]'::jsonb),
+          'stats', coalesce((SELECT data FROM stats), jsonb_build_object(
+            'total_diagnosticos', 0,
+            'novos', 0,
+            'em_contacto', 0,
+            'convertidos', 0,
+            'trend', '[]'::jsonb,
+            'onboarding', jsonb_build_object(
+              'total', 0,
+              'pendentes', 0,
+              'em_configuracao', 0,
+              'fechadas', 0,
+              'escolas', '[]'::jsonb
+            ),
+            'leads', '[]'::jsonb
+          ))
+        )
+        FROM affiliate_context ac
+        LIMIT 1
+      ),
+      jsonb_build_object('ok', false, 'error', 'session_not_found')
+    )
+  );
+END;
+$$;
+
+GRANT EXECUTE ON FUNCTION public.get_influencer_member_portal_by_session(uuid, text) TO anon, authenticated;
+
+COMMIT;
diff --git a/supabase/migrations/20270629123000_onboarding_acceptance_term_gate.sql b/supabase/migrations/20270629123000_onboarding_acceptance_term_gate.sql
new file mode 100644
index 00000000..4f5af2e2
--- /dev/null
+++ b/supabase/migrations/20270629123000_onboarding_acceptance_term_gate.sql
@@ -0,0 +1,200 @@
+BEGIN;
+
+ALTER TABLE public.onboarding_requests
+  ADD COLUMN IF NOT EXISTS acceptance_term_file_path text,
+  ADD COLUMN IF NOT EXISTS acceptance_signed_by text,
+  ADD COLUMN IF NOT EXISTS acceptance_signed_role text,
+  ADD COLUMN IF NOT EXISTS acceptance_signed_at timestamptz,
+  ADD COLUMN IF NOT EXISTS acceptance_validated_at timestamptz,
+  ADD COLUMN IF NOT EXISTS acceptance_validated_by uuid,
+  ADD COLUMN IF NOT EXISTS acceptance_notes text;
+
+COMMENT ON COLUMN public.onboarding_requests.acceptance_term_file_path IS
+  'Caminho do Termo de Aceite assinado no bucket de onboarding.';
+COMMENT ON COLUMN public.onboarding_requests.acceptance_signed_by IS
+  'Nome do diretor/signatário que assinou o Termo de Aceite.';
+COMMENT ON COLUMN public.onboarding_requests.acceptance_signed_role IS
+  'Cargo do signatário do Termo de Aceite.';
+COMMENT ON COLUMN public.onboarding_requests.acceptance_signed_at IS
+  'Data de assinatura declarada no Termo de Aceite.';
+COMMENT ON COLUMN public.onboarding_requests.acceptance_validated_at IS
+  'Data em que a KLASSE validou o Termo de Aceite.';
+COMMENT ON COLUMN public.onboarding_requests.acceptance_validated_by IS
+  'Utilizador KLASSE que validou o Termo de Aceite.';
+COMMENT ON COLUMN public.onboarding_requests.acceptance_notes IS
+  'Notas internas da validação do Termo de Aceite.';
+
+CREATE OR REPLACE FUNCTION public.onboarding_implantation_checklist_complete(
+  p_items jsonb
+)
+RETURNS boolean
+LANGUAGE sql
+IMMUTABLE
+SET search_path = public, pg_catalog, pg_temp
+AS $$
+  SELECT
+    coalesce(jsonb_array_length(p_items), 0) > 0
+    AND NOT EXISTS (
+      SELECT 1
+      FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) item
+      WHERE coalesce((item->>'completed')::boolean, false) = false
+    );
+$$;
+
+CREATE OR REPLACE FUNCTION public.validate_onboarding_implantation_acceptance(
+  p_request_id uuid,
+  p_acceptance_term_file_path text,
+  p_acceptance_signed_by text,
+  p_acceptance_signed_at timestamptz,
+  p_actor_id uuid DEFAULT NULL,
+  p_acceptance_signed_role text DEFAULT NULL,
+  p_acceptance_notes text DEFAULT NULL
+)
+RETURNS jsonb
+LANGUAGE plpgsql
+SECURITY DEFINER
+SET search_path = public, pg_catalog, pg_temp
+AS $$
+DECLARE
+  v_request public.onboarding_requests%ROWTYPE;
+  v_file_path text := nullif(btrim(coalesce(p_acceptance_term_file_path, '')), '');
+  v_signed_by text := nullif(btrim(coalesce(p_acceptance_signed_by, '')), '');
+  v_signed_role text := nullif(btrim(coalesce(p_acceptance_signed_role, '')), '');
+  v_notes text := nullif(btrim(coalesce(p_acceptance_notes, '')), '');
+BEGIN
+  IF current_user NOT IN ('postgres', 'service_role')
+     AND coalesce(public.check_super_admin_role(), false) = false THEN
+    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
+  END IF;
+
+  SELECT *
+    INTO v_request
+  FROM public.onboarding_requests
+  WHERE id = p_request_id
+  FOR UPDATE;
+
+  IF NOT FOUND THEN
+    RETURN jsonb_build_object('ok', false, 'error', 'onboarding_not_found');
+  END IF;
+
+  IF public.onboarding_implantation_checklist_complete(v_request.implantation_checklist) = false THEN
+    RETURN jsonb_build_object('ok', false, 'error', 'checklist_incomplete');
+  END IF;
+
+  IF v_file_path IS NULL THEN
+    RETURN jsonb_build_object('ok', false, 'error', 'acceptance_term_required');
+  END IF;
+
+  IF v_signed_by IS NULL THEN
+    RETURN jsonb_build_object('ok', false, 'error', 'signed_by_required');
+  END IF;
+
+  IF p_acceptance_signed_at IS NULL THEN
+    RETURN jsonb_build_object('ok', false, 'error', 'signed_at_required');
+  END IF;
+
+  UPDATE public.onboarding_requests
+  SET
+    implantation_status = 'aceite_validado',
+    acceptance_term_file_path = v_file_path,
+    acceptance_signed_by = v_signed_by,
+    acceptance_signed_role = v_signed_role,
+    acceptance_signed_at = p_acceptance_signed_at,
+    acceptance_validated_at = now(),
+    acceptance_validated_by = p_actor_id,
+    acceptance_notes = v_notes
+  WHERE id = v_request.id
+  RETURNING * INTO v_request;
+
+  UPDATE public.partner_commissions
+  SET
+    metadata = metadata || jsonb_build_object(
+      'acceptance_validated_at', v_request.acceptance_validated_at,
+      'acceptance_term_file_path', v_file_path
+    )
+  WHERE onboarding_request_id = v_request.id
+    AND tipo = 'ativacao';
+
+  INSERT INTO public.audit_logs (
+    escola_id,
+    portal,
+    acao,
+    tabela,
+    registro_id,
+    entity,
+    entity_id,
+    details
+  )
+  VALUES (
+    v_request.escola_id,
+    'super_admin',
+    'ONBOARDING_ACCEPTANCE_VALIDATED',
+    'onboarding_requests',
+    v_request.id::text,
+    'onboarding_requests',
+    v_request.id::text,
+    jsonb_build_object(
+      'actor_id', p_actor_id,
+      'acceptance_term_file_path', v_file_path,
+      'acceptance_signed_by', v_signed_by,
+      'acceptance_signed_role', v_signed_role,
+      'acceptance_signed_at', p_acceptance_signed_at
+    )
+  );
+
+  RETURN jsonb_build_object(
+    'ok', true,
+    'onboarding_request_id', v_request.id,
+    'implantation_status', v_request.implantation_status,
+    'acceptance_validated_at', v_request.acceptance_validated_at
+  );
+END;
+$$;
+
+CREATE OR REPLACE FUNCTION public.enforce_activation_commission_acceptance_gate()
+RETURNS trigger
+LANGUAGE plpgsql
+SECURITY DEFINER
+SET search_path = public, pg_catalog, pg_temp
+AS $$
+DECLARE
+  v_acceptance_ok boolean := false;
+BEGIN
+  IF NEW.tipo <> 'ativacao' THEN
+    RETURN NEW;
+  END IF;
+
+  IF NEW.status NOT IN ('approved', 'paid') THEN
+    RETURN NEW;
+  END IF;
+
+  SELECT
+    r.implantation_status = 'aceite_validado'
+    AND r.acceptance_term_file_path IS NOT NULL
+    AND r.acceptance_signed_by IS NOT NULL
+    AND r.acceptance_signed_at IS NOT NULL
+    AND public.onboarding_implantation_checklist_complete(r.implantation_checklist)
+  INTO v_acceptance_ok
+  FROM public.onboarding_requests r
+  WHERE r.id = NEW.onboarding_request_id;
+
+  IF coalesce(v_acceptance_ok, false) = false THEN
+    RAISE EXCEPTION 'Comissão de ativação bloqueada: Termo de Aceite validado é obrigatório.'
+      USING ERRCODE = '23514';
+  END IF;
+
+  RETURN NEW;
+END;
+$$;
+
+DROP TRIGGER IF EXISTS trg_activation_commission_acceptance_gate ON public.partner_commissions;
+CREATE TRIGGER trg_activation_commission_acceptance_gate
+  BEFORE INSERT OR UPDATE OF status, onboarding_request_id, tipo
+  ON public.partner_commissions
+  FOR EACH ROW
+  EXECUTE FUNCTION public.enforce_activation_commission_acceptance_gate();
+
+GRANT EXECUTE ON FUNCTION public.onboarding_implantation_checklist_complete(jsonb) TO authenticated, service_role;
+GRANT EXECUTE ON FUNCTION public.validate_onboarding_implantation_acceptance(uuid, text, text, timestamptz, uuid, text, text) TO authenticated, service_role;
+
+COMMIT;
diff --git a/docs/pop/crm/CRM_ROADMAP_BACKLOG_SPRINTS.md b/docs/pop/crm/CRM_ROADMAP_BACKLOG_SPRINTS.md
new file mode 100644
index 00000000..7d4aea8a
--- /dev/null
+++ b/docs/pop/crm/CRM_ROADMAP_BACKLOG_SPRINTS.md
@@ -0,0 +1,417 @@
+# CRM KLASSE - Roadmap, Checklist e Backlog por Sprint
+
+Versao: 1.1.0
+Data: 2026-06-29
+Atualizado em: 2026-06-29
+Escopo: CRM comercial, onboarding, implantacao, capacitacao, suporte L1, comissoes e equipe do parceiro operacional
+
+## 1. Objetivo
+
+Transformar o CRM do parceiro em uma central operacional completa, cobrindo o fluxo:
+
+`prospeccao -> demonstracao -> fechamento -> onboarding -> setup -> capacitacao -> go-live -> suporte L1 -> comissoes/payout`
+
+O CRM deve permitir que os operadores trabalhem com inicio, meio e fim, mantendo evidencias, SLAs, responsabilidades e comissoes rastreaveis.
+
+## 2. Checklist Macro
+
+### Comercial
+
+- [x] Cadastro de leads.
+- [x] Etapas do funil comercial.
+- [ ] Agenda de demonstracoes.
+- [x] Historico de contactos.
+- [ ] Proposta comercial.
+- [ ] Aceite comercial.
+- [x] Proxima acao comercial com data.
+- [x] Painel de pendencias comerciais vencidas.
+
+### Onboarding
+
+- [x] Conversao do lead para escola em ativacao.
+- [ ] Checklist de implantacao.
+- [x] Uploads/documentos.
+- [ ] Setup de dados.
+- [x] Status por fase.
+- [ ] Termo de aceite assinado.
+
+### Operacao
+
+- [ ] Formacao da secretaria.
+- [ ] Formacao dos docentes.
+- [ ] Evidencias de treinamento.
+- [ ] Ativacao/go-live.
+
+### Suporte L1
+
+- [ ] Abertura de chamados.
+- [ ] Gravidade.
+- [ ] SLA.
+- [ ] Escalonamento L2/L3 para KLASSE.
+- [ ] Relatorio de performance.
+
+### Financeiro e Comissoes
+
+- [x] Comissao de ativacao.
+- [x] Comissao recorrente.
+- [ ] Bloqueio por inadimplencia.
+- [ ] Penalidade por SLA.
+- [ ] Solicitacao de payout.
+- [ ] Upload de fatura/recibo.
+- [x] Status de repasse.
+
+### Gestao Interna
+
+- [x] Operadores do parceiro.
+- [x] Papeis/permissoes.
+- [x] Reset de PIN.
+- [ ] Produtividade por operador.
+
+## 3. Roadmap por Sprint
+
+## Sprint 1 - Fundacao do CRM Operacional
+
+### Meta
+
+Garantir que o parceiro consegue gerir equipe, leads e tarefas sem depender do Super Admin para a rotina diaria.
+
+### Backlog
+
+- [x] Criar gestao de operadores no portal do parceiro.
+- [x] Criar papeis: `admin`, `vendas`, `implantacao`, `suporte_l1`.
+- [x] Adicionar criar/desativar/resetar PIN.
+- [x] Melhorar agenda de follow-up dos leads.
+- [x] Criar tarefas por operador.
+- [x] Criar painel `Minhas pendencias`.
+
+### Entrega
+
+- [x] Parceiro administra a propria equipe.
+- [x] Cada lead/tarefa tem responsavel.
+- [x] Historico comercial fica rastreavel.
+
+### Criterios de Aceite
+
+- [x] Admin do parceiro cria operador.
+- [ ] Operador entra com PIN.
+- [x] Lead pode ter proxima acao com data e responsavel.
+- [x] Dashboard mostra tarefas vencidas.
+
+### Implementado em 2026-06-29
+
+- UI do portal do parceiro: aba `Equipe` em `/influencers/[codigo]`.
+- API: `/api/influencers/[codigo]/team` com `GET`, `POST` e `PATCH`.
+- Banco remoto: migration `20270629100000_partner_portal_team_management.sql` aplicada.
+- Papeis ativos no banco: `owner`, `admin`, `vendas`, `implantacao`, `suporte_l1`, `operator`.
+- Painel de pendencias comerciais: card `Proximas acoes comerciais` na aba CRM.
+- Responsavel por lead/follow-up: migration `20270629103000_crm_lead_responsavel_membro.sql` aplicada.
+- UI do CRM permite escolher responsavel no cadastro do lead e no registro de contato.
+
+### Pendencias restantes da Sprint 1
+
+- Validar login real de um operador recem-criado em ambiente remoto.
+- Criar metrica de produtividade por operador.
+
+## Sprint 2 - Proposta, Fechamento e Conversao
+
+### Meta
+
+Fechar o ciclo comercial antes do onboarding.
+
+### Backlog
+
+- [x] Criar bloco de proposta comercial no lead.
+- [x] Campos: plano, alunos, trial, taxa de ativacao, mensalidade.
+- [ ] Gerar proposta/preview.
+- [x] Registrar aceite comercial.
+- [x] Upload de proposta ou contrato preliminar.
+- [x] Status: `proposta_enviada`, `aceite_comercial`, `aguardando_contrato_klasse`.
+- [x] Melhorar botao `Iniciar ativacao` com validacoes.
+
+### Entrega
+
+- Lead so vira onboarding com dados comerciais minimos.
+- KLASSE consegue ver o que foi negociado.
+
+### Criterios de Aceite
+
+- [x] Nao converter lead sem plano, trial e taxa de ativacao.
+- [x] Trial maximo de 30 dias.
+- [x] Taxa de ativacao registrada no onboarding.
+- [x] Historico mostra quem converteu.
+
+### Implementado em 2026-06-29
+
+- Drawer do lead comercial no portal do parceiro com bloco `Proposta Comercial`.
+- Campos ativos no lead: `plano_estimado`, `alunos_estimados`, `trial_days`, `taxa_ativacao`, `mensalidade_kz`.
+- Status comercial ativos no banco e na UI: `rascunho`, `proposta_enviada`, `aceite_comercial`, `aguardando_contrato_klasse`.
+- Upload de proposta/contrato preliminar via endpoint `/api/influencers/[codigo]/crm/leads/[leadId]/proposal`.
+- Edicao dos termos comerciais via endpoint `/api/influencers/[codigo]/crm/leads/[leadId]/commercial`.
+- Conversao para onboarding agora bloqueia sem etapa `ganho`, sem `trial_days` valido, sem `taxa_ativacao > 0` e sem status comercial pronto para conversao.
+- Dados comerciais enviados para o onboarding incluem `trial_days`, `taxa_ativacao`, `mensalidade_kz`, `commercial_status` e `proposal_file_name`.
+
+### Pendencias restantes da Sprint 2
+
+- Gerar proposta/preview automatico a partir dos termos comerciais.
+- Definir se o aceite comercial exigira campo explicito de aprovador/canal ou se o status manual e suficiente.
+- Decidir se o documento comercial deve migrar para bucket dedicado em vez de ficar no bucket `onboarding`.
+
+## Sprint 3 - Checklist de Implantacao e Termo de Aceite
+
+### Meta
+
+Provar a entrega que libera os 100% da taxa de ativacao.
+
+### Backlog
+
+- [x] Criar checklist de implantacao por escola.
+- [x] Incluir item: curriculo configurado.
+- [x] Incluir item: turmas criadas.
+- [x] Incluir item: disciplinas/pautas configuradas.
+- [x] Incluir item: alunos importados.
+- [x] Incluir item: encarregados importados.
+- [x] Incluir item: formacao secretaria concluida.
+- [x] Incluir item: formacao docentes concluida.
+- [x] Incluir item: sistema em operacao.
+- [x] Upload do Termo de Aceite.
+- [x] Campo de assinatura/data/nome do diretor.
+- [x] Status: `implantacao_em_andamento`, `aguardando_aceite`, `aceite_validado`.
+- [x] Bloquear comissao de ativacao ate aceite validado.
+
+### Entrega
+
+- Implantacao passa a ter inicio, meio e fim.
+- Comissao de ativacao fica ligada a evidencia contratual.
+
+### Criterios de Aceite
+
+- [x] Escola nao fica `implantada` sem checklist completo.
+- [x] Termo de aceite e obrigatorio.
+- [x] Comissao de ativacao aparece como pendente ate aceite.
+
+### Implementado em 2026-06-29
+
+- Banco remoto: migration `20270629120000_onboarding_implantation_checklist_foundation.sql` aplicada para criar o checklist de implantacao e os status de implantacao.
+- Banco remoto: migration `20270629123000_onboarding_acceptance_term_gate.sql` aplicada para registrar Termo de Aceite, signatario, data de assinatura e validacao KLASSE.
+- RPC: `update_influencer_onboarding_implantation_checklist` normaliza os 8 itens obrigatorios, audita a alteracao e move a escola para `aguardando_aceite` quando o checklist fica completo.
+- RPC: `validate_onboarding_implantation_acceptance` exige checklist completo, termo anexado, nome do diretor/signatario e data de assinatura antes de marcar `aceite_validado`.
+- Gate financeiro: trigger `trg_activation_commission_acceptance_gate` impede aprovar ou pagar comissao de ativacao sem `aceite_validado` e termo assinado.
+
+### Pendencias restantes da Sprint 3
+
+- Expor na UI do portal do parceiro os checkboxes e notas do checklist de implantacao ja suportados pelo backend.
+- Criar tela/acao operacional para upload dedicado do Termo de Aceite e chamada da RPC de validacao pela KLASSE.
+
+## Sprint 4 - Setup de Dados e Documentos
+
+### Meta
+
+Dar ao parceiro controle real sobre recolha e preparacao dos dados.
+
+### Backlog
+
+- [ ] Criar fila de documentos por escola.
+- [ ] Classificar uploads: legais, planilhas, contrato, logotipo, pautas.
+- [ ] Permitir triagem do parceiro com status `pendente`.
+- [ ] Permitir triagem do parceiro com status `em_revisao_parceiro`.
+- [ ] Permitir triagem do parceiro com status `pendencia_cliente`.
+- [ ] Permitir triagem do parceiro com status `pronto_para_klasse`.
+- [ ] Manter aprovacao final KLASSE onde necessario.
+- [ ] Adicionar comentarios por arquivo.
+- [ ] Linkar modelos de planilhas.
+- [ ] Criar checklist de recolha baseado no documento HTML.
+
+### Entrega
+
+- Parceiro acompanha e cobra documentos sem depender de WhatsApp solto.
+- KLASSE recebe apenas material pronto para revisao/importacao.
+
+### Criterios de Aceite
+
+- [ ] Operador marca arquivo como pendente ou pronto para KLASSE.
+- [ ] Escola/parceiro conseguem ver motivo da pendencia.
+- [ ] Super Admin mantem aprovacao final.
+
+## Sprint 5 - Capacitacao e Go-Live
+
+### Meta
+
+Registrar formacao e ativacao real da escola.
+
+### Backlog
+
+- [ ] Criar modulo de treinamentos.
+- [ ] Tipo de treinamento: secretaria.
+- [ ] Tipo de treinamento: direcao.
+- [ ] Tipo de treinamento: professores.
+- [ ] Tipo de treinamento: financeiro.
+- [ ] Agenda de sessao.
+- [ ] Lista de participantes.
+- [ ] Evidencia: foto, ata, documento ou assinatura.
+- [ ] Checklist pos-treinamento.
+- [ ] Status de go-live.
+- [ ] Registro de data oficial de ativacao.
+
+### Entrega
+
+- O parceiro comprova capacitacao.
+- A escola so vai para operacao quando treinada.
+
+### Criterios de Aceite
+
+- [ ] Cada treinamento tem data, responsavel e evidencia.
+- [ ] Go-live exige treinamentos minimos.
+- [ ] Historico fica no perfil da escola.
+
+## Sprint 6 - Suporte L1 com SLA
+
+### Meta
+
+Cumprir o anexo contratual de suporte e medir performance.
+
+### Backlog
+
+- [ ] Criar tickets de suporte.
+- [ ] Campo: escola.
+- [ ] Campo: canal.
+- [ ] Campo: categoria.
+- [ ] Campo: gravidade.
+- [ ] Campo: responsavel.
+- [ ] Campo: SLA de resposta.
+- [ ] Campo: SLA de resolucao.
+- [ ] Gravidade Alta: FRT 15 min, resolucao 2h.
+- [ ] Gravidade Media: FRT 1h, resolucao 8h.
+- [ ] Gravidade Baixa: FRT 4h, resolucao 24h.
+- [ ] Relogio de SLA.
+- [ ] Status: `aberto`, `em_atendimento`, `aguardando_cliente`, `escalado_klasse`, `resolvido`.
+- [ ] Escalonamento L2/L3 para KLASSE.
+- [ ] Anexos e prints.
+
+### Entrega
+
+- Suporte deixa de ser informal.
+- SLA vira metrica contratual.
+
+### Criterios de Aceite
+
+- [ ] Ticket calcula vencimento automaticamente.
+- [ ] SLA atrasado fica visivel.
+- [ ] Escalonamento gera historico.
+- [ ] Relatorio mensal mostra cumprimento.
+
+## Sprint 7 - Comissoes, Penalidades e Payout
+
+### Meta
+
+Fechar o financeiro do parceiro de ponta a ponta.
+
+### Backlog
+
+- [ ] Comissao de ativacao gerada apos aceite validado.
+- [ ] Comissao de ativacao corresponde a 100% da taxa.
+- [ ] Comissao recorrente corresponde a 25% do valor pago pela escola.
+- [ ] Comissao recorrente fica suspensa por inadimplencia.
+- [ ] Penalidade SLA: se mais de 15% dos chamados validos ficarem fora do SLA, reduzir 5% da comissao recorrente da carteira afetada.
+- [ ] Solicitacao de payout.
+- [ ] Upload de fatura/recibo.
+- [ ] Status: `disponivel`, `solicitado`, `aprovado`, `pago`, `rejeitado`.
+- [ ] Extrato mensal.
+- [ ] Export CSV/PDF.
+
+### Entrega
+
+- Parceiro sabe quanto tem a receber e por que.
+- KLASSE tem evidencia para pagar, bloquear ou aplicar penalidade.
+
+### Criterios de Aceite
+
+- [ ] Payout nao abre sem fatura/recibo.
+- [ ] Comissao recorrente nao aprova se escola nao pagou.
+- [ ] Penalidade aparece discriminada.
+- [ ] Pagamento muda comissao para `paid`.
+
+## Sprint 8 - Biblioteca Operacional e Painel de Carteira
+
+### Meta
+
+Consolidar a operacao diaria numa tela unica.
+
+### Backlog
+
+- [ ] Criar biblioteca de POPs dentro do CRM.
+- [ ] Organizar POPs por fase: comercial.
+- [ ] Organizar POPs por fase: onboarding.
+- [ ] Organizar POPs por fase: setup.
+- [ ] Organizar POPs por fase: treinamento.
+- [ ] Organizar POPs por fase: suporte.
+- [ ] Organizar POPs por fase: financeiro.
+- [ ] Criar painel 360 da escola.
+- [ ] Painel 360 mostra lead.
+- [ ] Painel 360 mostra contrato.
+- [ ] Painel 360 mostra onboarding.
+- [ ] Painel 360 mostra checklist.
+- [ ] Painel 360 mostra treinamentos.
+- [ ] Painel 360 mostra tickets.
+- [ ] Painel 360 mostra SLA.
+- [ ] Painel 360 mostra comissoes.
+- [ ] Painel 360 mostra risco.
+- [ ] Criar indicadores por operador.
+- [ ] Criar indicadores por escola.
+- [ ] Criar alertas de risco.
+
+### Entrega
+
+- Operador tem uma tela unica para trabalhar a carteira.
+- Gestor ve gargalos e produtividade.
+
+### Criterios de Aceite
+
+- [ ] Cada escola tem timeline completa.
+- [ ] POPs aparecem no contexto da fase.
+- [ ] Dashboard mostra pendencias criticas.
+
+## 4. Prioridade Recomendada
+
+1. Sprint 1 - operadores, papeis e tarefas.
+2. Sprint 3 - checklist de implantacao e termo de aceite.
+3. Sprint 6 - suporte L1 com SLA.
+4. Sprint 7 - comissoes e payout.
+5. Sprint 2, Sprint 4, Sprint 5 e Sprint 8 refinam e fecham o ciclo.
+
+## 5. MVP Operacional
+
+Para operar com um fluxo minimo de inicio, meio e fim, implementar primeiro:
+
+- [x] Gestao de operadores.
+- [x] Lead com responsavel e proxima acao.
+- [x] Conversao para onboarding.
+- [ ] Checklist de implantacao.
+- [ ] Termo de aceite.
+- [ ] Tickets L1 com SLA.
+- [ ] Comissao de ativacao bloqueada por aceite.
+- [x] Comissao recorrente visivel.
+
+## 6. Dependencias Tecnicas Provaveis
+
+- [x] Tabelas/RPCs para gestao de membros pelo parceiro.
+- [ ] Tabelas de tarefas/agenda.
+- [ ] Tabelas de propostas/aceites comerciais.
+- [ ] Tabelas de checklist de implantacao.
+- [ ] Tabelas de treinamentos/evidencias.
+- [ ] Tabelas de tickets e SLAs.
+- [ ] Tabelas de payout e anexos financeiros.
+- [ ] Extensao do ledger de comissoes para penalidades SLA.
+- [ ] UI de biblioteca de POPs no CRM.
+
+## 7. Regras de Negocio Obrigatorias
+
+- Trial maximo: 30 dias.
+- Taxa de ativacao: 100% do parceiro.
+- Comissao recorrente: 25% sobre valor liquidado.
+- Inadimplencia suspende repasse.
+- Ativacao so libera comissao apos termo de aceite.
+- SLA L1:
+  - Alta: resposta em ate 15 minutos; resolucao em ate 2 horas.
+  - Media: resposta em ate 1 hora; resolucao em ate 8 horas.
+  - Baixa: resposta em ate 4 horas; resolucao em ate 24 horas.
+- Penalidade: descumprimento de mais de 15% dos chamados validos no mes reduz 5% da comissao recorrente da carteira afetada.
