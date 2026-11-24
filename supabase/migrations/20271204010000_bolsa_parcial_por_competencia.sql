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
COMMIT;
