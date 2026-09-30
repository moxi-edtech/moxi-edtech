BEGIN;

CREATE TABLE IF NOT EXISTS public.promocoes_com_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  matricula_origem_id uuid NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  matricula_destino_id uuid REFERENCES public.matriculas(id) ON DELETE SET NULL,
  origem_ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id),
  destino_ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id),
  origem_turma_id uuid REFERENCES public.turmas(id),
  destino_turma_id uuid NOT NULL REFERENCES public.turmas(id),
  pendencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  motivo text NOT NULL,
  status text NOT NULL DEFAULT 'autorizada'
    CHECK (status IN ('autorizada', 'concluida', 'cancelada')),
  autorizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  autorizado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promocoes_com_pendencias_unique_origem_destino
    UNIQUE (escola_id, matricula_origem_id, destino_ano_letivo_id)
);

CREATE INDEX IF NOT EXISTS idx_promocoes_com_pendencias_queue
  ON public.promocoes_com_pendencias (escola_id, destino_ano_letivo_id, status, created_at);

ALTER TABLE public.promocoes_com_pendencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promocoes_com_pendencias_select ON public.promocoes_com_pendencias;
CREATE POLICY promocoes_com_pendencias_select
  ON public.promocoes_com_pendencias FOR SELECT TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor','admin_financeiro'])
  );

DROP POLICY IF EXISTS promocoes_com_pendencias_write ON public.promocoes_com_pendencias;
CREATE POLICY promocoes_com_pendencias_write
  ON public.promocoes_com_pendencias FOR ALL TO authenticated
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor'])
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.user_has_role_in_school(escola_id, ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor'])
  );

CREATE OR REPLACE FUNCTION public.autorizar_promocao_com_pendencias(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_matricula_origem_id uuid,
  p_destino_ano_letivo_id uuid,
  p_destino_turma_id uuid,
  p_motivo text DEFAULT 'Promoção autorizada com notas pendentes'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_origem record;
  v_destino record;
  v_raa jsonb;
  v_row public.promocoes_com_pendencias;
BEGIN
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
     OR NOT public.user_has_role_in_school(p_escola_id, ARRAY['admin','admin_escola','staff_admin','admin_secretaria','diretor']) THEN
    RAISE EXCEPTION 'AUTH: permissão negada para autorizar promoção com pendências';
  END IF;

  SELECT m.id, m.aluno_id, m.ano_letivo, m.session_id, m.turma_id,
         t.ano_letivo AS turma_ano
    INTO v_origem
  FROM public.matriculas m
  LEFT JOIN public.turmas t ON t.id = m.turma_id
  WHERE m.id = p_matricula_origem_id
    AND m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id;
  IF v_origem.id IS NULL THEN
    RAISE EXCEPTION 'Matrícula de origem não encontrada';
  END IF;

  SELECT al.id, al.ano, t.id AS turma_id, t.ano_letivo, t.session_id
    INTO v_destino
  FROM public.anos_letivos al
  JOIN public.turmas t ON t.session_id = al.id AND t.id = p_destino_turma_id
  WHERE al.id = p_destino_ano_letivo_id
    AND al.escola_id = p_escola_id
    AND al.ativo = true
    AND t.escola_id = p_escola_id
    AND t.ano_letivo = al.ano;
  IF v_destino.id IS NULL THEN
    RAISE EXCEPTION 'Turma destino não pertence ao ano letivo seleccionado';
  END IF;
  IF coalesce(v_origem.ano_letivo, v_origem.turma_ano) IS NULL
     OR coalesce(v_origem.ano_letivo, v_origem.turma_ano) >= v_destino.ano THEN
    RAISE EXCEPTION 'Matrícula de origem não é de um ano anterior';
  END IF;

  v_raa := public.resolve_raa_progression_for_matricula(p_escola_id, p_matricula_origem_id);
  IF v_raa->>'decision' IS DISTINCT FROM 'pendente' THEN
    RAISE EXCEPTION 'A matrícula não possui notas pendentes que exijam autorização';
  END IF;

  INSERT INTO public.promocoes_com_pendencias (
    escola_id, aluno_id, matricula_origem_id, origem_ano_letivo_id,
    destino_ano_letivo_id, origem_turma_id, destino_turma_id,
    pendencias, motivo, autorizado_por
  ) VALUES (
    p_escola_id, p_aluno_id, p_matricula_origem_id, v_origem.session_id,
    p_destino_ano_letivo_id, v_origem.turma_id, p_destino_turma_id,
    coalesce(v_raa->'disciplina_ids_pendentes', '[]'::jsonb),
    coalesce(nullif(trim(p_motivo), ''), 'Promoção autorizada com notas pendentes'), v_actor
  )
  ON CONFLICT (escola_id, matricula_origem_id, destino_ano_letivo_id)
  DO UPDATE SET
    destino_turma_id = EXCLUDED.destino_turma_id,
    pendencias = EXCLUDED.pendencias,
    motivo = EXCLUDED.motivo,
    status = 'autorizada',
    autorizado_por = EXCLUDED.autorizado_por,
    autorizado_em = now(),
    updated_at = now()
  RETURNING * INTO v_row;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (
    p_escola_id, v_actor, 'PROMOCAO_COM_PENDENCIAS_AUTORIZADA',
    'promocoes_com_pendencias', v_row.id::text,
    jsonb_build_object('aluno_id', p_aluno_id, 'matricula_origem_id', p_matricula_origem_id,
      'destino_ano_letivo_id', p_destino_ano_letivo_id, 'destino_turma_id', p_destino_turma_id,
      'pendencias', v_row.pendencias, 'at', now()), 'secretaria'
  );

  RETURN jsonb_build_object('ok', true, 'id', v_row.id, 'pendencias', v_row.pendencias, 'motivo', v_row.motivo);
END;
$$;

REVOKE ALL ON FUNCTION public.autorizar_promocao_com_pendencias(uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.autorizar_promocao_com_pendencias(uuid, uuid, uuid, uuid, uuid, text) TO authenticated;

-- A autorização humana transforma o estado RAA pendente numa transição
-- condicional. As notas continuam pendentes e ficam no registo de autorização.
CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula(
  p_escola_id uuid,
  p_matricula_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_legal jsonb;
  v_authorized record;
BEGIN
  SELECT id, pendencias, motivo INTO v_authorized
  FROM public.promocoes_com_pendencias
  WHERE escola_id = p_escola_id
    AND matricula_origem_id = p_matricula_id
    AND status = 'autorizada'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_authorized.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'decision', 'transitou',
      'destino', 'proxima_etapa',
      'motivo', 'promovido_com_pendencias',
      'autorizacao_id', v_authorized.id,
      'disciplina_ids_pendentes', v_authorized.pendencias,
      'proximo_passo', 'Lançar e fechar as notas pendentes da matrícula de origem.'
    );
  END IF;

  v_legal := public.resolve_raa_decreto_for_matricula(p_escola_id, p_matricula_id);
  IF v_legal IS NOT NULL THEN
    RETURN v_legal;
  END IF;

  BEGIN
    RETURN public.resolve_raa_progression_for_matricula_generic(p_escola_id, p_matricula_id);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%RAA_PROGRESSION_POLICY_NOT_CONFIGURED%' THEN
      RETURN jsonb_build_object(
        'decision', 'pendente', 'destino', 'aguardar_dados', 'motivo', 'dados_pendentes',
        'disciplina_ids_pendentes', '[]'::jsonb,
        'proximo_passo', 'Configurar a política de progressão e concluir as notas finais da matrícula.'
      );
    END IF;
    RAISE;
  END;
END;
$$;

COMMIT;
