-- 1. Garantir que os "Cursos Gerais" existem na tabela de cursos
-- (Para podermos vincular as turmas que não são técnicas)
INSERT INTO cursos (escola_id, nome, codigo)
SELECT DISTINCT t.escola_id, 'Ensino Primário', 'primario_base'
FROM turmas t
WHERE NOT EXISTS (
    SELECT 1 FROM cursos c 
    WHERE c.escola_id = t.escola_id AND c.codigo = 'primario_base'
);

INSERT INTO cursos (escola_id, nome, codigo)
SELECT DISTINCT t.escola_id, 'Iº Ciclo do Secundário', 'ciclo1_geral'
FROM turmas t
WHERE NOT EXISTS (
    SELECT 1 FROM cursos c 
    WHERE c.escola_id = t.escola_id AND c.codigo = 'ciclo1_geral'
);

INSERT INTO cursos (escola_id, nome, codigo)
SELECT DISTINCT t.escola_id, 'IIº Ciclo (PUNIV)', 'puniv_geral'
FROM turmas t
WHERE NOT EXISTS (
    SELECT 1 FROM cursos c 
    WHERE c.escola_id = t.escola_id AND c.codigo = 'puniv_geral'
);

-- 2. Corrigir CLASSES (Preencher classe_id baseado no nome da turma)
-- Se a turma diz "10ª Classe", procuramos o ID da classe "10ª Classe" e atualizamos.

UPDATE turmas t
SET classe_id = c.id
FROM classes c
WHERE t.escola_id = c.escola_id
  AND t.classe_id IS NULL -- Só corrige quem não tem
  AND t.nome ILIKE c.nome || '%'; -- Ex: "10ª Classe A" contém "10ª Classe"

-- 3. Corrigir CURSOS (Preencher curso_id baseado na Classe)
-- Aqui aplicamos a lógica oficial de Angola diretamente no banco

-- A. Primário (1ª a 6ª)
UPDATE turmas t
SET curso_id = c.id
FROM cursos c
WHERE t.escola_id = c.escola_id
  AND c.codigo = 'primario_base'
  AND t.curso_id IS NULL
  AND (t.nome LIKE '1ª%' OR t.nome LIKE '2ª%' OR t.nome LIKE '3ª%' OR t.nome LIKE '4ª%' OR t.nome LIKE '5ª%' OR t.nome LIKE '6ª%');

-- B. Iº Ciclo (7ª a 9ª)
UPDATE turmas t
SET curso_id = c.id
FROM cursos c
WHERE t.escola_id = c.escola_id
  AND c.codigo = 'ciclo1_geral'
  AND t.curso_id IS NULL
  AND (t.nome LIKE '7ª%' OR t.nome LIKE '8ª%' OR t.nome LIKE '9ª%');

-- C. IIº Ciclo PUNIV (10ª a 12ª - Genérico se não tiver nome técnico)
-- Só aplica se não tiver "Técnico", "Informática", etc no nome
UPDATE turmas t
SET curso_id = c.id
FROM cursos c
WHERE t.escola_id = c.escola_id
  AND c.codigo = 'puniv_geral'
  AND t.curso_id IS NULL
  AND (t.nome LIKE '10ª%' OR t.nome LIKE '11ª%' OR t.nome LIKE '12ª%')
  AND t.nome NOT ILIKE '%Técnico%' 
  AND t.nome NOT ILIKE '%Informática%'
  AND t.nome NOT ILIKE '%Saúde%';

-- 4. Corrigir Cursos TÉCNICOS Específicos (Exemplo: Informática)
-- Procura o curso de Informática da escola e vincula às turmas que têm "Informática" no nome
UPDATE turmas t
SET curso_id = c.id
FROM cursos c
WHERE t.escola_id = c.escola_id
  AND (c.nome ILIKE '%Informática%' OR c.codigo ILIKE '%inf%')
  AND t.curso_id IS NULL
  AND (t.nome ILIKE '%Informática%' OR t.nome ILIKE '%INF%');

-- (Repete o bloco 4 para Enfermagem, Gestão, etc, se tiveres turmas antigas com esses nomes)
