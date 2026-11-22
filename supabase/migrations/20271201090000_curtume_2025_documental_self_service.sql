-- KLASSE Curtume 2025/26: signed school-document review, never a grade override.
-- Pinned to a verified live function baseline. NO replay of the #376 migrations.
-- Apply only after disposable PG17 + authenticated E2E and release review.
BEGIN;

CREATE TABLE IF NOT EXISTS internal.curtume_2025_documento_revisoes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escola_id uuid NOT NULL,
  historico_ano_id uuid NOT NULL,
  matricula_id uuid NOT NULL,
  historico_disciplina_id uuid NOT NULL REFERENCES public.historico_disciplinas(id) ON DELETE RESTRICT,
  arquivo_original text NOT NULL,
  fonte_sha256 text NOT NULL CHECK (fonte_sha256 ~ '^[a-f0-9]{64}$'),
  referencia_documental text NOT NULL CHECK (length(btrim(referencia_documental)) BETWEEN 8 AND 180),
  motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 12 AND 500),
  confirmado_por uuid NOT NULL,
  confirmado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (historico_disciplina_id, fonte_sha256)
);
CREATE INDEX IF NOT EXISTS curtume_2025_documento_revisoes_escola_arquivo
  ON internal.curtume_2025_documento_revisoes(escola_id,arquivo_original);
