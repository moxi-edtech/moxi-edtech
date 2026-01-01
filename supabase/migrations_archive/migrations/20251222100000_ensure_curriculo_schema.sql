-- Garante o esquema acadêmico essencial (cursos, classes, disciplinas, turmas e matrículas)
-- conforme solicitado. Tudo é idempotente para evitar conflitos com dados existentes.

-- 1) CURSOS
CREATE TABLE IF NOT EXISTS public.cursos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    nome text NOT NULL,
    codigo text,
    tipo text NOT NULL DEFAULT 'geral',
    created_at timestamptz DEFAULT now(),
    UNIQUE(escola_id, nome)
);

ALTER TABLE public.cursos
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'cursos' AND indexname = 'idx_cursos_escola_nome'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX idx_cursos_escola_nome ON public.cursos (escola_id, nome);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Não foi possível criar idx_cursos_escola_nome: %', SQLERRM;
    END;
  END IF;
END $$;


-- 2) CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
    nome text NOT NULL,
    ordem int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(escola_id, curso_id, nome)
);

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS curso_id uuid REFERENCES public.cursos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ordem int,
  ALTER COLUMN ordem SET DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'classes' AND indexname = 'idx_classes_escola_curso_nome'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX idx_classes_escola_curso_nome ON public.classes (escola_id, curso_id, nome);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Não foi possível criar idx_classes_escola_curso_nome: %', SQLERRM;
    END;
  END IF;
END $$;


-- 3) DISCIPLINAS
CREATE TABLE IF NOT EXISTS public.disciplinas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
    classe_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    nome text NOT NULL,
    sigla text,
    tipo text DEFAULT 'nuclear',
    created_at timestamptz DEFAULT now(),
    UNIQUE(escola_id, classe_id, nome)
);

ALTER TABLE public.disciplinas
  ADD COLUMN IF NOT EXISTS curso_id uuid REFERENCES public.cursos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS classe_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sigla text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
BEGIN
  -- Garante a coluna tipo e amplia os valores aceitos
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'disciplinas' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE public.disciplinas ADD COLUMN tipo text DEFAULT 'nuclear';
  ELSE
    ALTER TABLE public.disciplinas ALTER COLUMN tipo SET DEFAULT 'nuclear';
  END IF;

  -- Ajusta a constraint de tipo para incluir os valores solicitados
  ALTER TABLE public.disciplinas DROP CONSTRAINT IF EXISTS disciplinas_tipo_check;
  ALTER TABLE public.disciplinas DROP CONSTRAINT IF EXISTS disciplinas_tipo_valid;
  ALTER TABLE public.disciplinas
    ADD CONSTRAINT disciplinas_tipo_valid CHECK (tipo IN ('nuclear','atraso','opcao','core','eletivo','extra'));

  -- Índice de unicidade baseado no escopo desejado
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_disciplinas_escola_classe_nome'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX idx_disciplinas_escola_classe_nome ON public.disciplinas (escola_id, classe_id, nome);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Não foi possível criar idx_disciplinas_escola_classe_nome: %', SQLERRM;
    END;
  END IF;
END $$;


-- 4) TURMAS
CREATE TABLE IF NOT EXISTS public.turmas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    classe_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    curso_id uuid REFERENCES public.cursos(id),
    nome text NOT NULL,
    turno text NOT NULL,
    ano_letivo int NOT NULL,
    sala text,
    capacidade int DEFAULT 35,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.turmas
  ADD COLUMN IF NOT EXISTS classe_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS curso_id uuid REFERENCES public.cursos(id),
  ADD COLUMN IF NOT EXISTS turno text,
  ADD COLUMN IF NOT EXISTS ano_letivo int,
  ADD COLUMN IF NOT EXISTS sala text,
  ADD COLUMN IF NOT EXISTS capacidade int,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.turmas ALTER COLUMN capacidade SET DEFAULT 35;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_turmas_unica'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX idx_turmas_unica ON public.turmas (escola_id, ano_letivo, classe_id, turno, nome);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Não foi possível criar idx_turmas_unica: %', SQLERRM;
    END;
  END IF;
END $$;


-- 5) TURMA_DISCIPLINAS
CREATE TABLE IF NOT EXISTS public.turma_disciplinas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
    disciplina_id uuid NOT NULL REFERENCES public.disciplinas(id) ON DELETE RESTRICT,
    professor_id uuid,
    created_at timestamptz DEFAULT now(),
    UNIQUE(turma_id, disciplina_id)
);

ALTER TABLE public.turma_disciplinas
  ADD COLUMN IF NOT EXISTS professor_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_turma_disciplinas_unica'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX idx_turma_disciplinas_unica ON public.turma_disciplinas (turma_id, disciplina_id);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Não foi possível criar idx_turma_disciplinas_unica: %', SQLERRM;
    END;
  END IF;
END $$;


-- 6) TRIGGER PARA SINCRONIZAR DISCIPLINAS AO CRIAR TURMA
CREATE OR REPLACE FUNCTION public.sync_disciplinas_ao_criar_turma()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.classe_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.turma_disciplinas (escola_id, turma_id, disciplina_id)
    SELECT NEW.escola_id, NEW.id, d.id
    FROM public.disciplinas d
    WHERE d.classe_id = NEW.classe_id
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_disciplinas ON public.turmas;
CREATE TRIGGER trg_auto_disciplinas
AFTER INSERT ON public.turmas
FOR EACH ROW
EXECUTE FUNCTION public.sync_disciplinas_ao_criar_turma();


-- 7) MATRÍCULAS
CREATE TABLE IF NOT EXISTS public.matriculas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE RESTRICT,
    turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE RESTRICT,
    numero_chamada int,
    status text DEFAULT 'ativo',
    data_matricula date DEFAULT current_date,
    UNIQUE(aluno_id, turma_id)
);

ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS numero_chamada int,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS data_matricula date DEFAULT current_date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_matriculas_unica_aluno_turma'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX idx_matriculas_unica_aluno_turma ON public.matriculas (aluno_id, turma_id);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Não foi possível criar idx_matriculas_unica_aluno_turma: %', SQLERRM;
    END;
  END IF;
END $$;
