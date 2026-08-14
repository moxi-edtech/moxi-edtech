-- P0: toda solicitação e decisão de reabertura precisa deixar trilha append-only.
CREATE OR REPLACE FUNCTION public.audit_excecao_pauta_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.aprovado_por, NEW.solicitado_por, NEW.criado_por);
  v_action text;
BEGIN
  v_action := CASE
    WHEN TG_OP = 'INSERT' THEN 'PAUTA_REABERTURA_SOLICITADA'
    WHEN NEW.status = 'APROVADO' AND OLD.status IS DISTINCT FROM NEW.status THEN 'PAUTA_REABERTURA_APROVADA'
    WHEN NEW.status = 'REJEITADO' AND OLD.status IS DISTINCT FROM NEW.status THEN 'PAUTA_REABERTURA_REJEITADA'
    WHEN NEW.status = 'EXPIRADO' AND OLD.status IS DISTINCT FROM NEW.status THEN 'PAUTA_REABERTURA_EXPIRADA'
    ELSE 'PAUTA_REABERTURA_ATUALIZADA'
  END;

  INSERT INTO public.audit_logs (
    escola_id, user_id, actor_id, acao, action, tabela, entity, registro_id, entity_id,
    portal, details, meta, before, after
  ) VALUES (
    NEW.escola_id, v_actor, v_actor, v_action, v_action, 'excecoes_pauta', 'excecoes_pauta',
    NEW.id::text, NEW.id::text, 'academico',
    jsonb_build_object(
      'turma_id', NEW.turma_id,
      'disciplina_id', NEW.disciplina_id,
      'trimestre', NEW.trimestre,
      'solicitado_por', NEW.solicitado_por,
      'aprovado_por', NEW.aprovado_por,
      'status', NEW.status,
      'expira_em', NEW.expira_em
    ),
    jsonb_build_object('source', 'excecoes_pauta_trigger'),
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_excecoes_pauta_changes ON public.excecoes_pauta;
CREATE TRIGGER trg_audit_excecoes_pauta_changes
AFTER INSERT OR UPDATE ON public.excecoes_pauta
FOR EACH ROW EXECUTE FUNCTION public.audit_excecao_pauta_changes();
