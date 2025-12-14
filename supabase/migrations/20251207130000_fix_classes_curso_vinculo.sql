-- Garante que classes 10-13 estejam sempre vinculadas a cursos (técnicos ou PUNIV)
-- 1) Corrige dados órfãos usando o curso definido na própria turma
-- 2) Cria restrição para impedir novos órfãos
-- 3) Recria view sem fallback, agora confiando no vínculo obrigatório

-- 0. Garante que cada escola tenha um curso padrão PUNIV para fallback de classes órfãs
INSERT INTO cursos (escola_id, nome, codigo, tipo)
SELECT DISTINCT c.escola_id, 'IIº Ciclo (PUNIV)', 'puniv_geral', 'puniv'
FROM classes c
WHERE c.nome ~ '(^|\s)(10|11|12|13)'
  AND c.curso_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM cursos cx WHERE cx.escola_id = c.escola_id AND cx.codigo = 'puniv_geral'
  );

-- 1. Ajuste de dados: preenche classes de 10-13 sem curso usando curso_id das turmas associadas
UPDATE classes c
SET curso_id = t.curso_id
FROM turmas t
WHERE t.classe_id = c.id
  AND c.curso_id IS NULL
  AND t.curso_id IS NOT NULL
  AND c.nome ~ '(^|\s)(10|11|12|13)';

-- 1b. Fallback: classes de 10-13 sem turma vinculada recebem o curso PUNIV genérico
UPDATE classes c
SET curso_id = fallback.id
FROM cursos fallback
WHERE c.curso_id IS NULL
  AND c.nome ~ '(^|\s)(10|11|12|13)'
  AND fallback.escola_id = c.escola_id
  AND fallback.codigo = 'puniv_geral';

-- 2. Restrição: classes de 10ª a 13ª devem ter curso vinculado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classes_curso_obrigatorio_10a_13a'
  ) THEN
    ALTER TABLE classes
      ADD CONSTRAINT classes_curso_obrigatorio_10a_13a
      CHECK (
        NOT (
          (nome ~ '(^|\s)(10|11|12|13)' OR nome ILIKE '10%classe' OR nome ILIKE '11%classe' OR nome ILIKE '12%classe' OR nome ILIKE '13%classe')
          AND curso_id IS NULL
        )
      );
  END IF;
END $$;

-- 3. View: remove fallback e confia no vínculo obrigatório
DROP VIEW IF EXISTS vw_turmas_para_matricula;

CREATE OR REPLACE VIEW vw_turmas_para_matricula AS
SELECT 
    t.id,
    t.escola_id,
    t.session_id,
    t.nome AS turma_nome,
    t.turno,
    t.capacidade_maxima,
    t.sala,
    COALESCE(cl.nome, 'Classe não definida') AS classe_nome,
    c.nome AS curso_nome,
    c.tipo AS curso_tipo,
    COALESCE(c.is_custom, false) AS curso_is_custom,
    cgc.hash AS curso_global_hash,
    t.classe_id,
    c.id AS curso_id,
    (SELECT COUNT(*) FROM matriculas m WHERE m.turma_id = t.id AND m.status IN ('ativa','ativo')) AS ocupacao_atual,
    (SELECT MAX(created_at) FROM matriculas m WHERE m.turma_id = t.id) AS ultima_matricula
FROM turmas t
LEFT JOIN classes cl ON t.classe_id = cl.id
LEFT JOIN cursos c ON cl.curso_id = c.id
LEFT JOIN cursos_globais_cache cgc ON c.curso_global_id = cgc.hash;

GRANT SELECT ON vw_turmas_para_matricula TO anon, authenticated, service_role;
