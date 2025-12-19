-- ==============================================================================
-- MASTER SCRIPT: ARQUITETURA ESCOLAR ANGOLA (FINAL v3.1 - Fix Dependencies)
-- ==============================================================================

BEGIN;

-- -------------------------------------------------------------
-- 0. REMOVER DEPENDÊNCIAS BLOQUEANTES (VIEWS LEGADAS)
-- -------------------------------------------------------------
-- Precisamos remover estas views pois elas apontam para a coluna 'classe' (texto)
-- que vamos excluir. Depois você deve recriar estas views apontando para 'classe_id'.
DROP VIEW IF EXISTS public.vw_ocupacao_turmas CASCADE;
DROP VIEW IF EXISTS public.vw_financeiro_propinas_por_turma CASCADE;


-- -------------------------------------------------------------
-- 1. HARD RESET (OPCIONAL - MANTENHA COMENTADO SE TIVER DADOS REAIS)
-- -------------------------------------------------------------
-- TRUNCATE TABLE public.financeiro_lancamentos CASCADE;
-- TRUNCATE TABLE public.matriculas CASCADE;
-- TRUNCATE TABLE public.alunos CASCADE;
-- TRUNCATE TABLE public.staging_alunos CASCADE;
-- TRUNCATE TABLE public.import_errors CASCADE;


-- -------------------------------------------------------------
-- 2. TABELA DE ERROS (Logs)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL,
  row_number int,
  message text NOT NULL,
  raw_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- -------------------------------------------------------------
-- 3. TABELA ALUNOS (Identidade)
-- -------------------------------------------------------------
ALTER TABLE public.alunos
  ALTER COLUMN profile_id DROP NOT NULL,
  
  -- Identidade
  ADD COLUMN IF NOT EXISTS numero_processo text,
  ADD COLUMN IF NOT EXISTS bi_numero text,
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  
  -- Encarregado
  ADD COLUMN IF NOT EXISTS encarregado_nome text,
  ADD COLUMN IF NOT EXISTS encarregado_telefone text,
  ADD COLUMN IF NOT EXISTS encarregado_email text;

