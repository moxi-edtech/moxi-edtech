BEGIN;

DROP VIEW IF EXISTS public.vw_boletim_por_matricula;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_boletim_por_matricula;

CREATE MATERIALIZED VIEW internal.mv_boletim_por_matricula AS
WITH configuracoes AS (
  SELECT configuracoes_escola.escola_id,
     COALESCE(configuracoes_escola.modelo_avaliacao, 'SIMPLIFICADO'::text) AS modelo_avaliacao,
     configuracoes_escola.avaliacao_config
    FROM public.configuracoes_escola
 ), componentes_escola AS (
  SELECT c.escola_id,
     upper(comp.code) AS code,
     comp.peso,
     COALESCE(comp.ativo, true) AS ativo
    FROM (configuracoes c
      LEFT JOIN LATERAL jsonb_to_recordset((c.avaliacao_config -> 'componentes'::text)) comp(code text, peso numeric, ativo boolean) ON true)
 ), componentes_modelo AS (
  SELECT ma.id AS modelo_id,
     upper(comp.code) AS code,
     comp.peso,
     COALESCE(comp.ativo, true) AS ativo
    FROM (public.modelos_avaliacao ma
      LEFT JOIN LATERAL jsonb_to_recordset(ma.componentes) comp(code text, peso numeric, ativo boolean) ON true)
 ), base AS (
  SELECT m.id AS matricula_id,
     m.aluno_id,
     m.turma_id,
     m.escola_id,
     m.ano_letivo,
     td.id AS turma_disciplina_id,
     COALESCE(td.conta_para_media_med, true) AS conta_para_media_med,
     cm.disciplina_id,
     cm.curso_id,
     cm.classe_id,
     cm.avaliacao_mode,
     cm.avaliacao_modelo_id,
     cm.avaliacao_disciplina_id,
     dc.nome AS disciplina_nome,
     dc.sigla AS disciplina_sigla
    FROM (((public.matriculas m
      JOIN public.turma_disciplinas td ON ((td.turma_id = m.turma_id) AND (td.escola_id = m.escola_id)))
      JOIN public.curso_matriz cm ON (cm.id = td.curso_matriz_id))
      JOIN public.disciplinas_catalogo dc ON (dc.id = cm.disciplina_id))
   WHERE (m.status = ANY (ARRAY['ativo'::text, 'ativa'::text, 'active'::text]))
 ), matriz_base AS (
  SELECT cm.escola_id,
     cm.curso_id,
     cm.classe_id,
     cm.disciplina_id,
     cm.avaliacao_modelo_id
    FROM public.curso_matriz cm
   WHERE cm.ativo = true
 ), avaliacoes AS (
  SELECT b.matricula_id,
     b.aluno_id,
     b.turma_id,
     b.escola_id,
     b.ano_letivo,
     b.turma_disciplina_id,
     b.conta_para_media_med,
     b.disciplina_id,
     b.curso_id,
     b.classe_id,
     b.avaliacao_mode,
     b.avaliacao_modelo_id,
     b.avaliacao_disciplina_id,
     b.disciplina_nome,
     b.disciplina_sigla,
     a.id AS avaliacao_id,
     a.nome AS avaliacao_nome,
     a.tipo AS avaliacao_tipo,
     a.trimestre,
     a.peso AS avaliacao_peso
    FROM (base b
      LEFT JOIN public.avaliacoes a ON ((a.turma_disciplina_id = b.turma_disciplina_id) AND (a.ano_letivo = b.ano_letivo)))
 ), notas AS (
  SELECT a.matricula_id,
     a.aluno_id,
     a.turma_id,
     a.escola_id,
     a.ano_letivo,
     a.turma_disciplina_id,
     a.conta_para_media_med,
     a.disciplina_id,
     a.curso_id,
     a.classe_id,
     a.avaliacao_mode,
     a.avaliacao_modelo_id,
     a.avaliacao_disciplina_id,
     a.disciplina_nome,
     a.disciplina_sigla,
     a.avaliacao_id,
     a.avaliacao_nome,
     a.avaliacao_tipo,
     a.trimestre,
     a.avaliacao_peso,
     n.valor AS nota
    FROM (avaliacoes a
      LEFT JOIN public.notas n ON ((n.matricula_id = a.matricula_id) AND (n.avaliacao_id = a.avaliacao_id)))
 ), calc AS (
  SELECT n.matricula_id,
     n.aluno_id,
     n.turma_id,
     n.escola_id,
     n.ano_letivo,
     n.turma_disciplina_id,
     n.conta_para_media_med,
     n.disciplina_id,
     n.disciplina_nome,
     n.disciplina_sigla,
     n.avaliacao_id,
     n.avaliacao_nome,
     n.avaliacao_tipo,
     n.trimestre,
     n.avaliacao_peso,
     n.nota,
     COALESCE(
       CASE
         WHEN n.avaliacao_mode = 'custom' AND n.avaliacao_modelo_id IS NOT NULL THEN 'CUSTOM'
         WHEN n.avaliacao_mode = 'inherit_disciplina' AND mb.avaliacao_modelo_id IS NOT NULL THEN 'CUSTOM'
         ELSE NULL
       END,
       cfg.modelo_avaliacao,
       'SIMPLIFICADO'::text
     ) AS modelo_avaliacao,
     COALESCE(
       cmc.peso,
       comp.peso,
       n.avaliacao_peso,
       1::numeric
     ) AS peso_aplicado
    FROM notas n
      LEFT JOIN configuracoes cfg ON (cfg.escola_id = n.escola_id)
      LEFT JOIN matriz_base mb ON (
        mb.escola_id = n.escola_id
        AND mb.curso_id = n.curso_id
        AND mb.classe_id = n.classe_id
        AND mb.disciplina_id = n.avaliacao_disciplina_id
      )
      LEFT JOIN componentes_modelo cmc ON (
        cmc.modelo_id = CASE
          WHEN n.avaliacao_mode = 'custom' THEN n.avaliacao_modelo_id
          WHEN n.avaliacao_mode = 'inherit_disciplina' THEN mb.avaliacao_modelo_id
          ELSE NULL
        END
        AND cmc.ativo IS TRUE
        AND cmc.code = upper(COALESCE(n.avaliacao_tipo, n.avaliacao_nome))
      )
      LEFT JOIN componentes_escola comp ON (
        comp.escola_id = n.escola_id
        AND comp.ativo IS TRUE
        AND comp.code = upper(COALESCE(n.avaliacao_tipo, n.avaliacao_nome))
      )
 )
 SELECT escola_id,
     matricula_id,
     aluno_id,
     turma_id,
     ano_letivo,
     disciplina_id,
     disciplina_nome,
     disciplina_sigla,
     trimestre,
     conta_para_media_med,
     jsonb_object_agg(COALESCE(avaliacao_tipo, avaliacao_nome), nota)
       FILTER (WHERE COALESCE(avaliacao_tipo, avaliacao_nome) IS NOT NULL) AS notas_por_tipo,
     CASE
         WHEN conta_para_media_med IS FALSE THEN NULL::numeric
         WHEN count(nota) FILTER (WHERE nota IS NOT NULL) = 0 THEN NULL::numeric
         WHEN modelo_avaliacao = 'DEPOIS'::text THEN NULL::numeric
         ELSE (sum((nota * peso_aplicado)) FILTER (WHERE nota IS NOT NULL)
               / NULLIF(sum(peso_aplicado) FILTER (WHERE nota IS NOT NULL), 0::numeric))
     END AS nota_final,
     CASE
         WHEN conta_para_media_med IS FALSE THEN 'NAO_CONTA'::text
         WHEN modelo_avaliacao = 'DEPOIS'::text THEN 'PENDENTE_CONFIG'::text
         ELSE NULL::text
     END AS status,
     (modelo_avaliacao = 'DEPOIS'::text AND conta_para_media_med IS TRUE) AS needs_config,
     CASE
         WHEN conta_para_media_med IS FALSE THEN 0::bigint
         ELSE count(avaliacao_id) FILTER (WHERE avaliacao_id IS NOT NULL)
     END AS total_avaliacoes,
     CASE
         WHEN conta_para_media_med IS FALSE THEN 0::bigint
         ELSE count(nota) FILTER (WHERE nota IS NOT NULL)
     END AS total_notas,
     CASE
         WHEN conta_para_media_med IS FALSE THEN 0::bigint
         WHEN count(avaliacao_id) FILTER (WHERE avaliacao_id IS NOT NULL) = 0 THEN 1::bigint
         ELSE GREATEST((count(avaliacao_id) FILTER (WHERE avaliacao_id IS NOT NULL)
           - count(nota) FILTER (WHERE nota IS NOT NULL)), 0::bigint)
     END AS missing_count,
     CASE
         WHEN conta_para_media_med IS FALSE THEN false
         WHEN count(nota) FILTER (WHERE nota IS NOT NULL) = 0 THEN true
         ELSE (count(nota) FILTER (WHERE nota IS NOT NULL)
           < count(avaliacao_id) FILTER (WHERE avaliacao_id IS NOT NULL))
     END AS has_missing
    FROM calc
   GROUP BY escola_id, matricula_id, aluno_id, turma_id, ano_letivo, disciplina_id,
     disciplina_nome, disciplina_sigla, trimestre, modelo_avaliacao, conta_para_media_med
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_boletim_por_matricula
  ON internal.mv_boletim_por_matricula (escola_id, matricula_id, disciplina_id, trimestre);

CREATE OR REPLACE VIEW public.vw_boletim_por_matricula
AS SELECT *
   FROM internal.mv_boletim_por_matricula
   WHERE (escola_id = public.current_tenant_escola_id());

COMMIT;
