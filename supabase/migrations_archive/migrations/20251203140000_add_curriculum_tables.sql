-- ============================================================
-- 1. TABELA GLOBAL DE CURSOS (REGISTRY)
-- ============================================================
CREATE TABLE IF NOT EXISTS cursos_globais_cache (
  hash TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('primario','ciclo1','puniv','tecnico','geral')),
  usage_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_escola UUID REFERENCES escolas(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_nome_tipo UNIQUE(nome, tipo)
);

ALTER TABLE cursos_globais_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cursos globais públicos para leitura"
  ON cursos_globais_cache FOR SELECT USING (true);

CREATE POLICY "Autenticados podem inserir"
  ON cursos_globais_cache FOR INSERT
  WITH CHECK (auth.role() IN ('authenticated','service_role'));



-- ============================================================
-- 2. ATUALIZAR TABELA DE CURSOS (POR ESCOLA)
-- ============================================================
ALTER TABLE cursos
  ADD COLUMN IF NOT EXISTS curso_global_id TEXT REFERENCES cursos_globais_cache(hash),
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'geral'
      CHECK (tipo IN ('primario','ciclo1','puniv','tecnico','geral')),
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_codigo_por_escola'
  ) THEN
    ALTER TABLE cursos ADD CONSTRAINT unique_codigo_por_escola UNIQUE (escola_id, codigo);
  END IF;
END $$;



-- ============================================================
-- 3. TABELA DE DISCIPLINAS (GERADA PELO CURRICULUM BUILDER)
-- ============================================================
CREATE TABLE IF NOT EXISTS disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  curso_escola_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,

  nome TEXT NOT NULL,
  classe_nome TEXT NOT NULL,        -- "10ª", "11ª", etc
  nivel_ensino TEXT DEFAULT 'base', -- opcional, usado por relatórios
  tipo TEXT DEFAULT 'core' CHECK (tipo IN ('core','eletivo','extra')),
  
  carga_horaria INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_disciplina_por_classe UNIQUE (curso_escola_id, classe_nome, nome)
);

ALTER TABLE disciplinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Escola vê suas disciplinas"
  ON disciplinas
  FOR SELECT USING (
    escola_id = (SELECT escola_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Escola cria suas disciplinas"
  ON disciplinas
  FOR INSERT WITH CHECK (
    escola_id = (SELECT escola_id FROM profiles WHERE id = auth.uid())
  );



-- ============================================================
-- 4. CONFIGURAÇÕES DO CURRÍCULO (MATRIZ, TURNOS, ETC.)
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracoes_curriculo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,

  config JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (escola_id, curso_id)
);

ALTER TABLE configuracoes_curriculo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Escola gerencia config"
  ON configuracoes_curriculo
  USING (
    escola_id = (SELECT escola_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    escola_id = (SELECT escola_id FROM profiles WHERE id = auth.uid())
  );



-- ============================================================
-- 5. RELACIONAMENTO DIRETO ENTRE TURMAS E CURSOS
-- ============================================================
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS curso_id UUID REFERENCES cursos(id) ON DELETE SET NULL;



-- ============================================================
-- 6. ÍNDICES IMPORTANTES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cursos_escola_global
  ON cursos (escola_id, curso_global_id);

CREATE INDEX IF NOT EXISTS idx_cursos_globais_hash
  ON cursos_globais_cache (hash);



CREATE INDEX IF NOT EXISTS idx_disciplinas_escola
  ON disciplinas (escola_id);



-- ============================================================
-- 7. VIEW PARA LISTAR TURMAS (COM TIPO DE CURSO)
-- ============================================================
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
  c.is_custom,
  cgc.hash AS curso_global_hash,

  (SELECT COUNT(*) FROM matriculas m
    WHERE m.turma_id = t.id
      AND m.status IN ('ativa','ativo')) AS ocupacao_atual,

  (SELECT MAX(m.created_at) FROM matriculas m WHERE m.turma_id = t.id)
    AS ultima_matricula

FROM turmas t
LEFT JOIN classes cl ON t.classe_id = cl.id
LEFT JOIN cursos c ON t.curso_id = c.id
LEFT JOIN cursos_globais_cache cgc ON c.curso_global_id = cgc.hash;

GRANT SELECT ON vw_turmas_para_matricula TO anon, authenticated, service_role;
