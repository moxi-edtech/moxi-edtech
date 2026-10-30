-- SAFE READ-ONLY AUDIT. Designed for manual review, not for mutation.
-- Scope: Escola KLASSE / 2026/27, preserving all historical IDs.
-- Prerequisite: apply the canonical MED migration in a STAGING database;
-- never use this to make production changes.
-- Output A: school year, trimester dates, official linkage and lock state.
SELECT
  e.nome AS escola, a.id AS ano_letivo_id, a.ano,
  a.data_inicio AS ano_inicio, a.data_fim AS ano_fim,
  c.data_inicio AS med_inicio, c.data_fim AS med_fim,
  c.versao_documento,
  p.id AS periodo_id, p.numero, p.tipo,
  p.data_inicio AS periodo_inicio, p.data_fim AS periodo_fim,
  p.peso, p.trava_notas_em, p.offering_id,
  p.source_template_id, p.source_item_id,
  EXISTS (
    SELECT 1
      FROM public.calendario_template_items i
      JOIN public.calendario_templates t ON t.id=i.template_id
     WHERE i.id=p.source_item_id AND t.id=p.source_template_id
       AND t.calendario_canonico_ano=a.ano
       AND i.tipo::text='PERIODO_LETIVO'
       AND i.numero=p.numero AND i.data_inicio=p.data_inicio
       AND i.data_fim=p.data_fim AND i.peso IS NOT DISTINCT FROM p.peso
  ) AS periodo_sincronizado_med
FROM public.escolas e
JOIN public.anos_letivos a ON a.escola_id=e.id AND a.ano=2026
LEFT JOIN public.calendarios_oficiais_anos c ON c.ano_base=a.ano
LEFT JOIN public.periodos_letivos p ON p.escola_id=e.id AND p.ano_letivo_id=a.id
WHERE e.nome='Escola KLASSE'
ORDER BY p.numero;

-- Output B: explicit course-offering links and their official legal profile.
SELECT
  e.nome AS escola, curso.id AS curso_id, curso.nome AS curso,
  o.id AS oferta_id, o.status AS oferta_estado,
  o.education_subsystem AS subsistema,
  o.education_level AS nivel, o.cycle AS ciclo, o.grades AS classes,
  t.id AS perfil_id, t.nome AS perfil,
  t.ano_base AS perfil_ano, t.calendario_canonico_ano,
  t.is_oficial, t.estado AS perfil_estado,
  CASE
    WHEN curso.id IS NULL THEN 'CURSO_SEM_VINCULO'
    WHEN t.id IS NULL THEN 'PERFIL_AUSENTE'
    WHEN t.subsistema IS DISTINCT FROM o.education_subsystem THEN 'SUBSISTEMA_INCOMPATIVEL'
    WHEN t.calendario_canonico_ano IS DISTINCT FROM 2026 THEN 'CALENDARIO_NAO_VINCULADO'
    WHEN NOT (t.is_oficial AND t.estado='PUBLICADO') THEN 'PERFIL_NAO_PUBLICADO'
    ELSE 'PERFIL_COMPATIVEL'
  END AS integridade
FROM public.escolas e
JOIN public.school_education_offerings o ON o.escola_id=e.id
LEFT JOIN public.cursos curso ON curso.id=o.course_id AND curso.escola_id=e.id
LEFT JOIN public.calendario_templates t ON t.id=o.calendar_profile_id
WHERE e.nome='Escola KLASSE' AND o.status='active'
ORDER BY o.education_subsystem,curso.nome,o.id;

-- Output C: official event provenance and course scope, without interpreting
-- a specific course exam as applicable to every pupil in the school.
SELECT
  e.nome AS escola, a.ano, ev.id, ev.tipo, ev.nome,
  ev.data_inicio, ev.data_fim,
  CASE WHEN ev.offering_id IS NULL THEN 'GLOBAL' ELSE 'OFERTA' END AS abrangencia,
  curso.nome AS curso, ev.offering_id,
  ev.source_template_id, ev.source_item_id, t.subsistema AS perfil_subsistema,
  CASE
    WHEN ev.source_template_id IS NULL THEN 'EVENTO_LOCAL_SEM_FONTE_MED'
    WHEN ev.source_item_id IS NULL THEN 'ORIGEM_INCOMPLETA'
    WHEN t.calendario_canonico_ano IS DISTINCT FROM a.ano THEN 'FONTE_OUTRO_ANO'
    WHEN ev.offering_id IS NOT NULL AND o.id IS NULL THEN 'OFERTA_INCOMPATIVEL'
    WHEN ev.offering_id IS NOT NULL
     AND o.education_subsystem IS DISTINCT FROM t.subsistema THEN 'SUBSISTEMA_DIVERGENTE'
    ELSE 'REVER_APLICABILIDADE'
  END AS resultado
FROM public.escolas e
JOIN public.anos_letivos a ON a.escola_id=e.id AND a.ano=2026
JOIN public.calendario_eventos ev ON ev.escola_id=e.id AND ev.ano_letivo_id=a.id
LEFT JOIN public.school_education_offerings o
  ON o.id=ev.offering_id AND o.escola_id=e.id
LEFT JOIN public.cursos curso ON curso.id=o.course_id AND curso.escola_id=e.id
LEFT JOIN public.calendario_templates t ON t.id=ev.source_template_id
WHERE e.nome='Escola KLASSE'
ORDER BY ev.data_inicio,ev.nome,ev.offering_id;

-- Read-only outputs must be reviewed with registrar/academic direction
-- before any official correction. Preserve period UUIDs, grades and notes.
