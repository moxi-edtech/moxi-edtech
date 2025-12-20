-- ============================================================================== 
-- MASTER SCRIPT v5.0: ARQUITETURA ESCOLAR "MOXINEXA" (ANGOLA)
-- Features: Detect & Resolve Automático, Data Hygiene, Smart Matching
-- ==============================================================================

BEGIN;

-- -------------------------------------------------------------
-- 0. PREPARAÇÃO & LIMPEZA (Hard Reset Opcional - Descomente se for DEV)
-- -------------------------------------------------------------
-- TRUNCATE TABLE public.financeiro_lancamentos CASCADE;
-- TRUNCATE TABLE public.matriculas CASCADE;
-- TRUNCATE TABLE public.alunos CASCADE;
-- TRUNCATE TABLE public.staging_alunos CASCADE;
-- TRUNCATE TABLE public.import_errors CASCADE;
-- TRUNCATE TABLE public.turmas CASCADE; -- Cuidado aqui


-- -------------------------------------------------------------
-- 1. TABELA DE LOGS (Erros de Importação)
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
-- 2. TABELA ALUNOS (Identidade & Contatos)
-- -------------------------------------------------------------
ALTER TABLE public.alunos
  ALTER COLUMN profile_id DROP NOT NULL, -- Desacoplado do Auth
  
  -- Identificadores Oficiais
  ADD COLUMN IF NOT EXISTS numero_processo text,
  ADD COLUMN IF NOT EXISTS bi_numero text,
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  
  -- Contatos do Encarregado (Alinhamento Secretaria)
  ADD COLUMN IF NOT EXISTS encarregado_nome text,      -- ESSENCIAL PARA A SECRETARIA
  ADD COLUMN IF NOT EXISTS encarregado_telefone text,  -- OBRIGATÓRIO (Chave de Login)
  ADD COLUMN IF NOT EXISTS encarregado_email text;

-- 2.1 Gerador Automático de Nº Processo (Se vier vazio no CSV)
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

-- 2.2 Unicidade
DROP INDEX IF EXISTS idx_alunos_escola_processo;
CREATE UNIQUE INDEX idx_alunos_escola_processo ON public.alunos (escola_id, numero_processo);


-- -------------------------------------------------------------
-- 3. TABELA TURMAS (Com Status de Validação)
-- -------------------------------------------------------------
ALTER TABLE public.turmas
  DROP COLUMN IF EXISTS classe,      
  DROP COLUMN IF EXISTS capacidade,  
  ADD COLUMN IF NOT EXISTS turma_codigo text,
  -- Novo Status para suportar criação automática: 'ativo' ou 'rascunho'
  ADD COLUMN IF NOT EXISTS status_validacao text DEFAULT 'ativo';

-- Converter ano para inteiro (Safety check)
DO $$ BEGIN
  ALTER TABLE public.turmas ALTER COLUMN ano_letivo TYPE integer USING (ano_letivo::integer);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Unicidade: Escola + Ano + Código
DROP INDEX IF EXISTS uq_turmas_escola_ano_codigo;
CREATE UNIQUE INDEX uq_turmas_escola_ano_codigo ON public.turmas (escola_id, ano_letivo, turma_codigo);


-- -------------------------------------------------------------
-- 4. TABELA MATRICULAS (Link Ano Letivo)
-- -------------------------------------------------------------
ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS numero_matricula text,
  ADD COLUMN IF NOT EXISTS numero_chamada integer,
  ADD COLUMN IF NOT EXISTS ano_letivo integer;

-- Regra: 1 aluno = 1 matrícula por ano
ALTER TABLE public.matriculas DROP CONSTRAINT IF EXISTS matricula_unica_ano;
ALTER TABLE public.matriculas ADD CONSTRAINT matricula_unica_ano UNIQUE (escola_id, aluno_id, ano_letivo);


-- -------------------------------------------------------------
-- 5. TABELA STAGING (Espelho do CSV)
-- -------------------------------------------------------------
ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS numero_processo text,
  ADD COLUMN IF NOT EXISTS bi_numero text,
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS encarregado_nome text, -- NOVO
  ADD COLUMN IF NOT EXISTS encarregado_telefone text,
  ADD COLUMN IF NOT EXISTS encarregado_email text,
  ADD COLUMN IF NOT EXISTS turma_codigo text;


