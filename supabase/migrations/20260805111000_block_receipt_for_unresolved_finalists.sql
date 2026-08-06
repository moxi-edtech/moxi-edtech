BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_marker text := $marker$
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;
$marker$;
  v_replacement text := $replacement$
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.matricula_reclassificacoes mr
    WHERE mr.escola_id = v_m.escola_id
      AND mr.aluno_id = v_m.aluno_id
      AND mr.status = 'aguardando_destino'
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'MATRICULA_AGUARDANDO_RECLASSIFICACAO',
      'mensagem', 'Aluno aguarda definição de destino académico'
    );
  END IF;
$replacement$;
BEGIN
  SELECT pg_get_functiondef('public.emitir_recibo(uuid)'::regprocedure)
    INTO v_definition;

  v_updated := replace(v_definition, v_marker, v_replacement);
  IF v_updated = v_definition
     AND position('MATRICULA_AGUARDANDO_RECLASSIFICACAO' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Definição inesperada de emitir_recibo; migration interrompida.';
  END IF;

  IF v_updated <> v_definition THEN
    EXECUTE v_updated;
  END IF;
END
$migration$;

COMMIT;
