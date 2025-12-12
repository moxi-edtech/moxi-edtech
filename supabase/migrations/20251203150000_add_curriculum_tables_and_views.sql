-- 0. [CORREÇÃO] Criar tabela de vínculo Usuário <-> Escola (Necessária para o RLS)
CREATE TABLE IF NOT EXISTS escola_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'staff', -- ex: 'admin', 'professor', 'secretaria'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Garante que o mesmo usuário não tenha duplicidade na mesma escola
  UNIQUE(escola_id, user_id)
);

-- Habilitar RLS na tabela de usuários da escola
ALTER TABLE escola_users ENABLE ROW LEVEL SECURITY;

-- Política segura para escola_users (evita erro se já existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Usuarios veem suas proprias escolas' AND tablename = 'escola_users'
    ) THEN
        CREATE POLICY "Usuarios veem suas proprias escolas" ON escola_users FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;


-- 1. Criar tabela de cache global de cursos (REGISTRY)
CREATE TABLE IF NOT EXISTS cursos_globais_cache (
  hash TEXT PRIMARY KEY, 
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('primario', 'ciclo1', 'puniv', 'tecnico', 'geral')),
  usage_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_escola UUID REFERENCES escolas(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_nome_tipo UNIQUE(nome, tipo)
);

ALTER TABLE cursos_globais_cache ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Cursos globais são públicos para leitura' AND tablename = 'cursos_globais_cache') THEN
        CREATE POLICY "Cursos globais são públicos para leitura" ON cursos_globais_cache FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Autenticados podem sugerir novos cursos' AND tablename = 'cursos_globais_cache') THEN
        CREATE POLICY "Autenticados podem sugerir novos cursos" ON cursos_globais_cache FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');
    END IF;
END $$;


-- 2. Atualizar tabela cursos da escola
ALTER TABLE cursos 
  ADD COLUMN IF NOT EXISTS curso_global_id TEXT REFERENCES cursos_globais_cache(hash),
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS codigo TEXT, 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_codigo_por_escola') THEN 
        ALTER TABLE cursos ADD CONSTRAINT unique_codigo_por_escola UNIQUE (escola_id, codigo);
    END IF;
END $$;


-- 3. Criar tabela de Disciplinas
CREATE TABLE IF NOT EXISTS disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  curso_escola_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  
  nome TEXT NOT NULL,
  classe_nome TEXT NOT NULL, 
  nivel_ensino TEXT, 
  tipo TEXT DEFAULT 'core' CHECK (tipo IN ('core', 'eletivo', 'extra')),
  
  carga_horaria INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_disciplina_classe_curso UNIQUE(curso_escola_id, classe_nome, nome)
);

ALTER TABLE disciplinas ENABLE ROW LEVEL SECURITY;

-- [CORREÇÃO] Dropar policy antiga se existir para recriar sem erros
DROP POLICY IF EXISTS "Escola vê suas disciplinas" ON disciplinas;

CREATE POLICY "Escola vê suas disciplinas" ON disciplinas FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM escola_users WHERE escola_id = disciplinas.escola_id)
);


-- 4. Criar tabela de configurações de currículo
CREATE TABLE IF NOT EXISTS configuracoes_curriculo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(escola_id, curso_id)
);

ALTER TABLE configuracoes_curriculo ENABLE ROW LEVEL SECURITY;


-- 5. Adicionar relacionamento nas classes
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS curso_id UUID REFERENCES cursos(id) ON DELETE SET NULL;


-- 6. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_cursos_escola_global ON cursos(escola_id, curso_global_id);
CREATE INDEX IF NOT EXISTS idx_cursos_globais_hash ON cursos_globais_cache(hash);

CREATE INDEX IF NOT EXISTS idx_disciplinas_escola ON disciplinas(escola_id);


-- 7. Atualizar a VIEW
DROP VIEW IF EXISTS vw_turmas_para_matricula;

CREATE OR REPLACE VIEW vw_turmas_para_matricula AS
SELECT 
    t.id, 
    t.escola_id, 
    t.session_id, 
    t.nome as turma_nome, 
    t.turno, 
    t.capacidade_maxima, 
    t.sala,
    COALESCE(cl.nome, 'Classe não definida') as classe_nome,
    COALESCE(c.nome, 'Ensino Geral') as curso_nome,
    COALESCE(c.tipo, 'geral') as curso_tipo,
    c.is_custom as curso_is_custom,
    cgc.hash as curso_global_hash,
    (SELECT COUNT(*) FROM matriculas m WHERE m.turma_id = t.id AND m.status IN ('ativa', 'ativo')) as ocupacao_atual,
    (SELECT MAX(created_at) FROM matriculas m WHERE m.turma_id = t.id) as ultima_matricula
FROM turmas t
LEFT JOIN classes cl ON t.classe_id = cl.id
LEFT JOIN cursos c ON cl.curso_id = c.id
LEFT JOIN cursos_globais_cache cgc ON c.curso_global_id = cgc.hash;

GRANT SELECT ON vw_turmas_para_matricula TO anon, authenticated, service_role;