-- 3.1 Gerador de Processo
CREATE TABLE IF NOT EXISTS public.aluno_processo_counters (
  escola_id uuid PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.next_numero_processo(p_escola_id uuid, p_year int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next bigint;
BEGIN
  INSERT INTO public.aluno_processo_counters (escola_id, last_value) VALUES (p_escola_id, 0) ON CONFLICT (escola_id) DO NOTHING;
  UPDATE public.aluno_processo_counters SET last_value = last_value + 1 WHERE escola_id = p_escola_id RETURNING last_value INTO v_next;
  RETURN p_year::text || '-' || lpad(v_next::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.before_insert_alunos_set_processo()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero_processo IS NULL OR btrim(NEW.numero_processo) = '' THEN
    NEW.numero_processo := public.next_numero_processo(NEW.escola_id, EXTRACT(YEAR FROM now())::int);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alunos_set_processo ON public.alunos;
CREATE TRIGGER trg_alunos_set_processo BEFORE INSERT ON public.alunos FOR EACH ROW EXECUTE PROCEDURE public.before_insert_alunos_set_processo();

-- 3.2 Unicidade
DROP INDEX IF EXISTS idx_alunos_escola_processo;
CREATE UNIQUE INDEX idx_alunos_escola_processo ON public.alunos (escola_id, numero_processo);


-- -------------------------------------------------------------
-- 4. TABELA TURMAS (Agora vai funcionar!)
-- -------------------------------------------------------------
ALTER TABLE public.turmas
  DROP COLUMN IF EXISTS classe,      
  DROP COLUMN IF NOT EXISTS capacidade,  
  ADD COLUMN IF NOT EXISTS turma_codigo text;

-- Converter ano
DO $$ BEGIN
  ALTER TABLE public.turmas ALTER COLUMN ano_letivo TYPE integer USING (ano_letivo::integer);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Unicidade
DROP INDEX IF EXISTS uq_turmas_escola_ano_codigo;
CREATE UNIQUE INDEX uq_turmas_escola_ano_codigo ON public.turmas (escola_id, ano_letivo, turma_codigo);


-- -------------------------------------------------------------
-- 5. TABELA MATRICULAS
-- -------------------------------------------------------------
ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS numero_matricula text,
  ADD COLUMN IF NOT EXISTS numero_chamada integer,
  ADD COLUMN IF NOT EXISTS ano_letivo integer;

ALTER TABLE public.matriculas DROP CONSTRAINT IF EXISTS matricula_unica_ano;
ALTER TABLE public.matriculas ADD CONSTRAINT matricula_unica_ano UNIQUE (escola_id, aluno_id, ano_letivo);


-- -------------------------------------------------------------
-- 6. TABELA STAGING
-- -------------------------------------------------------------
ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS numero_processo text,
  ADD COLUMN IF NOT EXISTS bi_numero text,
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS encarregado_telefone text,
  ADD COLUMN IF NOT EXISTS encarregado_email text,
  ADD COLUMN IF NOT EXISTS turma_codigo text;


-- -------------------------------------------------------------
-- 7. TRIGGER: PROFILE (Schema Ajustado)
-- -------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'encarregado';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, nome, email, role, numero_login, telefone, onboarding_finalizado
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    NEW.email,
    'encarregado'::user_role,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    false
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    numero_login = COALESCE(EXCLUDED.numero_login, public.profiles.numero_login),
    telefone = COALESCE(EXCLUDED.telefone, public.profiles.telefone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- -------------------------------------------------------------
-- 8. RPC: IMPORTAÇÃO
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.importar_alunos(
  p_import_id uuid,
  p_escola_id uuid,
  p_ano_letivo int
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
  v_aluno_id uuid;
  v_turma_id uuid;
  v_total_imported int := 0;
  v_total_errors int := 0;
BEGIN
  FOR r IN SELECT * FROM public.staging_alunos WHERE import_id = p_import_id LOOP
    BEGIN
      -- Validações
      IF r.encarregado_telefone IS NULL THEN RAISE EXCEPTION 'Telefone obrigatório'; END IF;
      IF r.turma_codigo IS NULL THEN RAISE EXCEPTION 'Código da Turma obrigatório'; END IF;

      -- Upsert Aluno
      INSERT INTO public.alunos (
        escola_id, numero_processo, nome_completo, bi_numero, nif, 
        encarregado_nome, encarregado_telefone, encarregado_email
      )
      VALUES (
        p_escola_id, r.numero_processo, r.nome, r.bi_numero,
        COALESCE(r.nif, r.bi_numero),
        r.responsavel, r.encarregado_telefone, r.encarregado_email
      )
      ON CONFLICT (escola_id, numero_processo) DO UPDATE SET
        nome_completo = EXCLUDED.nome_completo,
        bi_numero = EXCLUDED.bi_numero,
        encarregado_telefone = EXCLUDED.encarregado_telefone,
        updated_at = now()
      RETURNING id INTO v_aluno_id;

      -- Busca Turma
      SELECT id INTO v_turma_id FROM public.turmas 
      WHERE escola_id = p_escola_id AND turma_codigo = r.turma_codigo AND ano_letivo = p_ano_letivo;

      IF v_turma_id IS NULL THEN RAISE EXCEPTION 'Turma não encontrada: %', r.turma_codigo; END IF;

      -- Matrícula
      INSERT INTO public.matriculas (
        escola_id, aluno_id, turma_id, ano_letivo, status, ativo, 
        numero_matricula, data_matricula
      )
      VALUES (
        p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, 'ativo', true,
        (SELECT numero_processo FROM public.alunos WHERE id = v_aluno_id) || '/' || p_ano_letivo, now()
      )
      ON CONFLICT (escola_id, aluno_id, ano_letivo) DO NOTHING;

      v_total_imported := v_total_imported + 1;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.import_errors (import_id, row_number, message, raw_value)
      VALUES (p_import_id, r.row_number, SQLERRM, COALESCE(r.numero_processo, r.nome));
      v_total_errors := v_total_errors + 1;
    END;
  END LOOP;

  RETURN json_build_object('imported', v_total_imported, 'errors', v_total_errors);
END;
$$;

-- -------------------------------------------------------------
-- 9. TABELA DISCIPLINAS
-- -------------------------------------------------------------
ALTER TABLE public.disciplinas
  DROP CONSTRAINT IF EXISTS unique_disciplina_por_classe,
  DROP COLUMN IF EXISTS classe_nome,
  ADD COLUMN IF NOT EXISTS classe_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_disciplina_por_classe ON public.disciplinas (curso_escola_id, classe_id, nome);

-- -------------------------------------------------------------
-- 10. TABELA NOTAS
-- -------------------------------------------------------------
ALTER TABLE public.notas
  DROP COLUMN IF EXISTS disciplina,
  ADD COLUMN IF NOT EXISTS disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- 11. RECRIAÇÃO DA VIEW: vw_ocupacao_turmas (com classe_id)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.vw_ocupacao_turmas;

CREATE OR REPLACE VIEW public.vw_ocupacao_turmas
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.escola_id,
  t.nome,
  c.nome AS classe, -- NEW: Use classe nome from classes table
  t.turno AS turno,
  t.sala,
  COALESCE(t.capacidade_maxima, 30) AS capacidade_maxima,

  -- total de matrículas ativas (por turma)
  COUNT(m.id) FILTER (WHERE m.status IN ('ativo','ativa'))::INT
    AS total_matriculas_ativas,

  -- percentual de ocupação
  CASE
    WHEN COALESCE(t.capacidade_maxima, 30) > 0 THEN
      ROUND(
        (
          COUNT(m.id) FILTER (WHERE m.status IN ('ativo','ativa'))
        )::NUMERIC
        / COALESCE(t.capacidade_maxima, 30)::NUMERIC
        * 100,
        1
      )
    ELSE 0
  END AS ocupacao_percentual,

  -- status de ocupação
  CASE
    WHEN COALESCE(t.capacidade_maxima, 30) = 0 THEN 'sem_capacidade'
    WHEN COUNT(m.id) FILTER (WHERE m.status IN ('ativo','ativa'))
         >= COALESCE(t.capacidade_maxima, 30)
      THEN 'lotada'
    WHEN COUNT(m.id) FILTER (WHERE m.status IN ('ativo','ativa'))
         >= COALESCE(t.capacidade_maxima, 30) * 0.8
      THEN 'quase_lotada'
    WHEN COUNT(m.id) FILTER (WHERE m.status IN ('ativo','ativa')) = 0
      THEN 'sem_matriculas'
    ELSE 'com_vagas'
  END AS status_ocupacao

FROM public.turmas t
LEFT JOIN public.matriculas m
  ON m.turma_id = t.id
 -- opcional: reforça filtro, mesmo que a view já conte só ativas
 AND m.status IN ('ativo','ativa')
LEFT JOIN public.classes c -- NEW: Join with classes table
  ON c.id = t.classe_id
GROUP BY
  t.id,
  t.escola_id,
  t.nome,
  c.nome, -- NEW: Group by c.nome
  t.turno,
  t.sala,
  COALESCE(t.capacidade_maxima, 30);

COMMIT;
