-- Anexo de notas ao histórico legalmente fechado: nunca altera a decisão ratificada
-- nem o snapshot de historico_anos/historico_disciplinas.
BEGIN;

CREATE TABLE IF NOT EXISTS public.historico_notas_complementares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id),
  historico_ano_id uuid NOT NULL REFERENCES public.historico_anos(id),
  matricula_id uuid NOT NULL REFERENCES public.matriculas(id),
  disciplina_id uuid NOT NULL REFERENCES public.disciplinas_catalogo(id),
  trimestre smallint NOT NULL CHECK (trimestre BETWEEN 1 AND 3),
  tipo_avaliacao text NOT NULL CHECK (tipo_avaliacao IN ('MAC','NPP','NPT')),
  valor numeric(5,2) NOT NULL CHECK (valor BETWEEN 0 AND 20),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT historico_nota_complementar_unica UNIQUE
    (escola_id,matricula_id,disciplina_id,trimestre,tipo_avaliacao)
);
CREATE INDEX IF NOT EXISTS historico_notas_complementares_por_historico
  ON public.historico_notas_complementares (escola_id,historico_ano_id);
ALTER TABLE public.historico_notas_complementares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.historico_notas_complementares FROM PUBLIC,anon,authenticated;

-- Apenas consulta e gravação pelas RPCs. Não há UPDATE/DELETE nem upsert
-- de notas oficiais ou de um anexo já gravado.
CREATE OR REPLACE FUNCTION public.balcao_obter_notas_complementares(
  p_escola_id uuid, p_matricula_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_h record;
  v_m record;
  v_list jsonb;
  v_escala text;
BEGIN
  IF v_actor IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
    OR NOT EXISTS (
      SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
        AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
    ) THEN
    RAISE EXCEPTION 'AUTH: sem autorização académica nesta escola' USING ERRCODE='42501';
  END IF;
  SELECT m.id,m.aluno_id,m.ano_letivo,m.turma_id,m.session_id,m.status
    INTO v_m FROM public.matriculas m
    WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DATA: matrícula não encontrada nesta escola' USING ERRCODE='22023'; END IF;
  SELECT h.id,h.snapshot_status,h.resultado_final INTO v_h
    FROM public.historico_anos h
    WHERE h.escola_id=p_escola_id AND h.matricula_id=v_m.id
      AND h.aluno_id=v_m.aluno_id AND h.ano_letivo=v_m.ano_letivo
      AND h.turma_id=v_m.turma_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DATA: histórico oficial não encontrado' USING ERRCODE='22023'; END IF;
  v_escala:=coalesce(public.resolve_regime_academico(v_m.turma_id)->>'escala','');
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'disciplina_id', hd.disciplina_id,
    'nome', coalesce(nullif(hd.disciplina_nome,''), dc.nome),
    'nota_final', hd.nota_final,
    'media_final', hd.media_final,
    'referencia', hd.notas_detalhe->>'arquivo',
    'notas', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'trimestre', n.trimestre, 'tipo', n.tipo, 'valor', n.valor, 'fonte', n.fonte)
        ORDER BY n.trimestre,n.tipo), '[]'::jsonb)
      FROM (
        SELECT c.trimestre,c.tipo_avaliacao AS tipo,c.valor,'complementacao'::text AS fonte
        FROM public.historico_notas_complementares c
        WHERE c.escola_id=p_escola_id AND c.historico_ano_id=v_h.id
          AND c.matricula_id=v_m.id AND c.disciplina_id=hd.disciplina_id
        UNION ALL
        SELECT a.trimestre,
          CASE WHEN upper(btrim(a.tipo))='PT' THEN 'NPT' ELSE upper(btrim(a.tipo)) END AS tipo,
          nt.valor,'operacional'::text AS fonte
        FROM public.notas nt
        JOIN public.avaliacoes a ON a.id=nt.avaliacao_id AND a.escola_id=nt.escola_id
        JOIN public.turma_disciplinas td ON td.id=a.turma_disciplina_id AND td.escola_id=a.escola_id
        JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
        WHERE nt.escola_id=p_escola_id AND nt.matricula_id=v_m.id
          AND cm.disciplina_id=hd.disciplina_id
          AND a.ano_letivo=v_m.ano_letivo
          AND nt.valor IS NOT NULL
      ) n
    )
  ) ORDER BY coalesce(nullif(hd.disciplina_nome,''),dc.nome)), '[]'::jsonb) INTO v_list
  FROM public.historico_disciplinas hd
  LEFT JOIN public.disciplinas_catalogo dc ON dc.id=hd.disciplina_id AND dc.escola_id=p_escola_id
  WHERE hd.historico_ano_id=v_h.id;
  RETURN jsonb_build_object('ok',true,'matricula_id',v_m.id,'ano',v_m.ano_letivo,
    'resultado_oficial',v_h.resultado_final,'historico_fechado',v_h.snapshot_status='fechado',
    'pode_complementar',v_m.status='concluido' AND v_h.snapshot_status='fechado' AND v_h.resultado_final IS NOT NULL
      AND (SELECT y.ativo FROM public.anos_letivos y WHERE y.id=v_m.session_id AND y.escola_id=p_escola_id) IS FALSE
      AND v_escala IN ('quantitativa_primario','quantitativa_secundario')
      AND EXISTS (
        SELECT 1 FROM public.historico_snapshot_locks l
        WHERE l.escola_id=p_escola_id AND l.matricula_id=v_m.id
          AND l.historico_ano_id=v_h.id AND l.ano_letivo_id=v_m.session_id AND l.status='fechado'
      ),
    'escala',v_escala,'nota_maxima',
      CASE WHEN v_escala='quantitativa_primario' THEN 10 WHEN v_escala='quantitativa_secundario' THEN 20 ELSE NULL END,
    'disciplinas',v_list);
