-- Diagnostics for CURTUME 2025/2026; never modify a grade or invent an academic decision.
-- A failed pupil's inner subtransaction rolls back before this record is saved.
BEGIN;

CREATE TABLE public.curtume_2025_fecho_diagnosticos (
  escola_id uuid NOT NULL CHECK (escola_id='3744879f-2e19-4671-8995-78604302d8c5'::uuid),
  matricula_id uuid NOT NULL,
  historico_ano_id uuid NOT NULL,
  codigo text NOT NULL CHECK (length(codigo) BETWEEN 1 AND 100),
  detalhe text NOT NULL CHECK (length(detalhe) BETWEEN 1 AND 150),
  sqlstate text NOT NULL CHECK (length(sqlstate)=5),
  lote_id uuid NOT NULL,
  diagnosticado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(escola_id,matricula_id)
);
ALTER TABLE public.curtume_2025_fecho_diagnosticos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.curtume_2025_fecho_diagnosticos FROM PUBLIC,anon,authenticated;

-- The existing batch RPC is the ONLY writer. It catches and isolates
-- per-student failures, preserving all successful ratifications and locks.
-- Fail the migration if the reviewed SQL changes: never patch an unknown body.
DO $patch$
DECLARE
  v_function regprocedure := 'public.curtume_fechar_pautas_2025_lote(uuid,uuid,uuid,integer)'::regprocedure;
  v_sql text := pg_catalog.pg_get_functiondef('public.curtume_fechar_pautas_2025_lote(uuid,uuid,uuid,integer)'::regprocedure);
  v_old_error text := $old$      v_state := SQLSTATE;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object($old$;
  v_new_error text := $new$      v_state := SQLSTATE;
      INSERT INTO public.curtume_2025_fecho_diagnosticos
        (escola_id,matricula_id,historico_ano_id,codigo,detalhe,sqlstate,lote_id,diagnosticado_em)
      VALUES
        (p_escola_id,v_row.matricula_id,v_row.historico_id,
         split_part(v_error,':',1),v_error,v_state,p_lote_id,now())
      ON CONFLICT(escola_id,matricula_id) DO UPDATE SET
        historico_ano_id=EXCLUDED.historico_ano_id,
        codigo=EXCLUDED.codigo,
        detalhe=EXCLUDED.detalhe,
        sqlstate=EXCLUDED.sqlstate,
        lote_id=EXCLUDED.lote_id,
        diagnosticado_em=EXCLUDED.diagnosticado_em;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object($new$;
  v_old_success text := '      v_closed := v_closed + 1;';
  v_new_success text := $new$      DELETE FROM public.curtume_2025_fecho_diagnosticos
      WHERE escola_id=p_escola_id AND matricula_id=v_row.matricula_id;
      v_closed := v_closed + 1;$new$;
BEGIN
  IF (length(v_sql)-length(replace(v_sql,v_old_error,''))) <> length(v_old_error)
     OR (length(v_sql)-length(replace(v_sql,v_old_success,''))) <> length(v_old_success)
     OR strpos(v_sql,'curtume_2025_fecho_diagnosticos')>0 THEN
    RAISE EXCEPTION 'CURTUME_DIAGNOSTICO_BATCH_GUARD_CHANGED';
  END IF;
  EXECUTE replace(replace(v_sql,v_old_error,v_new_error),v_old_success,v_new_success);
END;
$patch$;

-- Readable only by the authenticated school's privileged academic roles.
-- LEFT JOIN deliberately retains unprocessed open histories: NULL code means
-- no actual failed attempt has yet been recorded, not an inferred RAA error.
CREATE OR REPLACE FUNCTION public.curtume_2025_listar_fecho_pendencias(p_escola_id uuid)
RETURNS TABLE (
  matricula_id uuid,
  codigo text,
  detalhe text,
  diagnosticado_em timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $fn$
BEGIN
  IF p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
     OR public.safe_auth_uid() IS NULL
     OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
     OR NOT EXISTS (
       SELECT 1 FROM public.escola_users eu
       WHERE eu.escola_id=p_escola_id
         AND eu.user_id=public.safe_auth_uid()
         AND eu.papel IN ('admin','admin_escola','diretor','admin_financeiro')
     ) THEN
    RAISE EXCEPTION 'CURTUME_DIAGNOSTICO_NAO_AUTORIZADO' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT h.matricula_id,d.codigo,d.detalhe,d.diagnosticado_em
      FROM public.historico_anos h
      JOIN public.matriculas m ON m.id=h.matricula_id AND m.escola_id=h.escola_id
      LEFT JOIN public.curtume_2025_fecho_diagnosticos d
        ON d.escola_id=h.escola_id AND d.matricula_id=h.matricula_id
           AND d.historico_ano_id=h.id
     WHERE h.escola_id=p_escola_id AND h.ano_letivo=2025
       AND h.snapshot_status='aberto'
     ORDER BY h.id
     LIMIT 1000;
END;
$fn$;

REVOKE ALL ON FUNCTION public.curtume_2025_listar_fecho_pendencias(uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.curtume_2025_listar_fecho_pendencias(uuid)
  TO authenticated;
COMMIT;
