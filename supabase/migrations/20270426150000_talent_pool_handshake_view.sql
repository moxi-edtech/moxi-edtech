BEGIN;

-- =====================================================
-- View anonima para consumo empresarial (sem PII)
-- =====================================================
CREATE OR REPLACE VIEW public.vw_talentos_publicos AS
SELECT
  t.aluno_id,
  t.escola_id,
  t.provincia,
  t.municipio,
  t.preferencia_trabalho,
  t.career_headline,
  t.skills_tags,
  t.anonymous_slug
FROM public.list_talent_pool_candidates(NULL, 100, 0) AS t;

ALTER VIEW public.vw_talentos_publicos SET (security_invoker = true);

REVOKE ALL ON TABLE public.vw_talentos_publicos FROM anon;
GRANT SELECT ON TABLE public.vw_talentos_publicos TO authenticated;

-- =====================================================
-- Handshake: notificar aluno quando ha pedido de entrevista
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_talent_pool_match_pending_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aluno record;
  v_evento_id uuid;
  v_empresa_label text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT a.id, a.escola_id, a.usuario_auth_id, a.profile_id
  INTO v_aluno
  FROM public.alunos a
  WHERE a.id = NEW.aluno_id
  LIMIT 1;

  IF v_aluno.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_empresa_label := coalesce(
    (
      SELECT ep.dominio_email
      FROM public.empresas_parceiras ep
      WHERE ep.id = NEW.empresa_id
      LIMIT 1
    ),
    'empresa parceira'
  );

  INSERT INTO public.eventos (
    escola_id,
    tipo,
    payload,
    actor_id,
    actor_role,
    entidade_tipo,
    entidade_id
  )
  VALUES (
    v_aluno.escola_id,
    'matricula.concluida',
    jsonb_build_object(
      'gatilho', 'talent_pool_match_pending',
      'match_id', NEW.id,
      'empresa_id', NEW.empresa_id,
      'empresa_label', v_empresa_label,
      'aluno_id', NEW.aluno_id
    ),
    NEW.empresa_id,
    'empresa',
    'talent_pool_match',
    NEW.id
  )
  RETURNING id INTO v_evento_id;

  PERFORM public.inserir_notificacao(
    v_aluno.escola_id,
    v_evento_id,
    coalesce(v_aluno.usuario_auth_id, v_aluno.profile_id),
    'Nova solicitacao de entrevista',
    'Uma ' || v_empresa_label || ' quer entrevistar-te. Aceita ou recusa na aba Carreira.',
    'aviso'::public.notificacao_prioridade,
    'Responder agora',
    '/aluno/carreira'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_talent_pool_match_pending_notify ON public.talent_pool_matches;
CREATE TRIGGER trg_talent_pool_match_pending_notify
AFTER INSERT ON public.talent_pool_matches
FOR EACH ROW
EXECUTE FUNCTION public.trg_talent_pool_match_pending_notify();

COMMIT;
