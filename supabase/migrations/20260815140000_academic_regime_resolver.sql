BEGIN;

-- Fundação do RAA: o regime académico é derivado do nível e da etapa da turma.
-- A coluna histórica is_classe_exame não participa da decisão automática.
ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS nivel_ensino text,
  ADD COLUMN IF NOT EXISTS ano_numero integer,
  ADD COLUMN IF NOT EXISTS modulo_numero integer;

COMMENT ON COLUMN public.turmas.nivel_ensino IS
  'Nível/subsistema académico normalizado: primario, secundario ou eja.';
COMMENT ON COLUMN public.turmas.ano_numero IS
  'Ano da etapa quando a oferta usa anos (por exemplo, 2.º ano da EJA).';
COMMENT ON COLUMN public.turmas.modulo_numero IS
  'Módulo da etapa quando a oferta usa módulos (por exemplo, Módulo 3 da EJA).';

-- Backfill conservador para dados já existentes. A origem oficial passa a ser
-- o trio normalizado; o texto serve apenas para recuperar legados sem metadados.
UPDATE public.turmas t
SET nivel_ensino = CASE
      WHEN lower(concat_ws(' ', t.nome, source.classe_nome, source.classe_nivel, source.curso_nome, source.curso_nivel, source.curriculum_key)) ~ '(eja|adult)' THEN 'eja'
      WHEN coalesce(t.classe_num, source.classe_numero) BETWEEN 1 AND 6
        OR lower(concat_ws(' ', t.nome, source.classe_nome, source.classe_nivel, source.curso_nome, source.curso_nivel, source.curriculum_key)) ~ 'prim' THEN 'primario'
      ELSE 'secundario'
    END,
    ano_numero = COALESCE(
      t.ano_numero,
      CASE
        WHEN lower(t.nome) ~ '([0-9]{1,2})[ºªa]? *ano' THEN
          substring(lower(t.nome) from '([0-9]{1,2})[ºªa]? *ano')::integer
        ELSE NULL
      END
    ),
    modulo_numero = COALESCE(
      t.modulo_numero,
      CASE
        WHEN lower(t.nome) ~ 'm[oó]dulo *([0-9]{1,2})' THEN
          substring(lower(t.nome) from 'm[oó]dulo *([0-9]{1,2})')::integer
        ELSE NULL
      END
    )
FROM (
  SELECT
    c.id AS classe_id,
    c.nome AS classe_nome,
    c.nivel AS classe_nivel,
    c.numero AS classe_numero,
    curso.nome AS curso_nome,
    curso.nivel AS curso_nivel,
    curso.curriculum_key
  FROM public.classes c
  LEFT JOIN public.cursos curso ON curso.id = c.curso_id
) source
WHERE source.classe_id = t.classe_id;

