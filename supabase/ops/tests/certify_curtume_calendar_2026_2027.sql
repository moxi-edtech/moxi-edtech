
-- Certificação de dados operacionais, sem alterações, para o Curtume 2026/2027.
WITH target AS (
  SELECT id FROM public.escolas
  WHERE id='3744879f-2e19-4671-8995-78604302d8c5'::uuid
),
years AS (
  SELECT a.* FROM public.anos_letivos a JOIN target s ON s.id=a.escola_id WHERE a.ano=2026
),
offerings AS (
  SELECT o.*,t.id AS template_id,t.subsistema AS template_subsistema,t.ano_base,
         t.data_inicio AS template_start,t.data_fim AS template_end,
         t.estado,t.is_oficial,t.fonte_documento_url,t.publicado_em
  FROM public.school_education_offerings o JOIN target s ON s.id=o.escola_id
  LEFT JOIN public.calendario_templates t ON t.id=o.calendar_profile_id
  WHERE o.status='active'
),
canonical_items AS (
  SELECT DISTINCT ON (i.tipo,i.nome,i.data_inicio,i.data_fim)
    i.tipo::text AS tipo,i.nome,i.data_inicio,i.data_fim
  FROM offerings o JOIN public.calendario_template_items i ON i.template_id=o.template_id
  WHERE i.tipo::text <> 'PERIODO_LETIVO'
  ORDER BY i.tipo,i.nome,i.data_inicio,i.data_fim
),
canonical_periods AS (
  SELECT DISTINCT i.numero,i.data_inicio,i.data_fim
  FROM offerings o JOIN public.calendario_template_items i ON i.template_id=o.template_id
  WHERE i.tipo::text='PERIODO_LETIVO'
),
actual_events AS (
  SELECT v.* FROM public.calendario_eventos v JOIN years y ON y.id=v.ano_letivo_id
),
actual_periods AS (
  SELECT p.* FROM public.periodos_letivos p JOIN years y ON y.id=p.ano_letivo_id
),
actual_turmas AS (
  SELECT t.* FROM public.turmas t JOIN target s ON s.id=t.escola_id WHERE t.ano_letivo=2026
),
actual_matriculas AS (
  SELECT m.* FROM public.matriculas m JOIN target s ON s.id=m.escola_id WHERE m.ano_letivo=2026
)
SELECT 'ANO_ATIVO_UNICO' AS verification,
       ((SELECT count(*) FROM years)=1 AND (SELECT bool_and(ativo) FROM years)) AS passed,
       (SELECT count(*) FROM years)::text AS inspected
UNION ALL SELECT 'LIMITES_ANO_OFICIAL',
  coalesce((SELECT bool_and(y.data_inicio=o.template_start AND y.data_fim=o.template_end)
    FROM years y CROSS JOIN offerings o), false),
  (SELECT count(*) FROM offerings)::text
UNION ALL SELECT 'PERFIS_PUBLICADOS_COMPATIVEIS',
  coalesce((SELECT bool_and(template_id IS NOT NULL AND is_oficial IS TRUE AND estado='PUBLICADO'
      AND ano_base=2026 AND template_subsistema=education_subsystem) FROM offerings), false),
  (SELECT count(*) FROM offerings)::text
UNION ALL SELECT 'TRIMESTRES_CORRESPONDEM_AO_MED',
  (SELECT count(*) FROM canonical_periods)=3
    AND (SELECT count(*) FROM actual_periods)=3
    AND NOT EXISTS (SELECT 1 FROM canonical_periods c WHERE NOT EXISTS
       (SELECT 1 FROM actual_periods p WHERE p.numero=c.numero AND p.data_inicio=c.data_inicio AND p.data_fim=c.data_fim)),
  (SELECT count(*) FROM actual_periods)::text
UNION ALL SELECT 'TRIMESTRES_COM_FONTE_VALIDADA',
  NOT EXISTS (SELECT 1 FROM actual_periods p WHERE NOT EXISTS (
      SELECT 1 FROM public.calendario_template_items i
      JOIN public.calendario_templates t ON t.id=i.template_id
      WHERE t.id=p.source_template_id AND i.id=p.source_item_id
        AND t.ano_base=2026 AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
        AND i.tipo::text='PERIODO_LETIVO' AND p.numero=i.numero
        AND p.data_inicio=i.data_inicio AND p.data_fim=i.data_fim
        AND p.source_version=t.versao_documento)),
  (SELECT count(*) FROM actual_periods)::text
UNION ALL SELECT 'EVENTOS_OFICIAIS_COMPLETOS',
  (SELECT count(*) FROM canonical_items)=(SELECT count(*) FROM actual_events)
   AND NOT EXISTS (SELECT 1 FROM canonical_items c WHERE NOT EXISTS
     (SELECT 1 FROM actual_events v WHERE v.tipo::text=c.tipo AND v.nome=c.nome
        AND v.data_inicio=c.data_inicio AND v.data_fim=c.data_fim)),
  (SELECT count(*) FROM actual_events)::text
UNION ALL SELECT 'EVENTOS_COM_FONTE_VALIDADA',
  NOT EXISTS (SELECT 1 FROM actual_events v WHERE NOT EXISTS
     (SELECT 1 FROM public.calendario_template_items i
      JOIN public.calendario_templates t ON t.id=i.template_id
      WHERE t.id=v.source_template_id AND i.id=v.source_item_id
      AND t.ano_base=2026 AND t.is_oficial IS TRUE AND t.estado='PUBLICADO'
      AND i.tipo::text=v.tipo::text AND i.nome=v.nome
      AND i.data_inicio=v.data_inicio AND i.data_fim=v.data_fim
      AND v.source_version=t.versao_documento)),
  (SELECT count(*) FROM actual_events)::text
UNION ALL SELECT 'TURMAS_VINCULADAS_A_2026_27',
  NOT EXISTS (SELECT 1 FROM actual_turmas t LEFT JOIN years y ON y.id=t.ano_letivo_id
    WHERE y.id IS NULL OR t.session_id IS DISTINCT FROM y.id OR t.ano_letivo<>y.ano),
  (SELECT count(*) FROM actual_turmas)::text
UNION ALL SELECT 'MATRICULAS_COM_TURMAS_DE_2026_27',
  NOT EXISTS (SELECT 1 FROM actual_matriculas m LEFT JOIN public.turmas t ON t.id=m.turma_id
    WHERE t.id IS NULL OR t.escola_id<>m.escola_id OR t.ano_letivo<>m.ano_letivo),
  (SELECT count(*) FROM actual_matriculas)::text
UNION ALL SELECT 'CLASSES_DE_EXAME_CORRETAS',
  NOT EXISTS (SELECT 1 FROM actual_turmas t
    WHERE t.classe_num IS NOT NULL
      AND t.is_classe_exame IS DISTINCT FROM (t.classe_num IN (6,9))),
  (SELECT count(*) FROM actual_turmas)::text
UNION ALL SELECT 'REFERENCIA_DOCUMENTAL_MED_COMPLETA',
  coalesce((SELECT bool_and(nullif(btrim(fonte_documento_url),'') IS NOT NULL AND publicado_em IS NOT NULL)
    FROM offerings),false),
  (SELECT count(*) FROM offerings)::text
ORDER BY verification;
