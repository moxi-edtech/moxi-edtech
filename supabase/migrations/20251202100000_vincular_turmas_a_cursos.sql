-- 1. Garantir que os cursos Técnicos existem
-- (Isto não duplica, só insere se não existir)
INSERT INTO cursos (escola_id, nome, codigo, tipo)
SELECT DISTINCT escola_id, 'Técnico de Informática', 'tec_info', 'tecnico' FROM turmas
WHERE NOT EXISTS (SELECT 1 FROM cursos c WHERE c.escola_id = turmas.escola_id AND c.nome = 'Técnico de Informática');

INSERT INTO cursos (escola_id, nome, codigo, tipo)
SELECT DISTINCT escola_id, 'Técnico de Gestão', 'tec_gest', 'tecnico' FROM turmas
WHERE NOT EXISTS (SELECT 1 FROM cursos c WHERE c.escola_id = turmas.escola_id AND c.nome = 'Técnico de Gestão');

-- 2. VINCULAR TURMAS AOS CURSOS (A CORREÇÃO REAL)

-- A. Vincula tudo o que é 10ª, 11ª, 12ª, 13ª ao curso de Informática (Exemplo: Ajusta conforme a tua realidade)
-- Se a tua escola só tem Informática no médio, isto resolve tudo.
UPDATE turmas t
SET curso_id = c.id
FROM cursos c
WHERE t.escola_id = c.escola_id
  AND c.nome = 'Técnico de Informática' -- <--- MUDAR AQUI SE FOR OUTRO CURSO
  AND t.curso_id IS NULL -- Só corrige quem está sem curso
  AND (t.nome LIKE '%10ª%' OR t.nome LIKE '%11ª%' OR t.nome LIKE '%12ª%' OR t.nome LIKE '%13ª%');

-- B. Vincula 7ª, 8ª, 9ª ao Iº Ciclo
UPDATE turmas t
SET curso_id = c.id
FROM cursos c
WHERE t.escola_id = c.escola_id
  AND c.nome = 'Iº Ciclo do Secundário'
  AND (t.nome LIKE '%7ª%' OR t.nome LIKE '%8ª%' OR t.nome LIKE '%9ª%');
