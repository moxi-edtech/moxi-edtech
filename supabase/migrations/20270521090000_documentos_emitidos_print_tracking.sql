BEGIN;

ALTER TABLE public.documentos_emitidos
  ADD COLUMN IF NOT EXISTS print_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_printed_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.increment_documento_print(
  p_doc_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_actor_email text DEFAULT NULL
)
RETURNS TABLE (print_count integer, last_printed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc public.documentos_emitidos%ROWTYPE;
BEGIN
  UPDATE public.documentos_emitidos
  SET print_count = COALESCE(print_count, 0) + 1,
      last_printed_at = NOW()
  WHERE id = p_doc_id
  RETURNING * INTO v_doc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCUMENTO_NOT_FOUND';
  END IF;

  INSERT INTO public.audit_logs (
    escola_id,
    user_id,
    user_email,
    portal,
    acao,
    tabela,
    entity,
    entity_id,
    details
  ) VALUES (
    v_doc.escola_id,
    p_actor_id,
    p_actor_email,
    'secretaria',
    'documento_recibo_reprint',
    'documentos_emitidos',
    'documentos_emitidos',
    v_doc.id,
    jsonb_build_object(
      'doc_id', v_doc.id,
      'via', GREATEST(COALESCE(v_doc.print_count, 0), 1),
      'print_count', COALESCE(v_doc.print_count, 0),
      'timestamp', NOW()
    )
  );

  RETURN QUERY SELECT v_doc.print_count, v_doc.last_printed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_documento_print(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_documento_print(uuid, uuid, text) TO authenticated, service_role;

COMMIT;
