-- Bolsa integral: SSOT por matrícula/ano letivo.
-- 2027... é a sequência de migrations do repositório, não o ano civil da aplicação.
-- Não elimina mensalidades históricas nem altera recebimentos/recibos fiscais.
BEGIN;

ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS bolsa_integral boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bolsa_integral_motivo text;

-- Reconhece matrículas com bolsa integral já codificada como desconto de 100%.
UPDATE public.matriculas
   SET bolsa_integral = true,
       bolsa_integral_motivo = coalesce(nullif(btrim(motivo_desconto), ''), 'Bolsa integral')
 WHERE percentagem_desconto = 100
   AND motivo_desconto ILIKE '%bolsa%'
   AND bolsa_integral IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS idx_matriculas_bolsa_integral_scope
  ON public.matriculas(escola_id, aluno_id, ano_letivo, turma_id)
  WHERE bolsa_integral = true OR percentagem_desconto = 100;

-- Impede que utilizadores sem papel financeiro/secretaria contornem a API com
-- atualizações diretas da coluna de bolsa (ou desconto integral) via Data API.
CREATE OR REPLACE FUNCTION public.klasse_autorizar_escrita_bolsa_matricula()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $
DECLARE
  v_requer_autorizacao boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_requer_autorizacao := NEW.bolsa_integral OR coalesce(NEW.percentagem_desconto,0) >= 100;
  ELSE
    v_requer_autorizacao :=
      NEW.bolsa_integral IS DISTINCT FROM OLD.bolsa_integral
      OR NEW.bolsa_integral_motivo IS DISTINCT FROM OLD.bolsa_integral_motivo
      OR (
        NEW.percentagem_desconto IS DISTINCT FROM OLD.percentagem_desconto
        AND (coalesce(NEW.percentagem_desconto,0) >= 100
             OR coalesce(OLD.percentagem_desconto,0) >= 100)
      );
  END IF;

  IF NOT v_requer_autorizacao
     OR session_user = 'postgres'
     OR coalesce(auth.jwt()->>'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.user_id = auth.uid()
      AND eu.escola_id = NEW.escola_id
      AND eu.papel IN ('admin','admin_escola','admin_financeiro',
        'admin_secretaria','admin_secretario','secretaria','financeiro','diretor','staff_admin')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: sem permissão para alterar bolsa integral' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS trg_03_autorizar_bolsa_matricula ON public.matriculas;
CREATE TRIGGER trg_03_autorizar_bolsa_matricula
  BEFORE INSERT OR UPDATE OF bolsa_integral, bolsa_integral_motivo, percentagem_desconto
  ON public.matriculas FOR EACH ROW
  EXECUTE FUNCTION public.klasse_autorizar_escrita_bolsa_matricula();

REVOKE ALL ON FUNCTION public.klasse_autorizar_escrita_bolsa_matricula()
FROM PUBLIC, anon, authenticated;

-- Defesa de última linha em todas as inserções de mensalidades, inclusive rotas
-- novas, scripts SQL, gatilho de matrícula e gerações em lote.
CREATE OR REPLACE FUNCTION public.klasse_guard_bolsa_mensalidade()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_isento boolean := false;
BEGIN
  IF NEW.status NOT IN ('pendente', 'isento')
     OR coalesce(NEW.valor_pago_total, 0) <> 0
     OR NEW.fiscal_documento_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT (m.bolsa_integral OR coalesce(m.percentagem_desconto, 0) >= 100)
    INTO v_isento
  FROM public.matriculas m
  WHERE m.escola_id = NEW.escola_id
    AND m.aluno_id = NEW.aluno_id
    AND (
      (NEW.matricula_id IS NOT NULL AND m.id = NEW.matricula_id)
      OR (NEW.matricula_id IS NULL
          AND m.ano_letivo::text = NEW.ano_letivo
          AND (NEW.turma_id IS NULL OR m.turma_id = NEW.turma_id))
    )
  ORDER BY m.created_at DESC
  LIMIT 1
  FOR SHARE;

  IF coalesce(v_isento, false) THEN
    IF TG_OP = 'INSERT' AND NEW.status = 'pendente' THEN
      RETURN NULL; -- nenhum título a pagar, nem título "pendente" de 0 Kz
    END IF;
    NEW.valor_original := greatest(
      coalesce(NEW.valor_original, 0),
      coalesce(NEW.valor_previsto, 0),
      coalesce(NEW.valor, 0)
    );
    NEW.desconto_aplicado := NEW.valor_original;
    NEW.valor := 0;
    NEW.valor_previsto := 0;
    NEW.status := 'isento';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_05_bolsa_integral_mensalidades ON public.mensalidades;
CREATE TRIGGER trg_05_bolsa_integral_mensalidades
  BEFORE INSERT OR UPDATE OF valor, valor_previsto, status, matricula_id
  ON public.mensalidades
  FOR EACH ROW EXECUTE FUNCTION public.klasse_guard_bolsa_mensalidade();

-- O mesmo ajuste vale quando a bolsa é marcada depois da cobrança gerada.
-- A ledger contabiliza o crédito da diferença (o débito original permanece).
CREATE OR REPLACE FUNCTION public.klasse_reconciliar_bolsa_matricula()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF NOT (NEW.bolsa_integral OR coalesce(NEW.percentagem_desconto, 0) >= 100) THEN
    RETURN NEW;
  END IF;

  UPDATE public.mensalidades me
     SET valor_original = greatest(
           coalesce(me.valor_original, 0),
           coalesce(me.valor_previsto, 0),
           coalesce(me.valor, 0)
         ),
         desconto_aplicado = greatest(
           coalesce(me.valor_original, 0),
           coalesce(me.valor_previsto, 0),
           coalesce(me.valor, 0)
         ),
         valor = 0,
         valor_previsto = 0,
         status = 'isento',
         observacoes = concat_ws(' | ', nullif(me.observacoes, ''), 'Bolsa integral')
   WHERE me.escola_id = NEW.escola_id
     AND me.aluno_id = NEW.aluno_id
     AND (
       me.matricula_id = NEW.id
       OR (me.matricula_id IS NULL
           AND me.turma_id = NEW.turma_id
           AND me.ano_letivo = NEW.ano_letivo::text)
     )
     AND me.status = 'pendente'
     AND coalesce(me.valor_pago_total, 0) = 0
     AND me.fiscal_documento_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_10_bolsa_matricula ON public.matriculas;
CREATE TRIGGER trg_10_bolsa_matricula
  AFTER INSERT OR UPDATE OF bolsa_integral, percentagem_desconto
  ON public.matriculas FOR EACH ROW
  EXECUTE FUNCTION public.klasse_reconciliar_bolsa_matricula();

-- Escrita atómica auditada. O cliente não pode editar livremente os campos.
CREATE OR REPLACE FUNCTION public.klasse_definir_bolsa_integral(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_matricula_id uuid,
  p_bolseiro boolean,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
DECLARE
  v_matricula public.matriculas%ROWTYPE;
  v_motivo text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id
      AND eu.user_id = auth.uid()
      AND eu.papel IN ('admin','admin_escola','admin_financeiro','admin_secretaria',
                       'admin_secretario','secretaria','financeiro','diretor','staff_admin')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_matricula
    FROM public.matriculas
   WHERE id = p_matricula_id AND escola_id = p_escola_id
     AND aluno_id = p_aluno_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATRICULA_NAO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;

  v_motivo := CASE WHEN p_bolseiro
    THEN left(coalesce(nullif(btrim(p_motivo), ''), 'Bolsa integral'), 160)
    ELSE NULL END;

  IF v_matricula.bolsa_integral IS DISTINCT FROM p_bolseiro
     OR v_matricula.bolsa_integral_motivo IS DISTINCT FROM v_motivo THEN
    IF NOT p_bolseiro AND coalesce(v_matricula.percentagem_desconto,0) >= 100
       AND coalesce(v_matricula.motivo_desconto,'') NOT ILIKE '%bolsa%' THEN
      RAISE EXCEPTION 'DESCONTO_INTEGRAL_DISTINTO_DE_BOLSA' USING ERRCODE='23514';
    END IF;

    UPDATE public.matriculas
      SET bolsa_integral = p_bolseiro,
          bolsa_integral_motivo = v_motivo,
          percentagem_desconto = CASE WHEN NOT p_bolseiro
              AND coalesce(v_matricula.percentagem_desconto,0) >= 100
              AND coalesce(v_matricula.motivo_desconto,'') ILIKE '%bolsa%'
            THEN 0 ELSE percentagem_desconto END,
          motivo_desconto = CASE WHEN NOT p_bolseiro
              AND coalesce(v_matricula.percentagem_desconto,0) >= 100
              AND coalesce(v_matricula.motivo_desconto,'') ILIKE '%bolsa%'
            THEN NULL ELSE motivo_desconto END,
          updated_at = now()
      WHERE id = v_matricula.id AND escola_id = p_escola_id;

    INSERT INTO public.audit_logs
      (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES
      (p_escola_id, auth.uid(), 'BOLSA_INTEGRAL_ATUALIZADA',
       'matriculas', p_matricula_id::text, 'secretaria',
       jsonb_build_object('aluno_id',p_aluno_id,'ano_letivo',v_matricula.ano_letivo,
         'anterior',v_matricula.bolsa_integral,
         'atual',p_bolseiro,'motivo',v_motivo));
  END IF;

  RETURN jsonb_build_object('ok',true, 'matricula_id',v_matricula.id,
      'ano_letivo',v_matricula.ano_letivo,'bolseiro',p_bolseiro,
      'motivo',v_motivo);
END;
$$;

REVOKE ALL ON FUNCTION public.klasse_definir_bolsa_integral(uuid,uuid,uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klasse_definir_bolsa_integral(uuid,uuid,uuid,boolean,text) TO authenticated;

REVOKE ALL ON FUNCTION public.klasse_guard_bolsa_mensalidade() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.klasse_reconciliar_bolsa_matricula() FROM PUBLIC, anon, authenticated;

-- Corrige as duas sobrecargas de geração de propinas (4 e 5 argumentos).

CREATE OR REPLACE FUNCTION public.gerar_mensalidades_lote(p_escola_id uuid, p_ano_letivo integer, p_mes_referencia integer, p_dia_vencimento_default integer DEFAULT 10, p_turma_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_data_vencimento date;
  v_mes smallint;
  v_ano int;
  v_inseridas int := 0;
  v_sem_preco int := 0;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_mes_final date;
  v_competencia date;
BEGIN
  IF session_user <> 'postgres'
     AND coalesce(auth.jwt()->>'role', '') <> 'service_role'
     AND (
    auth.uid() IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.escola_users eu
       WHERE eu.escola_id = p_escola_id
         AND eu.user_id = auth.uid()
         AND eu.papel IN ('admin','admin_escola','admin_financeiro','admin_secretaria',
                          'admin_secretario','secretaria','financeiro','diretor','staff_admin')
    )
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: geração de propinas sem autorização' USING ERRCODE='42501';
  END IF;

  v_mes := LEAST(GREATEST(p_mes_referencia, 1), 12);

  SELECT al.data_inicio, al.data_fim
    INTO v_periodo_inicio, v_periodo_fim
  FROM public.anos_letivos al
  WHERE al.escola_id = p_escola_id
    AND al.ano = p_ano_letivo
  ORDER BY al.ativo DESC, al.created_at DESC
  LIMIT 1;

  v_ano := p_ano_letivo;
  IF v_periodo_inicio IS NOT NULL
     AND v_periodo_fim IS NOT NULL
     AND EXTRACT(YEAR FROM v_periodo_inicio) <> EXTRACT(YEAR FROM v_periodo_fim) THEN
    v_ano := CASE
      WHEN v_mes >= EXTRACT(MONTH FROM v_periodo_inicio)::int
        THEN EXTRACT(YEAR FROM v_periodo_inicio)::int
      ELSE EXTRACT(YEAR FROM v_periodo_fim)::int
    END;
  END IF;

  v_mes_final := date_trunc('month', v_periodo_fim)::date;
  v_competencia := make_date(v_ano, v_mes, 1);

  v_data_vencimento := make_date(
    v_ano,
    v_mes,
    LEAST(GREATEST(coalesce(p_dia_vencimento_default, 10), 1), 28)
  );

  WITH regras AS (
    SELECT
      ft.id AS tabela_id,
      ft.escola_id,
      ft.ano_letivo,
      ft.curso_id,
      ft.classe_id,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      1 AS prioridade
    FROM public.financeiro_tabelas ft
    UNION ALL
    SELECT id, escola_id, ano_letivo, curso_id, NULL, valor_mensalidade, dia_vencimento, 2
    FROM public.financeiro_tabelas
    WHERE classe_id IS NULL
    UNION ALL
    SELECT id, escola_id, ano_letivo, NULL, classe_id, valor_mensalidade, dia_vencimento, 3
    FROM public.financeiro_tabelas
    WHERE curso_id IS NULL
    UNION ALL
    SELECT id, escola_id, ano_letivo, NULL, NULL, valor_mensalidade, dia_vencimento, 4
    FROM public.financeiro_tabelas
  ),
  precos AS (
    SELECT
      m.id AS matricula_id,
      COALESCE(m.bolsa_integral, false) AS bolsa_integral,
      COALESCE(m.percentagem_desconto, 0) AS percentagem_desconto,
      m.aluno_id,
      m.turma_id,
      t.curso_id,
      t.classe_id,
      public.is_turma_classe_exame(t.id) AS is_classe_exame,
      coalesce(
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1)
      ) AS tabela_id,
      coalesce(
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        0
      ) AS valor_mensalidade,
      coalesce(
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        p_dia_vencimento_default
      ) AS dia_vencimento_resolvido
    FROM public.matriculas m
    JOIN public.turmas t ON t.id = m.turma_id
    WHERE m.escola_id = p_escola_id
      AND m.ano_letivo::text = p_ano_letivo::text
      AND m.status IN ('ativo', 'ativa')
      AND (p_turma_id IS NULL OR m.turma_id = p_turma_id)
      AND (
        v_periodo_fim IS NULL
        OR v_competencia < v_mes_final
        OR public.is_turma_classe_exame(t.id)
      )
  ),
  inseridos AS (
    INSERT INTO public.mensalidades (
      escola_id,
      aluno_id,
      matricula_id,
      turma_id,
      ano_letivo,
      mes_referencia,
      ano_referencia,
      valor,
      valor_previsto,
      valor_original,
      desconto_aplicado,
      valor_pago_total,
      status,
      data_vencimento,
      tabela_id
    )
    SELECT
      p_escola_id,
      p.aluno_id,
      p.matricula_id,
      p.turma_id,
      p_ano_letivo::text,
      v_mes,
      v_ano,
      ROUND(p.valor_mensalidade * (1 - p.percentagem_desconto / 100), 2),
      ROUND(p.valor_mensalidade * (1 - p.percentagem_desconto / 100), 2),
      p.valor_mensalidade,
      ROUND(p.valor_mensalidade * p.percentagem_desconto / 100, 2),
      0,
      'pendente',
      make_date(v_ano, v_mes, LEAST(GREATEST(coalesce(p.dia_vencimento_resolvido, p_dia_vencimento_default), 1), 28)),
      p.tabela_id
    FROM precos p
    WHERE coalesce(p.valor_mensalidade, 0) > 0
      AND NOT p.bolsa_integral
      AND p.percentagem_desconto < 100
      AND NOT EXISTS (
      SELECT 1 FROM public.mensalidades m2
      WHERE m2.escola_id = p_escola_id
        AND m2.aluno_id = p.aluno_id
        AND m2.ano_referencia = v_ano
        AND m2.mes_referencia = v_mes
    )
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM inseridos),
         (SELECT count(*) FROM precos p WHERE coalesce(p.valor_mensalidade, 0) <= 0)
    INTO v_inseridas, v_sem_preco;

  RETURN jsonb_build_object(
    'ok', true,
    'geradas', coalesce(v_inseridas, 0),
    'sem_preco', coalesce(v_sem_preco, 0),
    'ano', v_ano,
    'mes', v_mes,
    'vencimento', v_data_vencimento,
    'mes_final', v_mes_final
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.gerar_mensalidades_lote(
  p_escola_id uuid, p_ano_letivo integer, p_mes_referencia integer,
  p_dia_vencimento_default integer DEFAULT 10
)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER
SET search_path TO 'pg_catalog','public'
AS $$
  SELECT public.gerar_mensalidades_lote(
    p_escola_id, p_ano_letivo, p_mes_referencia,
    p_dia_vencimento_default, NULL::uuid
  );
$$;

REVOKE ALL ON FUNCTION public.gerar_mensalidades_lote(uuid,integer,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gerar_mensalidades_lote(uuid,integer,integer,integer,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_mensalidades_lote(uuid,integer,integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gerar_mensalidades_lote(uuid,integer,integer,integer,uuid) TO authenticated, service_role;

-- Reconcilia apenas títulos abertos, sem pagamentos e sem documento fiscal.
-- O trigger gera créditos auditáveis na ledger, sem apagar lançamentos.
UPDATE public.matriculas m
   SET bolsa_integral_motivo = coalesce(nullif(btrim(bolsa_integral_motivo), ''), 'Bolsa integral')
 WHERE m.bolsa_integral = true
   AND bolsa_integral_motivo IS NULL;

-- Aciona a reconciliação também nas bolsas que já existiam antes da migração.
UPDATE public.matriculas m
   SET bolsa_integral = true
 WHERE m.bolsa_integral = true
   AND EXISTS (
      SELECT 1 FROM public.mensalidades me
      WHERE me.matricula_id = m.id AND me.status = 'pendente'
        AND coalesce(me.valor_pago_total,0) = 0 AND me.fiscal_documento_id IS NULL
        AND true -- também converte propinas antigas de 0 Kz em estado pendente
   );

COMMIT;