-- -------------------------------------------------------------
-- 6. FUNÇÃO AUXILIAR (Higienização de Texto)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.initcap_angola(text) RETURNS text AS $$
BEGIN
  -- Converte "JOÃO DA SILVA" para "João da Silva"
  RETURN initcap(lower(trim($1)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- -------------------------------------------------------------
-- 7. RPC IMPORTAÇÃO (A Mágica do "Lazy Creation")
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
  v_turmas_created int := 0; -- Contador para o Frontend avisar o Diretor
  
  -- Variáveis limpas
  v_clean_nome text;
  v_clean_telefone text;
  v_clean_turma_codigo text;
BEGIN
  FOR r IN SELECT * FROM public.staging_alunos WHERE import_id = p_import_id LOOP
    BEGIN
      -- A) HIGIENIZAÇÃO (Limpeza Automática)
      v_clean_nome := public.initcap_angola(r.nome);
      v_clean_telefone := regexp_replace(r.encarregado_telefone, '[^0-9+]', '', 'g'); -- Só números
      v_clean_turma_codigo := upper(regexp_replace(r.turma_codigo, '[^a-zA-Z0-9]', '', 'g')); -- "10-A" vira "10A"

      -- Validação Mínima
      IF v_clean_telefone = '' OR v_clean_telefone IS NULL THEN 
         RAISE EXCEPTION 'Telefone inválido ou vazio'; 
      END IF;

      -- B) UPSERT ALUNO
      INSERT INTO public.alunos (
        escola_id, numero_processo, nome_completo, bi_numero, nif, 
        encarregado_nome, encarregado_telefone, encarregado_email
      )
      VALUES (
        p_escola_id,
        r.numero_processo, 
        v_clean_nome, 
        upper(trim(r.bi_numero)), 
        upper(trim(COALESCE(r.nif, r.bi_numero))),
        public.initcap_angola(r.encarregado_nome), -- Nome limpo
        v_clean_telefone, 
        lower(trim(r.encarregado_email))
      )
      ON CONFLICT (escola_id, numero_processo) DO UPDATE SET
        nome_completo = EXCLUDED.nome_completo,
        bi_numero = EXCLUDED.bi_numero,
        encarregado_nome = COALESCE(EXCLUDED.encarregado_nome, public.alunos.encarregado_nome),
        encarregado_telefone = EXCLUDED.encarregado_telefone,
        updated_at = now()
      RETURNING id INTO v_aluno_id;

      -- C) RESOLUÇÃO DE TURMA (Lazy Creation)
      IF r.turma_codigo IS NOT NULL AND r.turma_codigo <> '' THEN
        
        -- 1. Tenta achar turma existente (Smart Match ignorando hifens)
        SELECT id INTO v_turma_id FROM public.turmas 
        WHERE escola_id = p_escola_id 
          AND ano_letivo = p_ano_letivo
          AND upper(regexp_replace(turma_codigo, '[^a-zA-Z0-9]', '', 'g')) = v_clean_turma_codigo;

        -- 2. Se não achar, cria Turma RASCUNHO (Não bloqueia!)
        IF v_turma_id IS NULL THEN
          INSERT INTO public.turmas (
            escola_id, ano_letivo, turma_codigo, 
            nome, 
            status_validacao, -- Segredo: Rascunho
            classe_id, curso_id
          )
          VALUES (
            p_escola_id, p_ano_letivo, r.turma_codigo, 
            r.turma_codigo || ' (Imp. Auto)', 
            'rascunho', 
            NULL, NULL
          )
          RETURNING id INTO v_turma_id;
          
          v_turmas_created := v_turmas_created + 1;
        END IF;

        -- 3. Matricula o Aluno (Agora sempre funciona)
        INSERT INTO public.matriculas (
          escola_id, aluno_id, turma_id, ano_letivo, status, ativo, 
          numero_matricula, data_matricula
        )
        VALUES (
          p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, 'ativo', true,
          (SELECT numero_processo FROM public.alunos WHERE id = v_aluno_id) || '/' || p_ano_letivo, now()
        )
        ON CONFLICT (escola_id, aluno_id, ano_letivo) DO NOTHING;

      END IF;

      v_total_imported := v_total_imported + 1;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.import_errors (import_id, row_number, message, raw_value)
      VALUES (p_import_id, r.row_number, SQLERRM, COALESCE(r.numero_processo, r.nome));
      v_total_errors := v_total_errors + 1;
    END;
  END LOOP;

  -- Retorna stats para o Frontend
  RETURN json_build_object(
    'imported', v_total_imported, 
    'errors', v_total_errors, 
    'turmas_created', v_turmas_created -- Se > 0, mostre alerta no front!
  );
END;
$$;


-- -------------------------------------------------------------
-- 8. TRIGGER PROFILE (Auth Integration Segura)
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

COMMIT;