ALTER TABLE internal.curtume_2025_documento_revisoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE internal.curtume_2025_documento_revisoes FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE internal.curtume_2025_documento_revisoes_id_seq FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION internal.curtume_2025_fonte_sha256(
  p_historico_id uuid,p_matricula_id uuid,p_hd_id uuid,p_valor numeric,p_detalhes jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE STRICT
SET search_path='pg_catalog'
AS $hash$
  SELECT encode(pg_catalog.sha256(pg_catalog.convert_to(
    pg_catalog.jsonb_build_array(p_historico_id,p_matricula_id,p_hd_id,p_valor,p_detalhes)::text,
    'UTF8')), 'hex');
$hash$;
REVOKE ALL ON FUNCTION internal.curtume_2025_fonte_sha256(uuid,uuid,uuid,numeric,jsonb)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION internal.curtume_2025_documento_revisado(
  p_escola_id uuid,p_historico_id uuid,p_matricula_id uuid,
  p_hd_id uuid,p_valor numeric,p_detalhes jsonb
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path='pg_catalog','internal'
AS $valid$
  SELECT EXISTS (
    SELECT 1 FROM internal.curtume_2025_documento_revisoes r
    WHERE r.escola_id=p_escola_id
      AND r.historico_ano_id=p_historico_id
      AND r.matricula_id=p_matricula_id
      AND r.historico_disciplina_id=p_hd_id
      AND r.arquivo_original=p_detalhes->>'arquivo'
      AND r.fonte_sha256=internal.curtume_2025_fonte_sha256(
        p_historico_id,p_matricula_id,p_hd_id,p_valor,p_detalhes)
  );
$valid$;
REVOKE ALL ON FUNCTION internal.curtume_2025_documento_revisado(uuid,uuid,uuid,uuid,numeric,jsonb)
  FROM PUBLIC,anon,authenticated;

-- Private source selector. Closed and legally locked 2025 histories only.
-- The original Excel title/grade/row are immutable inputs to the signed hash.
CREATE OR REPLACE FUNCTION internal.curtume_2025_documentos_candidatos(p_escola_id uuid)
RETURNS TABLE(
  historico_id uuid,matricula_id uuid,hd_id uuid,documento text,
  nota_final numeric,detalhes jsonb,aluno_nome text,numero_processo text,
  turma_nome text,disciplina_nome text,linha text,fonte_sha256 text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path='pg_catalog','public','internal'
AS $src$
  SELECT h.id,h.matricula_id,hd.id,hd.notas_detalhe->>'arquivo',
         hd.nota_final,hd.notas_detalhe,
         coalesce(nullif(btrim(a.nome_completo),''),a.nome),
         a.numero_processo,t.nome,hd.disciplina_nome,hd.notas_detalhe->>'linha',
         internal.curtume_2025_fonte_sha256(
           h.id,h.matricula_id,hd.id,hd.nota_final,hd.notas_detalhe)
  FROM public.historico_anos h
  JOIN public.historico_disciplinas hd ON hd.historico_ano_id=h.id
  JOIN public.matriculas m ON m.id=h.matricula_id AND m.escola_id=h.escola_id
    AND m.aluno_id=h.aluno_id AND m.ano_letivo=2025
    AND m.session_id=h.ano_letivo_id AND m.turma_id=h.turma_id
    AND m.status='concluido' AND m.ativo=false
    AND m.status_fecho_origem='override_admin'
  JOIN public.alunos a ON a.id=h.aluno_id AND a.escola_id=h.escola_id
  JOIN public.turmas t ON t.id=h.turma_id AND t.escola_id=h.escola_id
    AND t.ano_letivo=2025 AND t.session_id=h.ano_letivo_id
  JOIN public.classes c ON c.id=t.classe_id AND c.escola_id=h.escola_id
  WHERE h.escola_id=p_escola_id
    AND h.escola_id='3744879f-2e19-4671-8995-78604302d8c5'::uuid
    AND h.ano_letivo=2025 AND h.snapshot_status='fechado'
    AND h.resultado_final IN ('aprovado','reprovado','concluido')
    AND hd.nota_final BETWEEN 0 AND
        CASE WHEN c.numero<=6 OR (c.numero IS NULL AND c.nome='Pré-Escolar') THEN 10 ELSE 20 END
    AND hd.notas_detalhe->>'ano_letivo' IN ('2025','2025/2026')
    AND hd.notas_detalhe->>'arquivo' ~* '(2023[-_/ ]?24|2023[-_/ ]?2024)'
    AND nullif(btrim(hd.notas_detalhe->>'aba'),'') IS NOT NULL
    AND nullif(btrim(hd.notas_detalhe->>'linha'),'') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.historico_snapshot_locks l
      WHERE l.escola_id=h.escola_id AND l.matricula_id=h.matricula_id
        AND l.historico_ano_id=h.id AND l.ano_letivo_id=h.ano_letivo_id
        AND l.status='fechado')
    AND EXISTS (
      SELECT 1 FROM public.turma_disciplinas td
      JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id
        AND cm.escola_id=td.escola_id AND cm.disciplina_id=hd.disciplina_id
      WHERE td.turma_id=h.turma_id AND td.escola_id=h.escola_id)
    AND NOT EXISTS(
      SELECT 1 FROM public.notas n
      WHERE n.escola_id=h.escola_id AND n.matricula_id=h.matricula_id
        AND n.metadata->>'tipo_nota'='HIST_FINAL'
        AND n.metadata->>'historico_disciplina_id'=hd.id::text)
  ORDER BY hd.id;
$src$;
REVOKE ALL ON FUNCTION internal.curtume_2025_documentos_candidatos(uuid)
  FROM PUBLIC,anon,authenticated;

-- Tenant + role verification is repeated inside each PUBLIC RPC; the UI is not a security boundary.
CREATE OR REPLACE FUNCTION public.curtume_2025_documentos_pendentes(p_escola_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path='pg_catalog','public','internal'
AS $read$
DECLARE v_actor uuid:=public.safe_auth_uid();v_documentos jsonb;
BEGIN
 IF p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
   OR v_actor IS NULL
   OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
   OR NOT EXISTS (SELECT 1 FROM public.escola_users eu
     WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
       AND eu.papel IN ('diretor','admin','admin_escola','admin_secretaria',
                        'admin_secretario','admin_financeiro','secretaria'))
 THEN RAISE EXCEPTION 'DOCUMENTOS_2025_SEM_PERMISSAO' USING ERRCODE='42501'; END IF;

 WITH sources AS (
   SELECT s.*,internal.curtume_2025_documento_revisado(
     p_escola_id,s.historico_id,s.matricula_id,s.hd_id,s.nota_final,s.detalhes) AS revisado
   FROM internal.curtume_2025_documentos_candidatos(p_escola_id) s
 ), documents AS (
   SELECT documento,count(*)::integer AS linhas,
     count(DISTINCT matricula_id)::integer AS alunos,
     count(*) FILTER (WHERE revisado)::integer AS conferidas,
     encode(sha256(convert_to(string_agg(fonte_sha256,'' ORDER BY hd_id),'UTF8')),'hex') AS digest,
     jsonb_agg(jsonb_build_object(
       'nome',aluno_nome,'numero_processo',numero_processo,'turma',turma_nome,
       'disciplina',disciplina_nome,'nota',nota_final,'linha',linha,
       'conferida',revisado) ORDER BY aluno_nome,hd_id) AS detalhes
   FROM sources GROUP BY documento
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'arquivo',documento,'linhas',linhas,'alunos',alunos,'conferidas',conferidas,
  'digest',digest,'detalhes',detalhes) ORDER BY documento),'[]'::jsonb)
 INTO v_documentos FROM documents;
 RETURN jsonb_build_object('ok',true,'ano',2025,'documentos',v_documentos);
END;
$read$;
REVOKE ALL ON FUNCTION public.curtume_2025_documentos_pendentes(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.curtume_2025_documentos_pendentes(uuid) TO authenticated;

-- Every approval is tied to the exact historical lines, not only a file name.
CREATE OR REPLACE FUNCTION public.curtume_2025_confirmar_pauta_documental(
  p_escola_id uuid,p_documento text,p_snapshot text,
  p_referencia text,p_motivo text,p_confirmacao text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path='pg_catalog','public','internal'
AS $write$
DECLARE
 v_actor uuid:=public.safe_auth_uid();
 v_papel text;
 v_doc text:=btrim(coalesce(p_documento,''));
 v_ref text:=btrim(coalesce(p_referencia,''));
 v_motivo text:=btrim(coalesce(p_motivo,''));
 v_count integer; v_alunos integer; v_novas integer:=0; v_doc_digest text;
 v_row record;
BEGIN
 IF p_escola_id IS DISTINCT FROM '3744879f-2e19-4671-8995-78604302d8c5'::uuid
    OR v_actor IS NULL
    OR public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id
 THEN RAISE EXCEPTION 'DOCUMENTO_2025_SEM_PERMISSAO' USING ERRCODE='42501'; END IF;
 SELECT eu.papel INTO v_papel FROM public.escola_users eu
 WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
   AND eu.papel IN ('diretor','admin','admin_escola','admin_secretaria',
                    'admin_secretario','admin_financeiro','secretaria')
 LIMIT 1;
 IF v_papel IS NULL THEN
   RAISE EXCEPTION 'DOCUMENTO_2025_EXIGE_DIRECAO_OU_SECRETARIA' USING ERRCODE='42501';
 END IF;
 IF length(v_doc) NOT BETWEEN 8 AND 180
    OR length(v_ref) NOT BETWEEN 8 AND 180
    OR length(v_motivo) NOT BETWEEN 12 AND 500
    OR p_confirmacao IS DISTINCT FROM 'CONFIRMO_PAUTA_2025_2026'
    OR p_snapshot !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'DOCUMENTO_2025_CONFIRMACAO_INVALIDA' USING ERRCODE='23514'; END IF;
 IF v_doc !~* '(2023[-_/ ]?24|2023[-_/ ]?2024)' THEN
   RAISE EXCEPTION 'DOCUMENTO_2025_ANO_NAO_DIVERGENTE' USING ERRCODE='23514';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
     'curtume:2025:documento:'||v_doc,0));
 -- Protect against document or grade changes between preview and signature.
 PERFORM 1 FROM public.historico_disciplinas hd
 JOIN public.historico_anos h ON h.id=hd.historico_ano_id
 WHERE h.escola_id=p_escola_id AND h.ano_letivo=2025
   AND hd.notas_detalhe->>'arquivo'=v_doc
 ORDER BY hd.id FOR SHARE OF hd,h;

 SELECT count(*)::integer,count(DISTINCT matricula_id)::integer,
   encode(sha256(convert_to(string_agg(fonte_sha256,'' ORDER BY hd_id),'UTF8')),'hex')
 INTO v_count,v_alunos,v_doc_digest
 FROM internal.curtume_2025_documentos_candidatos(p_escola_id)
 WHERE documento=v_doc;
 IF v_count IS NULL OR v_count NOT BETWEEN 1 AND 200
    OR v_doc_digest IS DISTINCT FROM p_snapshot THEN
   RAISE EXCEPTION 'DOCUMENTO_2025_ALTERADO_RECONSULTAR' USING ERRCODE='23514';
 END IF;

 FOR v_row IN SELECT * FROM internal.curtume_2025_documentos_candidatos(p_escola_id)
              WHERE documento=v_doc ORDER BY hd_id
 LOOP
   INSERT INTO internal.curtume_2025_documento_revisoes
     (escola_id,historico_ano_id,matricula_id,historico_disciplina_id,
      arquivo_original,fonte_sha256,referencia_documental,motivo,confirmado_por)
   VALUES(p_escola_id,v_row.historico_id,v_row.matricula_id,v_row.hd_id,
          v_doc,v_row.fonte_sha256,v_ref,v_motivo,v_actor)
   ON CONFLICT (historico_disciplina_id,fonte_sha256) DO NOTHING;
   IF FOUND THEN v_novas:=v_novas+1; END IF;
   IF NOT internal.curtume_2025_documento_revisado(
      p_escola_id,v_row.historico_id,v_row.matricula_id,v_row.hd_id,
      v_row.nota_final,v_row.detalhes)
   THEN RAISE EXCEPTION 'DOCUMENTO_2025_ASSINATURA_INCONSISTENTE' USING ERRCODE='23514'; END IF;
 END LOOP;

 IF v_novas>0 THEN
   INSERT INTO public.audit_logs
     (escola_id,actor_id,action,entity,entity_id,portal,details)
   VALUES(p_escola_id,v_actor,'CURTUME_2025_PAUTA_DOCUMENTAL_CONFERIDA',
     'historico_disciplinas',v_doc,'secretaria',
     jsonb_build_object('ano',2025,'arquivo_original',v_doc,
       'source_digest',v_doc_digest,'referencia_documental',v_ref,
       'motivo',v_motivo,'papel_autorizado',v_papel,
       'linhas_validadas',v_novas,'alunos_abrangidos',v_alunos,
       'resultado','ano_fonte_confirmado_2025_2026',
       'notas_originals_preservadas',true));
 END IF;
 RETURN jsonb_build_object('ok',true,'documento',v_doc,'linhas',v_count,
   'alunos',v_alunos,'novas_confirmacoes',v_novas,
   'ja_confirmadas',v_count-v_novas,'reconsultar',true);
END;
$write$;
REVOKE ALL ON FUNCTION public.curtume_2025_confirmar_pauta_documental(uuid,text,text,text,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.curtume_2025_confirmar_pauta_documental(uuid,text,text,text,text,text)
  TO authenticated;

-- Preserve all 5 already deployed, post-#376 production function bodies.
-- Patch ONLY the documented-year exception, without rewriting original notes,
-- historic documents, source metadata or any financial/audit contract.
-- Fail closed on drift: never overwrite a changed function definition.
DO $patch$
DECLARE
  v record;
  v_oid oid;
  v_body text;
  v_def text;
  v_old text;
  v_new text;
BEGIN
 FOR v IN SELECT * FROM (VALUES
   ('curtume_2025_espelhar_notas_finais','3a2c1ddbb5f723c36190a11babfe56e8'),
   ('curtume_2025_espelhar_notas_finais_manutencao','c829fe53974fbd628364520326796dc4'),
   ('curtume_2025_mfd_mirror_valid','957a56d8ea612cc8e11bdb2ae24c2277'),
   ('curtume_2025_pode_criar_avaliacao_final','aebe71b0e62460db66c6a70d9311e4f0'),
   ('curtume_2025_pode_espelhar_nota','b554c1bb61d14758a18b3ea22c0cc229'),
   ('curtume_2025_prever_espelhamento_notas','c762fe611141946eb53c069695c88ce9')
 ) AS expected(name,hash) LOOP
   SELECT oid,prosrc INTO v_oid,v_body
   FROM pg_catalog.pg_proc
   WHERE pronamespace='public'::regnamespace AND proname=v.name;
   IF v_oid IS NULL OR pg_catalog.md5(v_body) IS DISTINCT FROM v.hash THEN
     RAISE EXCEPTION 'CURTUME_2025_FUNCTION_BASELINE_DRIFT: %',v.name
       USING ERRCODE='23514';
   END IF;
   v_def:=pg_catalog.pg_get_functiondef(v_oid);
   IF v.name='curtume_2025_pode_espelhar_nota' THEN
     -- This helper has no filename predicate; only the exact role gate changes.
     v_old:=NULL;v_new:=NULL;
   ELSIF v.name='curtume_2025_prever_espelhamento_notas' THEN
     v_old:='AND s.notas_detalhe->>''correcao_tipo''=''ano_documental'')) AS doc_divergente';
     v_new:='AND s.notas_detalhe->>''correcao_tipo''=''ano_documental'' OR internal.curtume_2025_documento_revisado(p_escola_id,s.h_id,s.matricula_id,s.hd_id,s.nota_final,s.notas_detalhe))) AS doc_divergente';
   ELSE
     v_old:='AND hd.notas_detalhe->>''correcao_tipo''=''ano_documental''))';
     v_new:='AND hd.notas_detalhe->>''correcao_tipo''=''ano_documental'') OR internal.curtume_2025_documento_revisado(h.escola_id,h.id,h.matricula_id,hd.id,hd.nota_final,hd.notas_detalhe))';
   END IF;
   IF v_old IS NOT NULL THEN
     IF pg_catalog.strpos(v_def,v_old)=0
         OR pg_catalog.strpos(
            pg_catalog.substr(v_def,pg_catalog.strpos(v_def,v_old)+length(v_old)),v_old)>0 THEN
       RAISE EXCEPTION 'CURTUME_2025_FUNCTION_PATCH_PATTERN_DRIFT: %',v.name
         USING ERRCODE='23514';
     END IF;
     v_def:=pg_catalog.replace(v_def,v_old,v_new);
   END IF;
   -- Secretaria is an explicitly authorized school operator. Only extend the
   -- existing Curtume-only preview and batch RPCs (not any global notes API).
   IF v.name IN ('curtume_2025_prever_espelhamento_notas',
                 'curtume_2025_espelhar_notas_finais',
                 'curtume_2025_pode_espelhar_nota',
                 'curtume_2025_pode_criar_avaliacao_final') THEN
     v_old:='''admin_secretario'',''admin_financeiro''';
     v_new:='''admin_secretario'',''admin_financeiro'',''secretaria''';
     IF pg_catalog.strpos(v_def,v_old)=0 OR pg_catalog.strpos(
       pg_catalog.substr(v_def,pg_catalog.strpos(v_def,v_old)+length(v_old)),v_old)>0
     THEN RAISE EXCEPTION 'CURTUME_2025_ROLE_PATTERN_DRIFT: %',v.name
       USING ERRCODE='23514'; END IF;
     v_def:=pg_catalog.replace(v_def,v_old,v_new);
   END IF;
   EXECUTE v_def;
 END LOOP;
END;
$patch$;

COMMIT;
