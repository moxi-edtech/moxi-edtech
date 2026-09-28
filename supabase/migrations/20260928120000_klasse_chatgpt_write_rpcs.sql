BEGIN;

-- =============================================================================
-- KLASSE — Escrita para integrações AI (ChatGPT / Codex)
-- =============================================================================
-- Invariantes:
--  1. O tenant é derivado do JWT autenticado. Nenhuma função aceita escola_id
--     vindo do chamador.
--  2. Nenhuma tabela de negócio é escrita directamente: tudo delega nas RPCs já
--     auditadas (upsert_frequencias_batch, lancar_notas_batch,
--     financeiro_registrar_pagamento_secretaria), que revalidam papel e tenant
--     por dentro. Se estas recusarem, a chamada falha — não há contorno.
--  3. Pagamentos são em dois tempos. `klasse_prepare_payment` não escreve nada:
--     resolve os valores na base e devolve um token de uso único.
--     `klasse_confirm_payment` executa uma única vez e usa o próprio token como
--     chave de idempotência da RPC financeira.
--  4. Todas as funções são SECURITY INVOKER, com EXECUTE apenas para
--     `authenticated`. `anon` fica sem EXECUTE.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Resolução da escola para escrita
-- -----------------------------------------------------------------------------
-- `upsert_frequencias_batch` compara p_escola_id com current_tenant_escola_id(),
-- que prefere a claim `escola_id` do JWT. Derivar apenas por escola_users podia
-- devolver outra escola e a chamada era recusada. Preferimos a escola da claim
-- sempre que o papel exigido se mantenha lá: ambas as vias exigem o papel, por
-- isso isto não alarga privilégio.
CREATE OR REPLACE FUNCTION public.klasse_write_escola_id(p_allowed_roles text[])
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_derived uuid := public.klasse_integration_escola_id(p_allowed_roles);
  v_tenant  uuid := public.current_tenant_escola_id();
BEGIN
  IF v_tenant IS NOT NULL
     AND public.user_has_role_in_school(v_tenant, p_allowed_roles) THEN
    RETURN v_tenant;
  END IF;
  RETURN v_derived;
END;
$$;