END;
$$;

CREATE OR REPLACE FUNCTION public.balcao_complementar_notas_historicas(
  p_escola_id uuid, p_matricula_id uuid, p_notas jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $$
DECLARE
  v_actor uuid := public.safe_auth_uid();
  v_m record;
  v_h record;
  v_escala text;
  v_max numeric;
  v_note jsonb;
  v_disc uuid;
  v_tipo text;
  v_term integer;
  v_value numeric;
  v_inserted integer := 0;
  v_reused integer := 0;
  v_count integer;
BEGIN
  IF v_actor IS NULL OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
    OR NOT EXISTS (
      SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
        AND eu.papel IN ('secretaria','admin_secretaria','admin_secretario','admin_financeiro','admin','admin_escola','staff_admin','diretor')
    ) THEN RAISE EXCEPTION 'AUTH: sem autorização académica nesta escola' USING ERRCODE='42501'; END IF;

  IF p_notas IS NULL OR jsonb_typeof(p_notas)<>'array'
    OR jsonb_array_length(p_notas)<1 OR jsonb_array_length(p_notas)>100 THEN
    RAISE EXCEPTION 'DATA: selecione entre 1 e 100 notas' USING ERRCODE='22023';
  END IF;
  SELECT m.id,m.aluno_id,m.turma_id,m.session_id,m.ano_letivo,m.status,y.ativo AS ano_ativo
  INTO v_m FROM public.matriculas m JOIN public.anos_letivos y
    ON y.id=m.session_id AND y.escola_id=m.escola_id AND y.ano=m.ano_letivo
  WHERE m.id=p_matricula_id AND m.escola_id=p_escola_id
  FOR UPDATE OF m;
  IF NOT FOUND OR v_m.status<>'concluido' OR v_m.ano_ativo IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'HISTORIC_SOURCE_INVALID: matrícula concluída de ano encerrado obrigatória' USING ERRCODE='23514';
  END IF;
  SELECT h.id,h.snapshot_status,h.resultado_final INTO v_h
    FROM public.historico_anos h
    WHERE h.escola_id=p_escola_id AND h.matricula_id=v_m.id
      AND h.aluno_id=v_m.aluno_id AND h.ano_letivo=v_m.ano_letivo
      AND h.turma_id=v_m.turma_id FOR UPDATE;
  IF NOT FOUND OR v_h.snapshot_status<>'fechado' OR v_h.resultado_final IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.historico_snapshot_locks l
       WHERE l.escola_id=p_escola_id AND l.matricula_id=v_m.id AND l.historico_ano_id=v_h.id
         AND l.ano_letivo_id=v_m.session_id AND l.status='fechado') THEN
    RAISE EXCEPTION 'HISTORIC_LEGAL_LOCK_REQUIRED: é obrigatório histórico ratificado e fechado' USING ERRCODE='23514';
  END IF;
  v_escala:=coalesce(public.resolve_regime_academico(v_m.turma_id)->>'escala','');
  v_max:=CASE v_escala WHEN 'quantitativa_primario' THEN 10
    WHEN 'quantitativa_secundario' THEN 20 ELSE NULL END;
  IF v_max IS NULL THEN
    RAISE EXCEPTION 'HISTORIC_SCALE_INVALID: notas numéricas não se aplicam a esta turma' USING ERRCODE='23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT x->>'disciplina_id' AS disc,x->>'trimestre' AS tr,x->>'tipo_avaliacao' AS kind
      FROM jsonb_array_elements(p_notas) x GROUP BY 1,2,3 HAVING count(*)>1
    ) duplicates
  ) THEN RAISE EXCEPTION 'DATA: mesma nota repetida no lote' USING ERRCODE='22023'; END IF;

  FOR v_note IN SELECT value FROM jsonb_array_elements(p_notas) LOOP
    IF jsonb_typeof(v_note)<>'object' OR jsonb_typeof(v_note->'valor')<>'number'
      OR jsonb_typeof(v_note->'trimestre')<>'number' THEN
      RAISE EXCEPTION 'DATA: nota ou trimestre inválido' USING ERRCODE='22023';
    END IF;
    BEGIN
      v_disc:=(v_note->>'disciplina_id')::uuid;
      v_term:=(v_note->>'trimestre')::integer;
      v_value:=(v_note->>'valor')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'DATA: disciplina, trimestre ou nota inválida' USING ERRCODE='22023';
    END;
    v_tipo:=upper(btrim(coalesce(v_note->>'tipo_avaliacao','')));
    IF v_term NOT BETWEEN 1 AND 3 OR v_tipo NOT IN ('MAC','NPP','NPT')
      OR v_value<0 OR v_value>v_max THEN
      RAISE EXCEPTION 'DATA: verifique trimestre, componente e nota na escala 0–%' ,v_max USING ERRCODE='22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.historico_disciplinas hd
      JOIN public.disciplinas_catalogo dc ON dc.id=hd.disciplina_id AND dc.escola_id=p_escola_id
      WHERE hd.historico_ano_id=v_h.id AND hd.disciplina_id=v_disc
    ) THEN
      RAISE EXCEPTION 'HISTORIC_DISCIPLINE_INVALID: disciplina não consta no histórico oficial' USING ERRCODE='23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.notas nt
      JOIN public.avaliacoes a ON a.id=nt.avaliacao_id AND a.escola_id=nt.escola_id
      JOIN public.turma_disciplinas td ON td.id=a.turma_disciplina_id AND td.escola_id=a.escola_id
      JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
      WHERE nt.escola_id=p_escola_id AND nt.matricula_id=v_m.id
        AND cm.disciplina_id=v_disc AND a.ano_letivo=v_m.ano_letivo
        AND a.trimestre=v_term
        AND (CASE WHEN upper(btrim(a.tipo))='PT' THEN 'NPT' ELSE upper(btrim(a.tipo)) END)=v_tipo
    ) THEN RAISE EXCEPTION 'HISTORIC_GRADE_ALREADY_EXISTS: esta avaliação já possui nota oficial' USING ERRCODE='23505';
    END IF;
    INSERT INTO public.historico_notas_complementares
      (escola_id,historico_ano_id,matricula_id,disciplina_id,trimestre,tipo_avaliacao,valor,created_by)
    VALUES (p_escola_id,v_h.id,v_m.id,v_disc,v_term,v_tipo,v_value,v_actor)
    ON CONFLICT (escola_id,matricula_id,disciplina_id,trimestre,tipo_avaliacao) DO NOTHING;
    GET DIAGNOSTICS v_count=ROW_COUNT;
    IF v_count=0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.historico_notas_complementares c
        WHERE c.escola_id=p_escola_id AND c.matricula_id=v_m.id AND c.disciplina_id=v_disc
          AND c.trimestre=v_term AND c.tipo_avaliacao=v_tipo AND c.valor=v_value
      ) THEN RAISE EXCEPTION 'HISTORIC_GRADE_ALREADY_EXISTS: nota complementar já lançada com outro valor' USING ERRCODE='23505'; END IF;
      v_reused:=v_reused+1;
    ELSE
      v_inserted:=v_inserted+1;
    END IF;
  END LOOP;

  IF v_inserted>0 THEN
    INSERT INTO public.audit_logs (escola_id,actor_id,action,entity,entity_id,portal,details)
    VALUES (p_escola_id,v_actor,'HISTORICO_NOTAS_COMPLEMENTARES_REGISTADAS',
      'historico_anos',v_h.id::text,'secretaria',
      jsonb_build_object('matricula_id',v_m.id,'ano_origem',v_m.ano_letivo,
        'resultado_oficial_preservado',v_h.resultado_final,'inseridas',v_inserted,
        'reutilizadas',v_reused,'origem','transcricao_pauta_fisica',
        'notas',p_notas));
  END IF;
  RETURN jsonb_build_object('ok',true,'inseridas',v_inserted,'reutilizadas',v_reused,
    'historico_ano_id',v_h.id,'resultado_oficial',v_h.resultado_final);
END;
$$;

REVOKE ALL ON FUNCTION public.balcao_obter_notas_complementares(uuid,uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.balcao_obter_notas_complementares(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.balcao_complementar_notas_historicas(uuid,uuid,jsonb)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.balcao_complementar_notas_historicas(uuid,uuid,jsonb) TO authenticated;
COMMIT;
