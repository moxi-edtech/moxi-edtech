-- PostgreSQL 17 only; all synthetic writes ROLLBACK.
BEGIN;
DO $verify$
DECLARE
 v_escola uuid:='3744879f-2e19-4671-8995-78604302d8c5';
 v_doc text:='MAPA 3 CLASSE-2023-24.xlsx';
 v_preview jsonb;v_docs jsonb;v_digest text;v_write jsonb;v_write_again jsonb;
 v_before jsonb;v_after jsonb;v_notes integer;v_denied boolean;
BEGIN
 IF has_function_privilege('anon','public.curtume_2025_confirmar_pauta_documental(uuid,text,text,text,text,text)','EXECUTE') THEN
   RAISE EXCEPTION 'ANON_CAN_SIGN_DOCUMENTS';
 END IF;
 IF has_function_privilege('anon','public.curtume_2025_documentos_pendentes(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'ANON_CAN_READ_DOCUMENTS';
 END IF;
 IF has_function_privilege('authenticated','internal.curtume_2025_documentos_candidatos(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'INTERNAL_FUNCTION_EXPOSED';
 END IF;
 PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
 SET ROLE authenticated;
 v_before:=public.curtume_2025_prever_espelhamento_notas(v_escola);
 IF (v_before->>'documento_ano_divergente')::integer<>1 THEN
  RAISE EXCEPTION 'BASELINE_DOCUMENT_CONFLICT_NOT_DETECTED %',v_before;
 END IF;
 v_preview:=public.curtume_2025_documentos_pendentes(v_escola);
 v_docs:=v_preview->'documentos';
 IF jsonb_array_length(v_docs)<>1 OR (v_docs->0->>'linhas')::integer<>1
    OR v_docs->0->>'arquivo' IS DISTINCT FROM v_doc
    OR (v_docs->0->>'alunos')::integer<>1 THEN
  RAISE EXCEPTION 'DOC_PREVIEW_INCORRECT: %',v_preview;
 END IF;
 v_digest:=v_docs->0->>'digest';
 v_denied:=false;
 BEGIN
 PERFORM public.curtume_2025_confirmar_pauta_documental(
 v_escola,v_doc,repeat('0',64),'PAUTA FISICA Nº 2025',
 'Direção confirmou o ano na pauta original','CONFIRMO_PAUTA_2025_2026');
 EXCEPTION WHEN check_violation THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STALE_DIGEST_NOT_REJECTED'; END IF;
 v_write:=public.curtume_2025_confirmar_pauta_documental(
 v_escola,v_doc,v_digest,'PAUTA FISICA Nº 2025',
 'Direção confirmou o ano na pauta original','CONFIRMO_PAUTA_2025_2026');
 IF (v_write->>'novas_confirmacoes')::integer<>1 THEN
  RAISE EXCEPTION 'DOC_APPROVAL_FAILED %',v_write;
 END IF;
 v_write_again:=public.curtume_2025_confirmar_pauta_documental(
 v_escola,v_doc,v_digest,'PAUTA FISICA Nº 2025',
 'Direção confirmou o ano na pauta original','CONFIRMO_PAUTA_2025_2026');
 IF (v_write_again->>'novas_confirmacoes')::integer<>0 THEN
  RAISE EXCEPTION 'DOC_APPROVAL_NOT_IDEMPOTENT';
 END IF;
 -- Private append-only table is not accessible to authenticated users.
 -- Validate idempotency via the public read RPC rather than granting table rights.
 v_after:=public.curtume_2025_prever_espelhamento_notas(v_escola);
 IF (v_after->>'elegiveis')::integer<>2 OR
    (v_after->>'documento_ano_divergente')::integer<>0 THEN
  RAISE EXCEPTION 'DOC_APPROVED_BUT_MIRROR_NOT_ELIGIBLE %',v_after;
 END IF;
 -- Confirming the original does NOT create or modify a grade.
 IF (SELECT count(*) FROM public.notas)<>0 THEN
  RAISE EXCEPTION 'APPROVAL_INSERTED_NOTES';
 END IF;
 RESET ROLE;
 -- Authenticate a different school to prove the tenant gate fails closed.
 PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
 SET ROLE authenticated;
 v_denied:=false;
 BEGIN
  PERFORM public.curtume_2025_documentos_pendentes(v_escola);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'CROSS_TENANT_PREVIEW_ALLOWED'; END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.curtume_2025_confirmar_pauta_documental(
  v_escola,v_doc,v_digest,'PAUTA FISICA Nº 2025',
  'Direção confirmou o ano na pauta original','CONFIRMO_PAUTA_2025_2026');
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'CROSS_TENANT_APPROVAL_ALLOWED'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
 SET ROLE authenticated;
 -- The school secretary can close the already signed, Curtume-only batch.
 IF (public.curtume_2025_prever_espelhamento_notas(v_escola)->>'elegiveis')::integer<>2 THEN
   RAISE EXCEPTION 'SECRETARIA_PREVIEW_NOT_AUTHORIZED';
 END IF;
 SELECT (public.curtume_2025_espelhar_notas_finais(v_escola,20)->>'criadas')::integer
 INTO v_notes;
 IF v_notes<>2 THEN RAISE EXCEPTION 'MIRROR_AFTER_DOCUMENT_APPROVAL_WRONG %',v_notes; END IF;
 IF (SELECT count(*) FROM public.notas
     WHERE metadata->>'tipo_nota'='HIST_FINAL')<>2 THEN
   RAISE EXCEPTION 'MIRROR_SOURCE_NOTES_WRONG';
 END IF;
 IF (SELECT count(*) FROM public.outbox_events)<>0 THEN
   RAISE EXCEPTION 'HISTORICAL_MIRROR_SENT_RETROACTIVE_NOTIFICATIONS';
 END IF;
 RESET ROLE;
END;
$verify$;
ROLLBACK;