REVOKE ALL ON FUNCTION public.klasse_write_escola_id(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klasse_write_escola_id(text[]) TO authenticated;

-- -----------------------------------------------------------------------------
-- 1. Tokens de confirmação (dois tempos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_write_tokens (
  token      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id  uuid NOT NULL,
  actor_id   uuid NOT NULL,
  tool       text NOT NULL,
  payload    jsonb NOT NULL,
  summary    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  used_at    timestamptz,
  result     jsonb
);

CREATE INDEX IF NOT EXISTS ix_integration_write_tokens_actor
  ON public.integration_write_tokens (actor_id, created_at DESC);

ALTER TABLE public.integration_write_tokens ENABLE ROW LEVEL SECURITY;

-- Cada utilizador vê e mexe apenas nos seus próprios tokens. O RLS fica ligado:
-- não há excepção nem política para `anon`.
DROP POLICY IF EXISTS integration_write_tokens_select_own ON public.integration_write_tokens;
CREATE POLICY integration_write_tokens_select_own
  ON public.integration_write_tokens FOR SELECT TO authenticated
  USING (actor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS integration_write_tokens_insert_own ON public.integration_write_tokens;
CREATE POLICY integration_write_tokens_insert_own
  ON public.integration_write_tokens FOR INSERT TO authenticated
  WITH CHECK (actor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS integration_write_tokens_update_own ON public.integration_write_tokens;
CREATE POLICY integration_write_tokens_update_own
  ON public.integration_write_tokens FOR UPDATE TO authenticated
  USING (actor_id = (SELECT auth.uid()))
  WITH CHECK (actor_id = (SELECT auth.uid()));

REVOKE ALL ON public.integration_write_tokens FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.integration_write_tokens TO authenticated;

-- -----------------------------------------------------------------------------
-- 1b. Registo de auditoria de escrita
-- -----------------------------------------------------------------------------
-- Uma linha por chamada de escrita, bem ou mal sucedida: quem, quando, que
-- ferramenta, que pedido, que resultado. É o rasto que o balcão tem em
-- audit_logs; aqui vive nesta tabela porque esta rota autentica por bearer e não
-- por cookie, e portanto não pode usar o recordAuditServer do portal.
CREATE TABLE IF NOT EXISTS public.integration_write_log (
  id         bigserial PRIMARY KEY,
  actor_id   uuid NOT NULL,
  escola_id  uuid,
  tool       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ok         boolean NOT NULL,
  result     jsonb,
  error      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_integration_write_log_actor
  ON public.integration_write_log (actor_id, created_at DESC);

ALTER TABLE public.integration_write_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_write_log_select_own ON public.integration_write_log;
CREATE POLICY integration_write_log_select_own
  ON public.integration_write_log FOR SELECT TO authenticated
  USING (actor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS integration_write_log_insert_own ON public.integration_write_log;
CREATE POLICY integration_write_log_insert_own
  ON public.integration_write_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = (SELECT auth.uid()));

REVOKE ALL ON public.integration_write_log FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.integration_write_log TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Frequências
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.klasse_record_attendance(
  p_turma_id      uuid,
  p_disciplina_id uuid,
  p_data          date,
  p_presencas     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid;
  v_result    jsonb;
  v_payload   jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'turma_id',      p_turma_id,
    'disciplina_id', p_disciplina_id,
    'data',          p_data,
    'total',         CASE WHEN jsonb_typeof(p_presencas) = 'array'
                          THEN jsonb_array_length(p_presencas) ELSE 0 END
  );

  v_escola_id := public.klasse_write_escola_id(
    ARRAY['professor', 'admin', 'admin_escola']
  );
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador sem escola onde possa lançar frequência.';
  END IF;

  IF p_presencas IS NULL OR jsonb_typeof(p_presencas) <> 'array'
     OR jsonb_array_length(p_presencas) = 0 THEN
    RAISE EXCEPTION 'DATA: lista de presenças vazia.';
  END IF;

  v_result := COALESCE(
    public.upsert_frequencias_batch(
      v_escola_id, p_turma_id, p_disciplina_id, p_data, p_presencas
    ),
    '{}'::jsonb
  );

  -- `upsert_frequencias_batch` só considera matrículas com status = 'ativa'.
  -- Há escolas cujos dados usam 'ativo', e nesses casos a função devolve 0/0
  -- sem levantar erro e não escreve nada. Sem este aviso, a ferramenta diria
  -- "lançado" ao operador tendo escrito zero linhas.
  IF COALESCE((v_result->>'inserted')::int, 0) = 0
     AND COALESCE((v_result->>'updated')::int, 0) = 0 THEN
    v_result := v_result || jsonb_build_object(
      'aviso',
      'Nenhuma presença foi escrita. A turma pode não ter matrículas com estado ''ativa'' — confirme a turma e o estado das matrículas.'
    );
  END IF;

  INSERT INTO public.integration_write_log
    (actor_id, escola_id, tool, payload, ok, result)
  VALUES
    ((SELECT auth.uid()), v_escola_id, 'lancar_frequencia', v_payload, true, v_result);

  RETURN v_result || jsonb_build_object('escola_id', v_escola_id);
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.integration_write_log
      (actor_id, escola_id, tool, payload, ok, error)
    VALUES
      ((SELECT auth.uid()), v_escola_id, 'lancar_frequencia', v_payload, false, SQLERRM);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- a falha de registo nunca pode mascarar o erro original
  END;
  -- Devolve em vez de relançar: um RAISE faria rollback da transacção toda e
  -- levaria consigo o registo de auditoria que a linha acima acabou de escrever.
  -- O bloco EXCEPTION já desfez qualquer escrita parcial.
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.klasse_record_attendance(uuid, uuid, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klasse_record_attendance(uuid, uuid, date, jsonb) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Notas
-- -----------------------------------------------------------------------------
-- `lancar_notas_batch` aceita professor atribuído ou papéis administrativos.
CREATE OR REPLACE FUNCTION public.klasse_record_grades(
  p_turma_id             uuid,
  p_disciplina_id        uuid,
  p_turma_disciplina_id  uuid,
  p_trimestre            integer,
  p_tipo_avaliacao       text,
  p_notas                jsonb,
  p_is_isento            boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id uuid;
  v_result    jsonb;
  v_payload   jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'turma_id',            p_turma_id,
    'disciplina_id',       p_disciplina_id,
    'turma_disciplina_id', p_turma_disciplina_id,
    'trimestre',           p_trimestre,
    'tipo_avaliacao',      p_tipo_avaliacao,
    'total',               CASE WHEN jsonb_typeof(p_notas) = 'array'
                                THEN jsonb_array_length(p_notas) ELSE 0 END
  );

  v_escola_id := public.klasse_write_escola_id(
    ARRAY['professor', 'admin', 'admin_escola', 'staff_admin', 'secretaria']
  );
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador sem escola onde possa lançar notas.';
  END IF;

  IF p_notas IS NULL OR jsonb_typeof(p_notas) <> 'array'
     OR jsonb_array_length(p_notas) = 0 THEN
    RAISE EXCEPTION 'DATA: lista de notas vazia.';
  END IF;
  IF p_trimestre IS NULL OR p_trimestre < 1 OR p_trimestre > 3 THEN
    RAISE EXCEPTION 'DATA: trimestre inválido.';
  END IF;

  v_result := public.lancar_notas_batch(
    v_escola_id, p_turma_id, p_disciplina_id, p_turma_disciplina_id,
    p_trimestre, COALESCE(NULLIF(btrim(p_tipo_avaliacao), ''), 'MAC'),
    p_notas, COALESCE(p_is_isento, false)
  );

  INSERT INTO public.integration_write_log
    (actor_id, escola_id, tool, payload, ok, result)
  VALUES
    ((SELECT auth.uid()), v_escola_id, 'lancar_notas', v_payload, true, v_result);

  RETURN COALESCE(v_result, '{}'::jsonb)
         || jsonb_build_object('escola_id', v_escola_id);
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.integration_write_log
      (actor_id, escola_id, tool, payload, ok, error)
    VALUES
      ((SELECT auth.uid()), v_escola_id, 'lancar_notas', v_payload, false, SQLERRM);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.klasse_record_grades(uuid, uuid, uuid, integer, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klasse_record_grades(uuid, uuid, uuid, integer, text, jsonb, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Pagamento — primeiro tempo (não escreve)
-- -----------------------------------------------------------------------------
-- Os valores são resolvidos AQUI, a partir da base. O chamador não propõe preço:
-- propõe, no máximo, um valor a pagar que não pode exceder o saldo em aberto.
CREATE OR REPLACE FUNCTION public.klasse_prepare_payment(
  p_aluno_id       uuid,
  p_mensalidade_id uuid,
  p_valor          numeric DEFAULT NULL,
  p_metodo         text DEFAULT 'cash'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_escola_id  uuid;
  v_m          public.mensalidades%ROWTYPE;
  v_saldo      numeric;
  v_valor      numeric;
  v_metodo     text;
  v_token      uuid;
  v_expires    timestamptz;
  v_payload    jsonb;
  v_summary    jsonb;
BEGIN
  v_escola_id := public.klasse_write_escola_id(
    ARRAY['secretaria','financeiro','secretaria_financeiro','admin_financeiro',
          'admin_escola','admin','staff_admin']
  );
  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'AUTH: utilizador sem escola onde possa registar pagamentos.';
  END IF;

  v_metodo := lower(btrim(COALESCE(p_metodo, 'cash')));
  IF v_metodo = 'kiwk' THEN
    v_metodo := 'kwik';
  END IF;
  IF v_metodo NOT IN ('cash', 'tpa', 'transfer', 'mcx', 'kwik') THEN
    RAISE EXCEPTION 'DATA: método de pagamento inválido: %', p_metodo;
  END IF;

  SELECT * INTO v_m
  FROM public.mensalidades m
  WHERE m.id = p_mensalidade_id
    AND m.escola_id = v_escola_id
    AND m.aluno_id = p_aluno_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATA: mensalidade não encontrada para este aluno nesta escola.';
  END IF;

  IF v_m.status = 'pago' THEN
    RAISE EXCEPTION 'DATA: mensalidade já se encontra paga.';
  END IF;
  IF v_m.status = 'cancelado' THEN
    RAISE EXCEPTION 'DATA: mensalidade cancelada.';
  END IF;

  v_saldo := COALESCE(v_m.valor, 0) - COALESCE(v_m.valor_pago_total, 0);
  IF v_saldo <= 0 THEN
    RAISE EXCEPTION 'DATA: mensalidade sem saldo em aberto.';
  END IF;

  v_valor := COALESCE(p_valor, v_saldo);
  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'DATA: valor inválido.';
  END IF;
  IF v_valor > v_saldo THEN
    RAISE EXCEPTION 'DATA: valor (%) excede o saldo em aberto (%).', v_valor, v_saldo;
  END IF;

  v_payload := jsonb_build_object(
    'aluno_id',       p_aluno_id,
    'mensalidade_id', p_mensalidade_id,
    'valor',          v_valor,
    'metodo',         v_metodo
  );

  v_summary := jsonb_build_object(
    'aluno_id',        p_aluno_id,
    'mensalidade_id',  p_mensalidade_id,
    'valor',           v_valor,
    'metodo',          v_metodo,
    'saldo_em_aberto', v_saldo,
    'data_vencimento', v_m.data_vencimento,
    'mes_referencia',  v_m.mes_referencia,
    'ano_referencia',  v_m.ano_referencia
  );

  INSERT INTO public.integration_write_tokens
    (escola_id, actor_id, tool, payload, summary)
  VALUES
    (v_escola_id, (SELECT auth.uid()), 'registar_pagamento', v_payload, v_summary)
  RETURNING token, expires_at INTO v_token, v_expires;

  RETURN jsonb_build_object(
    'token',      v_token,
    'expires_at', v_expires,
    'resumo',     v_summary,
    'aviso',      'Nada foi cobrado. Confirme com a ferramenta confirmar_pagamento e o token acima.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.klasse_prepare_payment(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klasse_prepare_payment(uuid, uuid, numeric, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Pagamento — segundo tempo (escreve, uma única vez)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.klasse_confirm_payment(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_tok     public.integration_write_tokens%ROWTYPE;
  v_row     public.pagamentos%ROWTYPE;
  v_result  jsonb;
  v_log     jsonb := jsonb_build_object('token', p_token);
BEGIN
  SELECT * INTO v_tok
  FROM public.integration_write_tokens t
  WHERE t.token = p_token
    AND t.actor_id = (SELECT auth.uid())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH: token de confirmação inválido.';
  END IF;

  -- Reenvio do mesmo token devolve o resultado original: nunca cobra duas vezes.
  IF v_tok.used_at IS NOT NULL THEN
    RETURN COALESCE(v_tok.result, '{}'::jsonb)
           || jsonb_build_object('ok', true, 'repetido', true);
  END IF;

  v_log := jsonb_build_object('token', p_token, 'resumo', v_tok.summary);

  IF v_tok.expires_at <= now() THEN
    RAISE EXCEPTION 'DATA: token de confirmação expirado. Prepare novamente.';
  END IF;

  IF v_tok.tool <> 'registar_pagamento' THEN
    RAISE EXCEPTION 'AUTH: token não corresponde a um pagamento.';
  END IF;

  -- O token é a chave de idempotência da RPC financeira: mesmo que algo corra
  -- mal entre a escrita e a marcação do token, a repetição não duplica.
  v_row := public.financeiro_registrar_pagamento_secretaria(
    p_escola_id      => v_tok.escola_id,
    p_aluno_id       => (v_tok.payload->>'aluno_id')::uuid,
    p_mensalidade_id => (v_tok.payload->>'mensalidade_id')::uuid,
    p_valor          => (v_tok.payload->>'valor')::numeric,
    p_metodo         => (v_tok.payload->>'metodo')::public.pagamento_metodo,
    p_meta           => jsonb_build_object(
                          'origem', 'integracao_ai',
                          'idempotency_key', p_token::text
                        )
  );

  v_result := jsonb_build_object(
    'ok',             true,
    'pagamento_id',   v_row.id,
    'aluno_id',       v_row.aluno_id,
    'mensalidade_id', v_row.mensalidade_id,
    'valor',          v_row.valor,
    'metodo',         v_row.metodo,
    'escola_id',      v_row.escola_id,
    'criado_em',      v_row.created_at,
    'repetido',       false
  );

  UPDATE public.integration_write_tokens
     SET used_at = now(),
         result  = v_result
   WHERE token = p_token;

  INSERT INTO public.integration_write_log
    (actor_id, escola_id, tool, payload, ok, result)
  VALUES
    ((SELECT auth.uid()), v_tok.escola_id, 'confirmar_pagamento', v_log, true, v_result);

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.integration_write_log
      (actor_id, escola_id, tool, payload, ok, error)
    VALUES
      ((SELECT auth.uid()), v_tok.escola_id, 'confirmar_pagamento', v_log, false, SQLERRM);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.klasse_confirm_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klasse_confirm_payment(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Confirmações pendentes (para o assistente retomar uma conversa)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.klasse_pending_confirmations()
RETURNS TABLE (
  token      uuid,
  tool       text,
  resumo     jsonb,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT t.token, t.tool, t.summary, t.created_at, t.expires_at
  FROM public.integration_write_tokens t
  WHERE t.actor_id = (SELECT auth.uid())
    AND t.used_at IS NULL
    AND t.expires_at > now()
  ORDER BY 4 DESC
  LIMIT 20
$$;

REVOKE ALL ON FUNCTION public.klasse_pending_confirmations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klasse_pending_confirmations() TO authenticated;

COMMIT;