CREATE OR REPLACE FUNCTION public.resolve_regime_academico_atributos(
  p_nivel_ensino text,
  p_classe_num integer,
  p_ano_numero integer,
  p_modulo_numero integer,
  p_nome text DEFAULT NULL,
  p_nivel_legado text DEFAULT NULL,
  p_curriculum_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_nivel text := lower(trim(coalesce(p_nivel_ensino, p_nivel_legado, '')));
  v_classe integer := p_classe_num;
  v_ano integer := p_ano_numero;
  v_modulo integer := p_modulo_numero;
  v_texto text := lower(coalesce(p_nome, '') || ' ' || coalesce(p_curriculum_key, ''));
  v_eh_exame boolean := false;
  v_codigo text := 'transicao';
  v_formula jsonb := jsonb_build_object(
    'tipo', 'transicao',
    'mfd', '(MT1 + MT2 + MT3) / 3',
    'peso_percurso', 1.0,
    'peso_exame', 0.0
  );
  v_exames jsonb := '[]'::jsonb;
BEGIN
  IF v_nivel = '' THEN
    v_nivel := CASE
      WHEN v_texto ~ '(eja|adult)' THEN 'eja'
      WHEN coalesce(v_classe, 0) BETWEEN 1 AND 6 THEN 'primario'
      ELSE 'secundario'
    END;
  END IF;

  -- Legados que ainda não têm os campos normalizados.
  IF v_classe IS NULL AND v_texto ~ '(^|[^0-9])([0-9]{1,2})[ºªa]? *classe' THEN
    v_classe := substring(v_texto from '([0-9]{1,2})[ºªa]? *classe')::integer;
  END IF;
  IF v_ano IS NULL AND v_texto ~ '([0-9]{1,2})[ºªa]? *ano' THEN
    v_ano := substring(v_texto from '([0-9]{1,2})[ºªa]? *ano')::integer;
  END IF;
  IF v_modulo IS NULL AND v_texto ~ 'm[oó]dulo *([0-9]{1,2})' THEN
    v_modulo := substring(v_texto from 'm[oó]dulo *([0-9]{1,2})')::integer;
  END IF;

  IF (v_nivel = 'primario' AND v_classe = 6)
     OR (v_nivel = 'secundario' AND v_classe IN (9, 12))
     OR (v_nivel = 'eja' AND (v_modulo = 3 OR v_ano = 2)) THEN
    v_eh_exame := true;
  END IF;

  IF v_nivel = 'primario' AND v_classe = 6 THEN
    v_codigo := '6_classe';
  ELSIF v_nivel = 'secundario' AND v_classe = 9 THEN
    v_codigo := '9_classe';
  ELSIF v_nivel = 'secundario' AND v_classe = 12 THEN
    v_codigo := '12_classe';
  ELSIF v_nivel = 'eja' AND v_modulo = 3 THEN
    v_codigo := 'modulo_3_eja';
  ELSIF v_nivel = 'eja' AND v_ano = 2 THEN
    v_codigo := '2_ano_eja';
  END IF;

  IF v_eh_exame THEN
    v_exames := jsonb_build_array('exame_nacional', 'recurso', 'extraordinario', 'melhoria_nota');
    v_formula := CASE
      WHEN v_codigo = '12_classe' THEN jsonb_build_object(
        'tipo', 'exame_nacional',
        'mfd_combinado', '0.5 * MT3 + 0.5 * MENC',
        'mfd_simples', '0.5 * MT3 + 0.5 * NEN',
        'mfd_sem_exame_nacional', '(MT1 + MT2 + MACT3) / 3',
        'peso_percurso', 0.5,
        'peso_exame', 0.5
      )
      ELSE jsonb_build_object(
        'tipo', 'exame_nacional',
        'mfd_combinado', '0.6 * MT3 + 0.4 * MENC',
        'mfd_simples', '0.6 * MT3 + 0.4 * NEN',
        'mfd_sem_exame_nacional', '(MT1 + MT2 + MACT3) / 3',
        'peso_percurso', 0.6,
        'peso_exame', 0.4
      )
    END;
  END IF;

  RETURN jsonb_build_object(
    'eh_classe_exame', v_eh_exame,
    'codigo_regime', v_codigo,
    'nivel_ensino', v_nivel,
    'classe_num', v_classe,
    'ano_numero', v_ano,
    'modulo_numero', v_modulo,
    'tipo_exame_nacional', CASE WHEN v_eh_exame THEN 'certificativo' ELSE NULL END,
    'escala', CASE WHEN v_nivel = 'primario' THEN 'quantitativa_primario' ELSE 'quantitativa_secundario' END,
    'formula_mfd', v_formula,
    'exames_aplicaveis', v_exames
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_regime_academico(p_turma_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT public.resolve_regime_academico_atributos(
    t.nivel_ensino,
    coalesce(t.classe_num, c.numero),
    t.ano_numero,
    t.modulo_numero,
    t.nome,
    coalesce(c.nivel, curso.nivel),
    curso.curriculum_key
  )
  FROM public.turmas t
  LEFT JOIN public.classes c ON c.id = t.classe_id
  LEFT JOIN public.cursos curso ON curso.id = t.curso_id
  WHERE t.id = p_turma_id;
$$;

REVOKE ALL ON FUNCTION public.resolve_regime_academico_atributos(text, integer, integer, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_regime_academico_atributos(text, integer, integer, integer, text, text, text) TO authenticated;

-- Compatibilidade para funções legadas: a decisão continua a vir do resolvedor.
CREATE OR REPLACE FUNCTION public.is_turma_classe_exame(p_turma_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce((public.resolve_regime_academico(p_turma_id)->>'eh_classe_exame')::boolean, false);
$$;

-- Mantém consumidores legados coerentes enquanto migram para o objeto completo.
UPDATE public.turmas t
SET is_classe_exame = coalesce((public.resolve_regime_academico(t.id)->>'eh_classe_exame')::boolean, false);

REVOKE ALL ON FUNCTION public.resolve_regime_academico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_regime_academico(uuid) TO authenticated;

-- Contrato executável: uma linha por classe/nível definido pelo Decreto.
CREATE TABLE IF NOT EXISTS public.academic_regime_contract_cases (
  codigo text PRIMARY KEY,
  nivel_ensino text NOT NULL,
  classe_num integer,
  ano_numero integer,
  modulo_numero integer,
  esperado_codigo text NOT NULL,
  esperado_eh_classe_exame boolean NOT NULL,
  expected_peso_percurso numeric NOT NULL,
  expected_peso_exame numeric NOT NULL
);

INSERT INTO public.academic_regime_contract_cases
  (codigo, nivel_ensino, classe_num, ano_numero, modulo_numero, esperado_codigo,
   esperado_eh_classe_exame, expected_peso_percurso, expected_peso_exame)
VALUES
  ('primario_6', 'primario', 6, NULL, NULL, '6_classe', true, 0.6, 0.4),
  ('secundario_9', 'secundario', 9, NULL, NULL, '9_classe', true, 0.6, 0.4),
  ('secundario_12', 'secundario', 12, NULL, NULL, '12_classe', true, 0.5, 0.5),
  ('eja_modulo_3', 'eja', NULL, NULL, 3, 'modulo_3_eja', true, 0.6, 0.4),
  ('eja_2_ano', 'eja', NULL, 2, NULL, '2_ano_eja', true, 0.6, 0.4)
ON CONFLICT (codigo) DO UPDATE SET
  nivel_ensino = EXCLUDED.nivel_ensino,
  classe_num = EXCLUDED.classe_num,
  ano_numero = EXCLUDED.ano_numero,
  modulo_numero = EXCLUDED.modulo_numero,
  esperado_codigo = EXCLUDED.esperado_codigo,
  esperado_eh_classe_exame = EXCLUDED.esperado_eh_classe_exame,
  expected_peso_percurso = EXCLUDED.expected_peso_percurso,
  expected_peso_exame = EXCLUDED.expected_peso_exame;

CREATE OR REPLACE FUNCTION public.assert_academic_regime_contract()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v jsonb;
BEGIN
  FOR r IN SELECT * FROM public.academic_regime_contract_cases LOOP
    v := public.resolve_regime_academico_atributos(
      r.nivel_ensino, r.classe_num, r.ano_numero, r.modulo_numero
    );
    IF v->>'codigo_regime' IS DISTINCT FROM r.esperado_codigo
       OR (v->>'eh_classe_exame')::boolean IS DISTINCT FROM r.esperado_eh_classe_exame
       OR (v#>>'{formula_mfd,peso_percurso}')::numeric IS DISTINCT FROM r.expected_peso_percurso
       OR (v#>>'{formula_mfd,peso_exame}')::numeric IS DISTINCT FROM r.expected_peso_exame THEN
      RAISE EXCEPTION 'Contrato de regime académico falhou no caso %: %', r.codigo, v;
    END IF;
  END LOOP;
END;
$$;

SELECT public.assert_academic_regime_contract();

COMMIT;
