BEGIN;

-- Automatic rollback: the post-apply lint exposed a pre-existing reference to
-- audit_logs.user_email, which is not part of the approved batch-1 diff.
CREATE OR REPLACE FUNCTION public.increment_documento_print(
  p_doc_id uuid,
  p_actor_id uuid DEFAULT NULL::uuid,
  p_actor_email text DEFAULT NULL::text
)
RETURNS TABLE(print_count integer, last_printed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc public.documentos_emitidos%ROWTYPE;
BEGIN
  UPDATE public.documentos_emitidos
  SET print_count = coalesce(print_count, 0) + 1,
      last_printed_at = now()
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
      'via', greatest(coalesce(v_doc.print_count, 0), 1),
      'print_count', coalesce(v_doc.print_count, 0),
      'timestamp', now()
    )
  );

  RETURN QUERY SELECT v_doc.print_count, v_doc.last_printed_at;
END;
$function$;

COMMIT;
