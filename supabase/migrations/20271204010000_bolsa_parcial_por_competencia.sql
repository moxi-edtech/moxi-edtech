-- Bolsa parcial por matrícula e competência. Não reutiliza desconto comercial.
BEGIN;

ALTER TABLE public.matriculas
  ADD COLUMN bolsa_parcial_periodos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN bolsa_parcial_percentagem numeric(5,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT matriculas_bolsa_parcial_consistente CHECK (
    jsonb_typeof(bolsa_parcial_periodos)='array'
    AND bolsa_parcial_percentagem >= 0 AND bolsa_parcial_percentagem < 100
    AND bolsa_parcial_percentagem = coalesce((bolsa_parcial_periodos->-1->>'percentagem')::numeric,0)
  );

CREATE FUNCTION public.klasse_percentagem_bolsa_parcial(p_periodos jsonb, p_mes date)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'pg_catalog'
AS $$
 SELECT coalesce((
   SELECT (item->>'percentagem')::numeric
   FROM jsonb_array_elements(p_periodos) WITH ORDINALITY AS p(item,n)
   WHERE (item->>'inicio')::date <= date_trunc('month',p_mes)::date
   ORDER BY n DESC LIMIT 1
 ),0);
$$;
REVOKE ALL ON FUNCTION public.klasse_percentagem_bolsa_parcial(jsonb,date) FROM PUBLIC,anon,authenticated;

-- SECURITY INVOKER intencional: só o proprietário da RPC pode escrever a
-- cronologia através da API; não confiar em GUC ou motivo editável.
CREATE FUNCTION public.klasse_proteger_bolsa_parcial()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'pg_catalog','public'
AS $$
DECLARE
  v_alterada boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    v_alterada := NEW.bolsa_parcial_percentagem<>0 OR NEW.bolsa_parcial_periodos<>'[]'::jsonb;
  ELSE
    v_alterada := NEW.bolsa_parcial_percentagem IS DISTINCT FROM OLD.bolsa_parcial_percentagem
       OR NEW.bolsa_parcial_periodos IS DISTINCT FROM OLD.bolsa_parcial_periodos;
  END IF;
  IF v_alterada AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'BOLSA_PARCIAL_EXIGE_RPC' USING ERRCODE='42501';
  END IF;
  IF NEW.bolsa_parcial_periodos<>'[]'::jsonb AND coalesce(NEW.percentagem_desconto,0)<>0 THEN
    RAISE EXCEPTION 'BOLSA_PARCIAL_INCOMPATIVEL_COM_DESCONTO_COMERCIAL' USING ERRCODE='23514';
  END IF;
  IF NEW.bolsa_integral AND (
      NEW.bolsa_parcial_percentagem>0 OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.bolsa_parcial_periodos) p
        WHERE (p->>'percentagem')::numeric>0 AND (
          (p->>'inicio')::date >= coalesce(NEW.bolsa_integral_inicio,'0001-01-01'::date)
          OR NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(NEW.bolsa_parcial_periodos) q
            WHERE (q->>'inicio')::date > (p->>'inicio')::date
              AND (q->>'inicio')::date <= coalesce(NEW.bolsa_integral_inicio,'0001-01-01'::date)
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'BOLSA_INTEGRAL_SOBREPOSTA_A_PARCIAL' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.klasse_proteger_bolsa_parcial() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_04_proteger_bolsa_parcial
 BEFORE INSERT OR UPDATE OF bolsa_parcial_periodos,bolsa_parcial_percentagem,bolsa_integral,bolsa_integral_inicio,percentagem_desconto
 ON public.matriculas FOR EACH ROW EXECUTE FUNCTION public.klasse_proteger_bolsa_parcial();

-- Todos os geradores de novas propinas convergem nesta defesa. O valor bruto
-- vem do título, nunca da tabela de preços atual de uma competência antiga.
CREATE FUNCTION public.klasse_guard_bolsa_parcial_mensalidade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
DECLARE
  v_periodos jsonb;
  v_percentagem numeric;
  v_bruto numeric;
BEGIN
  IF NEW.status::text NOT IN ('pendente','atrasado')
     OR coalesce(NEW.valor_pago_total,0)<>0
     OR NEW.fiscal_documento_id IS NOT NULL
     OR coalesce(NEW.status_fiscal,'pending')<>'pending'
     OR coalesce(NEW.valor_previsto,NEW.valor,0)<=0 THEN
    RETURN NEW;
  END IF;
  SELECT m.bolsa_parcial_periodos INTO v_periodos
  FROM public.matriculas m
  WHERE m.escola_id=NEW.escola_id AND m.aluno_id=NEW.aluno_id
    AND (m.id=NEW.matricula_id OR (NEW.matricula_id IS NULL
      AND m.ano_letivo::text=NEW.ano_letivo AND m.turma_id=NEW.turma_id))
  ORDER BY m.created_at DESC LIMIT 1 FOR SHARE;
  IF v_periodos IS NULL OR v_periodos='[]'::jsonb THEN RETURN NEW; END IF;
  v_percentagem := public.klasse_percentagem_bolsa_parcial(v_periodos,NEW.data_vencimento);
  IF v_percentagem=0 THEN RETURN NEW; END IF;
  v_bruto := coalesce(nullif(NEW.valor_original,0),NEW.valor_previsto,NEW.valor);
  IF v_bruto IS NULL OR v_bruto<0.01 THEN
    RAISE EXCEPTION 'BOLSA_PARCIAL_VALOR_ORIGINAL_INVALIDO' USING ERRCODE='23514';
  END IF;
  NEW.valor_original := v_bruto;
  NEW.valor := greatest(0.01,round(v_bruto*(1-v_percentagem/100),2));
  NEW.valor_previsto := NEW.valor;
  NEW.desconto_aplicado := v_bruto-NEW.valor;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.klasse_guard_bolsa_parcial_mensalidade() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_06_bolsa_parcial_mensalidade
 BEFORE INSERT ON public.mensalidades FOR EACH ROW
 EXECUTE FUNCTION public.klasse_guard_bolsa_parcial_mensalidade();

CREATE FUNCTION public.klasse_definir_bolsa_parcial(
 p_escola_id uuid,p_aluno_id uuid,p_matricula_id uuid,p_percentagem numeric,
 p_motivo text DEFAULT NULL,p_vigencia_inicio date DEFAULT NULL,
 p_regularizacao_retroativa boolean DEFAULT false,p_justificativa text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
DECLARE
  v_m public.matriculas%ROWTYPE;
  v_inicio date;
  v_ano_inicio date;
  v_ano_fim date;
  v_hoje date := date_trunc('month',timezone('Africa/Luanda',now()))::date;
  v_periodos jsonb;
  v_motivo text;
  v_retro boolean;
  v_alteradas integer := 0;
  v_revisoes integer := 0;
  v_me public.mensalidades%ROWTYPE;
  v_anterior numeric;
  v_bruto numeric;
  v_liquido numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id
      AND eu.user_id=auth.uid() AND eu.papel IN ('admin','admin_escola','admin_financeiro',
        'admin_secretaria','admin_secretario','secretaria','financeiro','diretor','staff_admin')
  ) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_percentagem IS NULL OR p_percentagem::text IN ('NaN','Infinity','-Infinity')
     OR p_percentagem<0 OR p_percentagem>=100 OR p_percentagem<>round(p_percentagem,2)
     OR (p_percentagem>0 AND p_percentagem<0.01) THEN
    RAISE EXCEPTION 'BOLSA_PERCENTAGEM_INVALIDA' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_m FROM public.matriculas
   WHERE id=p_matricula_id AND escola_id=p_escola_id AND aluno_id=p_aluno_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATRICULA_NAO_ENCONTRADA' USING ERRCODE='P0002'; END IF;
  IF v_m.bolsa_integral OR coalesce(v_m.percentagem_desconto,0)<>0 THEN
    RAISE EXCEPTION 'BOLSA_PARCIAL_INCOMPATIVEL_COM_BENEFICIO_EXISTENTE' USING ERRCODE='23514';
  END IF;
  SELECT data_inicio,data_fim INTO v_ano_inicio,v_ano_fim FROM public.anos_letivos
   WHERE escola_id=p_escola_id AND ano=v_m.ano_letivo
   ORDER BY ativo DESC,created_at DESC LIMIT 1;
  v_inicio := coalesce(p_vigencia_inicio,
      (v_hoje + CASE WHEN p_percentagem=0 THEN interval '1 month' ELSE interval '0 months' END)::date);
  IF v_ano_inicio IS NULL OR v_ano_fim IS NULL
     OR v_inicio<>date_trunc('month',v_inicio)::date
     OR v_inicio<date_trunc('month',v_ano_inicio)::date
     OR v_inicio>date_trunc('month',v_ano_fim)::date
     OR (p_percentagem=0 AND v_inicio<v_hoje) THEN
    RAISE EXCEPTION 'BOLSA_VIGENCIA_FORA_DA_JANELA' USING ERRCODE='23514';
  END IF;
  v_retro := v_inicio<v_hoje;
  IF v_retro AND (NOT coalesce(p_regularizacao_retroativa,false)
      OR char_length(btrim(coalesce(p_justificativa,''))) NOT BETWEEN 10 AND 500) THEN
    RAISE EXCEPTION 'BOLSA_RETROATIVA_EXIGE_JUSTIFICATIVA' USING ERRCODE='23514';
  END IF;
  -- Não elevar retroativamente o valor de um título antes beneficiado, mesmo
  -- se o título ainda não foi gerado. Verifica toda a vigência anterior.
  IF v_retro AND EXISTS (
    SELECT 1 FROM generate_series(v_inicio::timestamp,(v_hoje-interval '1 month')::timestamp,interval '1 month') d
    WHERE public.klasse_percentagem_bolsa_parcial(v_m.bolsa_parcial_periodos,d::date)>p_percentagem
  ) THEN RAISE EXCEPTION 'BOLSA_RETROATIVA_NAO_PODE_REDUZIR_BENEFICIO' USING ERRCODE='23514'; END IF;
  v_motivo := CASE WHEN p_percentagem>0 THEN left(coalesce(nullif(btrim(p_motivo),''),'Bolsa parcial'),160) ELSE NULL END;
  SELECT coalesce(jsonb_agg(item ORDER BY n),'[]'::jsonb) INTO v_periodos
    FROM jsonb_array_elements(v_m.bolsa_parcial_periodos) WITH ORDINALITY p(item,n)
    WHERE (item->>'inicio')::date<v_inicio;
  v_periodos := v_periodos || jsonb_build_array(jsonb_build_object(
    'inicio',v_inicio,'percentagem',p_percentagem,'motivo',v_motivo));
  UPDATE public.matriculas SET bolsa_parcial_periodos=v_periodos,
    bolsa_parcial_percentagem=p_percentagem,updated_at=now()
    WHERE id=v_m.id AND escola_id=p_escola_id;

  -- Bloqueia os títulos antes de inspecionar pagamentos. Não reescreve
  -- pagamentos, documentos, parcelas já liquidadas ou descontos manuais.
  FOR v_me IN SELECT me.* FROM public.mensalidades me
    WHERE me.escola_id=p_escola_id AND me.aluno_id=p_aluno_id
      AND (me.matricula_id=v_m.id OR (me.matricula_id IS NULL
        AND me.turma_id=v_m.turma_id AND me.ano_letivo=v_m.ano_letivo::text))
      AND date_trunc('month',me.data_vencimento)::date BETWEEN v_inicio AND date_trunc('month',v_ano_fim)::date
      AND me.status::text IN ('pendente','atrasado','pago_parcial')
    ORDER BY me.id FOR UPDATE
  LOOP
    v_anterior := public.klasse_percentagem_bolsa_parcial(v_m.bolsa_parcial_periodos,v_me.data_vencimento);
    IF v_anterior=p_percentagem THEN CONTINUE; END IF;
    v_bruto := v_me.valor_original;
    IF v_me.status::text='pago_parcial' OR coalesce(v_me.valor_pago_total,0)<>0
       OR v_me.fiscal_documento_id IS NOT NULL OR coalesce(v_me.status_fiscal,'pending')<>'pending'
       OR EXISTS (SELECT 1 FROM public.pagamentos pg WHERE pg.mensalidade_id=v_me.id)
       OR EXISTS (SELECT 1 FROM public.documentos_emitidos d WHERE d.escola_id=p_escola_id AND d.mensalidade_id=v_me.id)
       OR v_bruto IS NULL OR v_bruto<0.01
       OR coalesce(v_me.valor_previsto,v_me.valor) IS DISTINCT FROM greatest(0.01,round(v_bruto*(1-v_anterior/100),2))
       OR coalesce(v_me.desconto_aplicado,0) IS DISTINCT FROM v_bruto-greatest(0.01,round(v_bruto*(1-v_anterior/100),2))
    THEN v_revisoes := v_revisoes+1; CONTINUE; END IF;
    v_liquido := greatest(0.01,round(v_bruto*(1-p_percentagem/100),2));
    UPDATE public.mensalidades SET valor=v_liquido,valor_previsto=v_liquido,
      desconto_aplicado=v_bruto-v_liquido
      WHERE id=v_me.id AND escola_id=p_escola_id;
    v_alteradas := v_alteradas+1;
  END LOOP;
  INSERT INTO public.audit_logs(escola_id,actor_id,action,entity,entity_id,portal,details)
    VALUES(p_escola_id,auth.uid(),'BOLSA_PARCIAL_ATUALIZADA','matriculas',p_matricula_id::text,'secretaria',
      jsonb_build_object('aluno_id',p_aluno_id,'ano_letivo',v_m.ano_letivo,
       'percentagem_anterior',v_m.bolsa_parcial_percentagem,'percentagem',p_percentagem,
       'atual',p_percentagem>0,'vigencia_inicio',v_inicio,'motivo',v_motivo,
       'justificativa_retroativa',CASE WHEN v_retro THEN btrim(p_justificativa) END,
       'alteradas',v_alteradas,'pendentes_revisao_pagamento',v_revisoes));
  RETURN jsonb_build_object('ok',true,'percentagem',p_percentagem,'bolseiro',p_percentagem>0,
    'vigencia_inicio',v_inicio,'alteradas',v_alteradas,'pendentes_revisao_pagamento',v_revisoes);
END;
$$;
REVOKE ALL ON FUNCTION public.klasse_definir_bolsa_parcial(uuid,uuid,uuid,numeric,text,date,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.klasse_definir_bolsa_parcial(uuid,uuid,uuid,numeric,text,date,boolean,text) TO authenticated;
-- Scholarship and family discounts cannot be stacked. Skip scholarship history
-- on the original family engine, without interrupting other family members.
CREATE OR REPLACE FUNCTION public.aplicar_desconto_familiar_interno(p_escola_id uuid, p_ano_letivo_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_matricula record;
  v_total integer;
  v_percent numeric;
  v_aplicados integer := 0;
  v_mensalidades integer := 0;
  v_changed integer;
BEGIN
  FOR v_matricula IN
    SELECT m.id, m.aluno_id, af.id AS agregado_id,
           COALESCE(m.motivo_desconto, '') AS motivo_desconto
    FROM public.matriculas m
    JOIN public.financeiro_agregados_membros am ON am.aluno_id = m.aluno_id
    JOIN public.financeiro_agregados_familiares af
      ON af.id = am.agregado_id AND af.escola_id = m.escola_id
    WHERE m.escola_id = p_escola_id
      AND m.session_id = p_ano_letivo_id
      AND m.status IN ('ativa', 'ativo', 'active', 'matriculado')
      AND NOT m.bolsa_integral AND m.bolsa_parcial_periodos='[]'::jsonb
    ORDER BY m.id
  LOOP
    SELECT COUNT(DISTINCT m2.aluno_id)::integer INTO v_total
    FROM public.matriculas m2
    JOIN public.financeiro_agregados_membros am2 ON am2.aluno_id = m2.aluno_id
    WHERE am2.agregado_id = v_matricula.agregado_id
      AND m2.escola_id = p_escola_id
      AND m2.session_id = p_ano_letivo_id
      AND m2.status IN ('ativa', 'ativo', 'active', 'matriculado');

    SELECT p.percentagem INTO v_percent
    FROM public.financeiro_politicas_desconto_familiar p
    WHERE p.escola_id = p_escola_id AND p.ano_letivo_id = p_ano_letivo_id
      AND p.ativo AND p.minimo_filhos <= v_total
    ORDER BY p.minimo_filhos DESC LIMIT 1;
    v_percent := COALESCE(v_percent, 0);

    IF v_matricula.motivo_desconto <> ''
       AND v_matricula.motivo_desconto NOT LIKE 'Desconto familiar automático%' THEN
      CONTINUE;
    END IF;

    UPDATE public.matriculas SET
      percentagem_desconto = v_percent,
      motivo_desconto = CASE WHEN v_percent > 0
        THEN format('Desconto familiar automático · %s filhos', v_total) ELSE NULL END,
      updated_at = now()
    WHERE id = v_matricula.id AND escola_id = p_escola_id
      AND NOT bolsa_integral AND bolsa_parcial_periodos='[]'::jsonb;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    -- Recheck after obtaining the row lock: a scholarship may have been assigned concurrently.
    IF v_changed = 0 THEN CONTINUE; END IF;

    UPDATE public.mensalidades SET
      valor_original = COALESCE(valor_original, valor),
      desconto_aplicado = ROUND(COALESCE(valor_original, valor) * v_percent / 100, 2),
      valor = ROUND(COALESCE(valor_original, valor) * (1 - v_percent / 100), 2),
      valor_previsto = ROUND(COALESCE(valor_original, valor) * (1 - v_percent / 100), 2),
      observacoes = CASE WHEN v_percent > 0
        THEN format('Desconto familiar automático: %s%% (%s filhos)', v_percent, v_total)
        ELSE NULL END,
      updated_at = now()
    WHERE matricula_id = v_matricula.id AND escola_id = p_escola_id
      AND status = 'pendente' AND COALESCE(valor_pago_total, 0) = 0;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    v_mensalidades := v_mensalidades + v_changed;
    v_aplicados := v_aplicados + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'matriculas_aplicadas', v_aplicados, 'mensalidades_atualizadas', v_mensalidades);
END;
$function$;
REVOKE ALL ON FUNCTION public.aplicar_desconto_familiar_interno(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_desconto_familiar_interno(uuid,uuid) TO service_role;

-- Legacy super-admin repricing changes settled payments and accounting entries.
-- For scholarships, allow classification only, with both repricing flags off.
CREATE OR REPLACE FUNCTION public.super_admin_reclassificar_aluno_turma(p_matricula_id uuid, p_turma_destino_id uuid, p_reprecificar_abertas boolean DEFAULT true, p_reprecificar_pagas boolean DEFAULT false, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_matricula record;
  v_turma_destino record;
  v_turma_origem_id uuid;
  v_tabela_id uuid;
  v_valor_novo numeric;
  v_matriculas_atualizadas int := 0;
  v_mensalidades_turma_atualizadas int := 0;
  v_mensalidades_abertas_reprecificadas int := 0;
  v_mensalidades_pagas_reprecificadas int := 0;
  v_pagamentos_reprecificados int := 0;
  v_lancamentos_reprecificados int := 0;
BEGIN
  IF NOT public.check_super_admin_role() THEN
    RAISE EXCEPTION 'Somente Super Admin pode reclassificar aluno.';
  END IF;

  SELECT
    m.id,
    m.escola_id,
    m.aluno_id,
    m.turma_id,
    m.ano_letivo,
    m.status,
    m.bolsa_integral,
    m.bolsa_parcial_periodos
    INTO v_matricula
  FROM public.matriculas m
  WHERE m.id = p_matricula_id FOR UPDATE;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'Matrícula não encontrada.';
  END IF;

  IF (v_matricula.bolsa_integral OR v_matricula.bolsa_parcial_periodos <> '[]'::jsonb)
     AND (coalesce(p_reprecificar_abertas,false) OR coalesce(p_reprecificar_pagas,false)) THEN
    RAISE EXCEPTION 'BOLSA_RECLASSIFICACAO_SEM_REPRECO: desative o recálculo de propinas e reveja os títulos separadamente.' USING ERRCODE='23514';
  END IF;

  SELECT
    t.id,
    t.escola_id,
    t.nome,
    t.curso_id,
    t.classe_id,
    t.ano_letivo
    INTO v_turma_destino
  FROM public.turmas t
  WHERE t.id = p_turma_destino_id;

  IF v_turma_destino.id IS NULL THEN
    RAISE EXCEPTION 'Turma destino não encontrada.';
  END IF;

  IF v_turma_destino.escola_id IS DISTINCT FROM v_matricula.escola_id THEN
    RAISE EXCEPTION 'Turma destino pertence a outra escola.';
  END IF;

  IF v_turma_destino.ano_letivo IS NOT NULL
     AND v_matricula.ano_letivo IS NOT NULL
     AND v_turma_destino.ano_letivo::int IS DISTINCT FROM v_matricula.ano_letivo::int THEN
    RAISE EXCEPTION 'Turma destino pertence a outro ano letivo.';
  END IF;

  SELECT ft.id, ft.valor_mensalidade
    INTO v_tabela_id, v_valor_novo
  FROM public.financeiro_tabelas ft
  WHERE ft.escola_id = v_matricula.escola_id
    AND ft.ano_letivo = v_matricula.ano_letivo
    AND ft.curso_id = v_turma_destino.curso_id
    AND ft.classe_id = v_turma_destino.classe_id
  ORDER BY ft.updated_at DESC NULLS LAST, ft.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_tabela_id IS NULL THEN
    SELECT ft.id, ft.valor_mensalidade
      INTO v_tabela_id, v_valor_novo
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id
      AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id = v_turma_destino.curso_id
      AND ft.classe_id IS NULL
    ORDER BY ft.updated_at DESC NULLS LAST, ft.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_tabela_id IS NULL THEN
    SELECT ft.id, ft.valor_mensalidade
      INTO v_tabela_id, v_valor_novo
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id
      AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id IS NULL
      AND ft.classe_id = v_turma_destino.classe_id
    ORDER BY ft.updated_at DESC NULLS LAST, ft.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_tabela_id IS NULL THEN
    SELECT ft.id, ft.valor_mensalidade
      INTO v_tabela_id, v_valor_novo
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id
      AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id IS NULL
      AND ft.classe_id IS NULL
    ORDER BY ft.updated_at DESC NULLS LAST, ft.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF (p_reprecificar_abertas OR p_reprecificar_pagas) AND v_valor_novo IS NULL THEN
    RAISE EXCEPTION 'Tabela de propina não encontrada para a turma destino.';
  END IF;

  v_turma_origem_id := v_matricula.turma_id;

  UPDATE public.matriculas m
  SET turma_id = p_turma_destino_id,
      updated_at = now()
  WHERE m.id = p_matricula_id
    AND m.turma_id IS DISTINCT FROM p_turma_destino_id;
  GET DIAGNOSTICS v_matriculas_atualizadas = ROW_COUNT;

  UPDATE public.mensalidades mn
  SET turma_id = p_turma_destino_id,
      updated_at = now()
  WHERE mn.matricula_id = p_matricula_id
    AND mn.escola_id = v_matricula.escola_id
    AND mn.turma_id IS DISTINCT FROM p_turma_destino_id;
  GET DIAGNOSTICS v_mensalidades_turma_atualizadas = ROW_COUNT;

  IF p_reprecificar_abertas THEN
    UPDATE public.mensalidades mn
    SET valor = v_valor_novo,
        valor_previsto = v_valor_novo,
        tabela_id = v_tabela_id,
        status = 'pendente',
        updated_at = now()
    WHERE mn.matricula_id = p_matricula_id
      AND mn.escola_id = v_matricula.escola_id
      AND mn.status IN ('pendente', 'pago_parcial', 'atrasado', 'parcial', 'isento')
      AND coalesce(mn.valor_pago_total, 0) = 0;
    GET DIAGNOSTICS v_mensalidades_abertas_reprecificadas = ROW_COUNT;
  END IF;

  IF p_reprecificar_pagas THEN
    WITH mensalidades_pagas AS (
      UPDATE public.mensalidades mn
      SET valor = v_valor_novo,
          valor_previsto = v_valor_novo,
          valor_pago_total = v_valor_novo,
          tabela_id = v_tabela_id,
          updated_at = now()
      WHERE mn.matricula_id = p_matricula_id
        AND mn.escola_id = v_matricula.escola_id
        AND mn.status = 'pago'
      RETURNING mn.id
    ),
    pagamentos_atualizados AS (
      UPDATE public.pagamentos p
      SET valor_pago = v_valor_novo,
          updated_at = now(),
          meta = coalesce(p.meta, '{}'::jsonb) || jsonb_build_object(
            'correcao_valor_propina', 'reclassificacao_turma',
            'valor_corrigido', v_valor_novo,
            'turma_destino_id', p_turma_destino_id,
            'corrigido_por', 'super_admin_tool',
            'corrigido_em', now()
          )
      FROM mensalidades_pagas mp
      WHERE p.mensalidade_id = mp.id
        AND p.status IN ('settled', 'concluido', 'pago')
      RETURNING p.id
    )
    SELECT
      (SELECT count(*) FROM mensalidades_pagas),
      (SELECT count(*) FROM pagamentos_atualizados)
      INTO v_mensalidades_pagas_reprecificadas, v_pagamentos_reprecificados;
  END IF;

  IF p_reprecificar_abertas OR p_reprecificar_pagas THEN
    UPDATE public.financeiro_lancamentos fl
    SET valor_original = v_valor_novo,
        updated_at = now()
    WHERE fl.matricula_id = p_matricula_id
      AND fl.origem::text = 'mensalidade'
      AND (
        (p_reprecificar_pagas AND fl.status::text IN ('pago', 'concluido', 'settled'))
        OR (p_reprecificar_abertas AND fl.status::text IN ('pendente', 'pago_parcial', 'atrasado', 'parcial'))
      );
    GET DIAGNOSTICS v_lancamentos_reprecificados = ROW_COUNT;
  END IF;

  INSERT INTO public.audit_logs (escola_id, user_id, action, entity, entity_id, portal, details)
  VALUES (
    v_matricula.escola_id,
    auth.uid(),
    'SUPER_ADMIN_RECLASSIFICAR_ALUNO_TURMA',
    'matriculas',
    p_matricula_id::text,
    'super_admin',
    jsonb_build_object(
      'aluno_id', v_matricula.aluno_id,
      'turma_origem_id', v_turma_origem_id,
      'turma_destino_id', p_turma_destino_id,
      'turma_destino_nome', v_turma_destino.nome,
      'tabela_id', v_tabela_id,
      'valor_novo', v_valor_novo,
      'reprecificar_abertas', p_reprecificar_abertas,
      'reprecificar_pagas', p_reprecificar_pagas,
      'motivo', p_motivo,
      'matriculas_atualizadas', v_matriculas_atualizadas,
      'mensalidades_turma_atualizadas', v_mensalidades_turma_atualizadas,
      'mensalidades_abertas_reprecificadas', v_mensalidades_abertas_reprecificadas,
      'mensalidades_pagas_reprecificadas', v_mensalidades_pagas_reprecificadas,
      'pagamentos_reprecificados', v_pagamentos_reprecificados,
      'lancamentos_reprecificados', v_lancamentos_reprecificados
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'matricula_id', p_matricula_id,
    'aluno_id', v_matricula.aluno_id,
    'turma_origem_id', v_turma_origem_id,
    'turma_destino_id', p_turma_destino_id,
    'turma_destino_nome', v_turma_destino.nome,
    'tabela_id', v_tabela_id,
    'valor_novo', v_valor_novo,
    'matriculas_atualizadas', v_matriculas_atualizadas,
    'mensalidades_turma_atualizadas', v_mensalidades_turma_atualizadas,
    'mensalidades_abertas_reprecificadas', v_mensalidades_abertas_reprecificadas,
    'mensalidades_pagas_reprecificadas', v_mensalidades_pagas_reprecificadas,
    'pagamentos_reprecificados', v_pagamentos_reprecificados,
    'lancamentos_reprecificados', v_lancamentos_reprecificados
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.super_admin_reclassificar_aluno_turma(uuid,uuid,boolean,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.super_admin_reclassificar_aluno_turma(uuid,uuid,boolean,boolean,text) TO authenticated,service_role;

-- Fail closed if another price writer attempts to erase the scholarship.
-- Do not silently rewrite an arbitrary manual adjustment or a payment.
CREATE FUNCTION public.klasse_proteger_repreco_bolsa_parcial()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $$
DECLARE
  v_periodos jsonb;
  v_taxa numeric;
  v_valor numeric;
BEGIN
  IF ROW(NEW.valor,NEW.valor_previsto,NEW.valor_original,NEW.desconto_aplicado)
      IS NOT DISTINCT FROM ROW(OLD.valor,OLD.valor_previsto,OLD.valor_original,OLD.desconto_aplicado) THEN
    RETURN NEW;
  END IF;
  SELECT m.bolsa_parcial_periodos INTO v_periodos
    FROM public.matriculas m
    WHERE m.escola_id=OLD.escola_id AND m.aluno_id=OLD.aluno_id
      AND (m.id=OLD.matricula_id OR (OLD.matricula_id IS NULL
        AND m.ano_letivo::text=OLD.ano_letivo AND m.turma_id=OLD.turma_id))
    ORDER BY m.created_at DESC LIMIT 1;
  IF v_periodos IS NULL OR v_periodos='[]'::jsonb THEN RETURN NEW; END IF;
  IF OLD.status::text NOT IN ('pendente','atrasado')
     OR coalesce(OLD.valor_pago_total,0)<>0
     OR OLD.fiscal_documento_id IS NOT NULL
     OR coalesce(OLD.status_fiscal,'pending')<>'pending'
     OR EXISTS(SELECT 1 FROM public.pagamentos p WHERE p.mensalidade_id=OLD.id)
     OR EXISTS(SELECT 1 FROM public.documentos_emitidos d WHERE d.escola_id=OLD.escola_id AND d.mensalidade_id=OLD.id)
  THEN RAISE EXCEPTION 'BOLSA_REPRECO_TITULO_PROTEGIDO' USING ERRCODE='23514'; END IF;
  v_taxa := public.klasse_percentagem_bolsa_parcial(v_periodos,NEW.data_vencimento);
  IF v_taxa=0 THEN RETURN NEW; END IF;
  IF NEW.valor_original IS NULL OR NEW.valor_original<0.01 THEN
    RAISE EXCEPTION 'BOLSA_REPRECO_BASE_INVALIDA' USING ERRCODE='23514';
  END IF;
  v_valor := greatest(0.01,round(NEW.valor_original*(1-v_taxa/100),2));
  IF NEW.valor IS DISTINCT FROM v_valor OR NEW.valor_previsto IS DISTINCT FROM v_valor
     OR NEW.desconto_aplicado IS DISTINCT FROM NEW.valor_original-v_valor THEN
    RAISE EXCEPTION 'BOLSA_REPRECO_INCOMPATIVEL: preserve a percentagem e a vigência.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.klasse_proteger_repreco_bolsa_parcial() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_07_proteger_repreco_bolsa_parcial
 BEFORE UPDATE OF valor,valor_previsto,valor_original,desconto_aplicado ON public.mensalidades
 FOR EACH ROW EXECUTE FUNCTION public.klasse_proteger_repreco_bolsa_parcial();

COMMIT;
