-- PRE_ESCOLAR is an independent education subsystem, not ensino secundario.
-- Resolve it from the canonical curriculum preset even if a legacy turma
-- has nivel_ensino='secundario'. Other academic regimes are unchanged.
-- Data corrections for the CURTUME pilot were applied with audited,
-- school-scoped SQL on 2026-11-04 (not replayed globally here).

CREATE OR REPLACE FUNCTION public.resolve_regime_academico(p_turma_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN curso.curriculum_key = 'pre_escolar'
           OR lower(trim(coalesce(t.nivel_ensino, ''))) = 'pre_escolar'
      THEN
        public.resolve_regime_academico_atributos(
          'pre_escolar',
          coalesce(t.classe_num, c.numero),
          t.ano_numero,
          t.modulo_numero,
          t.nome,
          coalesce(c.nivel, curso.nivel),
          curso.curriculum_key
        ) || jsonb_build_object(
          'nivel_ensino', 'pre_escolar',
          'codigo_regime', 'pre_escolar',
          'eh_classe_exame', false,
          'escala', 'qualitativa',
          'tipo_exame_nacional', NULL,
          'formula_mfd', jsonb_build_object(
            'tipo', 'qualitativa',
            'peso_percurso', 1.0,
            'peso_exame', 0.0
          ),
          'exames_aplicaveis', '[]'::jsonb
        )
      ELSE
        public.resolve_regime_academico_atributos(
          t.nivel_ensino,
          coalesce(t.classe_num, c.numero),
          t.ano_numero,
          t.modulo_numero,
          t.nome,
          coalesce(c.nivel, curso.nivel),
          curso.curriculum_key
        )
    END
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  LEFT JOIN public.cursos curso ON curso.id = t.curso_id
  WHERE t.id = p_turma_id;
$function$;
