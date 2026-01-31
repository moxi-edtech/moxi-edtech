BEGIN;

-- =================================================================
-- MIGRATION: Otimização do Boletim (vw_boletim_por_matricula -> mv_boletim_por_matricula)
--
-- OBJETIVO:
-- 1. Converter a view de boletim, que é lenta, em uma Materialized View.
-- 2. Garantir que a leitura de boletins seja performática, alinhada ao Pilar A.
-- 3. Manter a compatibilidade com o código existente que consome a view.
-- =================================================================

-- PASSO 1: Renomear a VIEW atual para preservar o código
ALTER VIEW IF EXISTS public.vw_boletim_por_matricula RENAME TO vw_boletim_por_matricula_legacy;

-- PASSO 2: Criar a Materialized View com a mesma lógica da view antiga
CREATE MATERIALIZED VIEW internal.mv_boletim_por_matricula AS
WITH "configuracoes" AS (
  SELECT "configuracoes_escola"."escola_id",
     COALESCE("configuracoes_escola"."modelo_avaliacao", 'SIMPLIFICADO'::"text") AS "modelo_avaliacao",
     "configuracoes_escola"."avaliacao_config"
    FROM "public"."configuracoes_escola"
 ), "componentes" AS (
  SELECT "c"."escola_id",
     "upper"("comp"."code") AS "code",
     "comp"."peso",
     COALESCE("comp"."ativo", true) AS "ativo"
    FROM ("configuracoes" "c"
      LEFT JOIN LATERAL "jsonb_to_recordset"(("c"."avaliacao_config" -> 'componentes'::"text")) "comp"("code" "text", "peso" numeric, "ativo" boolean) ON (true))
 ), "base" AS (
  SELECT "m"."id" AS "matricula_id",
     "m"."aluno_id",
     "m"."turma_id",
     "m"."escola_id",
     "m"."ano_letivo",
     "td"."id" AS "turma_disciplina_id",
     "cm"."disciplina_id",
     "dc"."nome" AS "disciplina_nome",
     "dc"."sigla" AS "disciplina_sigla"
    FROM ((("public"."matriculas" "m"
      JOIN "public"."turma_disciplinas" "td" ON ((("td"."turma_id" = "m"."turma_id") AND ("td"."escola_id" = "m"."escola_id"))))
      JOIN "public"."curso_matriz" "cm" ON (("cm"."id" = "td"."curso_matriz_id")))
      JOIN "public"."disciplinas_catalogo" "dc" ON (("dc"."id" = "cm"."disciplina_id")))
   WHERE ("m"."status" = ANY (ARRAY['ativo'::"text", 'ativa'::"text", 'active'::"text"]))
 ), "avaliacoes" AS (
  SELECT "b"."matricula_id",
     "b"."aluno_id",
     "b"."turma_id",
     "b"."escola_id",
     "b"."ano_letivo",
     "b"."turma_disciplina_id",
     "b"."disciplina_id",
     "b"."disciplina_nome",
     "b"."disciplina_sigla",
     "a"."id" AS "avaliacao_id",
     "a"."nome" AS "avaliacao_nome",
     "a"."tipo" AS "avaliacao_tipo",
     "a"."trimestre",
     "a"."peso" AS "avaliacao_peso"
    FROM ("base" "b"
      LEFT JOIN "public"."avaliacoes" "a" ON ((("a"."turma_disciplina_id" = "b"."turma_disciplina_id") AND ("a"."ano_letivo" = "b"."ano_letivo"))))
 ), "notas" AS (
  SELECT "a"."matricula_id",
     "a"."aluno_id",
     "a"."turma_id",
     "a"."escola_id",
     "a"."ano_letivo",
     "a"."turma_disciplina_id",
     "a"."disciplina_id",
     "a"."disciplina_nome",
     "a"."disciplina_sigla",
     "a"."avaliacao_id",
     "a"."avaliacao_nome",
     "a"."avaliacao_tipo",
     "a"."trimestre",
     "a"."avaliacao_peso",
     "n_1"."valor" AS "nota"
    FROM ("avaliacoes" "a"
      LEFT JOIN "public"."notas" "n_1" ON ((("n_1"."matricula_id" = "a"."matricula_id") AND ("n_1"."avaliacao_id" = "a"."avaliacao_id"))))
 ), "calc" AS (
  SELECT "n_1"."matricula_id",
     "n_1"."aluno_id",
     "n_1"."turma_id",
     "n_1"."escola_id",
     "n_1"."ano_letivo",
     "n_1"."turma_disciplina_id",
     "n_1"."disciplina_id",
     "n_1"."disciplina_nome",
     "n_1"."disciplina_sigla",
     "n_1"."avaliacao_id",
     "n_1"."avaliacao_nome",
     "n_1"."avaliacao_tipo",
     "n_1"."trimestre",
     "n_1"."avaliacao_peso",
     "n_1"."nota",
     COALESCE("cfg"."modelo_avaliacao", 'SIMPLIFICADO'::"text") AS "modelo_avaliacao",
     COALESCE("comp"."peso", "n_1"."avaliacao_peso", (1)::numeric) AS "peso_aplicado"
    FROM (("notas" "n_1"
      LEFT JOIN "configuracoes" "cfg" ON (("cfg"."escola_id" = "n_1"."escola_id")))
      LEFT JOIN "componentes" "comp" ON ((("comp"."escola_id" = "n_1"."escola_id") AND ("comp"."ativo" IS TRUE) AND ("comp"."code" = "upper"(COALESCE("n_1"."avaliacao_tipo", "n_1"."avaliacao_nome"))))))
 )
 SELECT "escola_id",
     "matricula_id",
     "aluno_id",
     "turma_id",
     "ano_letivo",
     "disciplina_id",
     "disciplina_nome",
     "disciplina_sigla",
     "trimestre",
     "jsonb_object_agg"(COALESCE("avaliacao_tipo", "avaliacao_nome"), "nota") FILTER (WHERE (COALESCE("avaliacao_tipo", "avaliacao_nome") IS NOT NULL)) AS "notas_por_tipo",
         CASE
             WHEN ("count"("nota") FILTER (WHERE ("nota" IS NOT NULL)) = 0) THEN NULL::numeric
             WHEN ("modelo_avaliacao" = 'DEPOIS'::"text") THEN NULL::numeric
             ELSE ("sum"(("nota" * "peso_aplicado")) FILTER (WHERE ("nota" IS NOT NULL)) / NULLIF("sum"("peso_aplicado") FILTER (WHERE ("nota" IS NOT NULL)), (0)::numeric))
         END AS "nota_final",
         CASE
             WHEN ("modelo_avaliacao" = 'DEPOIS'::"text") THEN 'PENDENTE_CONFIG'::"text"
             ELSE NULL::"text"
         END AS "status",
     ("modelo_avaliacao" = 'DEPOIS'::"text") AS "needs_config",
     "count"("avaliacao_id") FILTER (WHERE ("avaliacao_id" IS NOT NULL)) AS "total_avaliacoes",
     "count"("nota") FILTER (WHERE ("nota" IS NOT NULL)) AS "total_notas",
         CASE
             WHEN ("count"("avaliacao_id") FILTER (WHERE ("avaliacao_id" IS NOT NULL)) = 0) THEN (1)::bigint
             ELSE GREATEST(("count"("avaliacao_id") FILTER (WHERE ("avaliacao_id" IS NOT NULL)) - "count"("nota") FILTER (WHERE ("nota" IS NOT NULL))), (0)::bigint)
         END AS "missing_count",
         CASE
             WHEN ("count"("nota") FILTER (WHERE ("nota" IS NOT NULL)) = 0) THEN true
             ELSE ("count"("nota") FILTER (WHERE ("nota" IS NOT NULL)) < "count"("avaliacao_id") FILTER (WHERE ("avaliacao_id" IS NOT NULL)))
         END AS "has_missing"
    FROM "calc" "n"
   GROUP BY "escola_id", "matricula_id", "aluno_id", "turma_id", "ano_letivo", "disciplina_id", "disciplina_nome", "disciplina_sigla", "trimestre", "modelo_avaliacao"
WITH NO DATA;

-- PASSO 3: Adicionar um índice único para permitir REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_boletim_por_matricula
  ON internal.mv_boletim_por_matricula (escola_id, matricula_id, disciplina_id, trimestre);

-- PASSO 4: Criar a nova VIEW pública que lê da Materialized View
CREATE OR REPLACE VIEW public.vw_boletim_por_matricula
AS SELECT *
   FROM internal.mv_boletim_por_matricula
   WHERE (escola_id = public.current_tenant_escola_id());

-- PASSO 5: Agendar a atualização periódica da Materialized View
SELECT cron.schedule(
  'refresh_mv_boletim_por_matricula',
  '*/20 * * * *', -- A cada 20 minutos
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_boletim_por_matricula$$
);

COMMIT;
