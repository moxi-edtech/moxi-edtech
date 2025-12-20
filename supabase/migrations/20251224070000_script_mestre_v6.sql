BEGIN;

-- ============================================================================
-- 0. HARD RESET (OPCIONAL - USE APENAS EM DEV)
-- ============================================================================
-- TRUNCATE TABLE public.financeiro_lancamentos CASCADE;
-- TRUNCATE TABLE public.matriculas CASCADE;
-- TRUNCATE TABLE public.turmas CASCADE;
-- TRUNCATE TABLE public.alunos CASCADE;
-- TRUNCATE TABLE public.staging_alunos CASCADE;
-- TRUNCATE TABLE public.import_errors CASCADE;


-- ============================================================================
-- 1. TABELAS DE SUPORTE E LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL,
  row_number int,
  message text NOT NULL,
  raw_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Gerador de Nº Processo
CREATE TABLE IF NOT EXISTS public.aluno_processo_counters (
  escola_id uuid PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================================
-- 2. TABELA ALUNOS (Dados Civis)
-- ============================================================================
ALTER TABLE public.alunos
  ALTER COLUMN profile_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS numero_processo text,
  ADD COLUMN IF NOT EXISTS bi_numero text,
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS encarregado_nome text,
  ADD COLUMN IF NOT EXISTS encarregado_telefone text,
  ADD COLUMN IF NOT EXISTS encarregado_email text;

-- Função e Trigger de Nº Processo
CREATE OR REPLACE FUNCTION public.next_numero_processo(p_escola_id uuid, p_year int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_next bigint;
BEGIN
  INSERT INTO public.aluno_processo_counters (escola_id, last_value) VALUES (p_escola_id, 0)
    ON CONFLICT (escola_id) DO NOTHING;
  UPDATE public.aluno_processo_counters SET last_value = last_value + 1 WHERE escola_id = p_escola_id
    RETURNING last_value INTO v_next;
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
CREATE TRIGGER trg_alunos_set_processo BEFORE INSERT ON public.alunos
FOR EACH ROW EXECUTE PROCEDURE public.before_insert_alunos_set_processo();

-- Unicidade número_processo
DROP INDEX IF EXISTS idx_alunos_escola_processo;
CREATE UNIQUE INDEX idx_alunos_escola_processo ON public.alunos (escola_id, numero_processo);


-- ============================================================================
-- 3. TABELA TURMAS (Lazy Creation Support)
-- ============================================================================
ALTER TABLE public.turmas
  DROP COLUMN IF EXISTS classe,
  DROP COLUMN IF EXISTS capacidade,
  ADD COLUMN IF NOT EXISTS turma_codigo text,
  ADD COLUMN IF NOT EXISTS status_validacao text DEFAULT 'ativo';

DO $$ BEGIN
  ALTER TABLE public.turmas ALTER COLUMN ano_letivo TYPE integer USING (ano_letivo::integer);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DROP INDEX IF EXISTS uq_turmas_escola_ano_codigo;
CREATE UNIQUE INDEX uq_turmas_escola_ano_codigo ON public.turmas (escola_id, ano_letivo, turma_codigo);

-- Índice funcional para smart match
CREATE INDEX IF NOT EXISTS idx_turmas_smart_match
  ON public.turmas (escola_id, ano_letivo, (upper(regexp_replace(turma_codigo, '[^a-zA-Z0-9]', '', 'g'))));


-- ============================================================================
-- 4. TABELA MATRICULAS (Vínculo & Financeiro)
-- ============================================================================
ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS numero_matricula text,
  ADD COLUMN IF NOT EXISTS numero_chamada integer,
  ADD COLUMN IF NOT EXISTS ano_letivo integer;

ALTER TABLE public.matriculas DROP CONSTRAINT IF EXISTS matricula_unica_ano;
ALTER TABLE public.matriculas ADD CONSTRAINT matricula_unica_ano UNIQUE (escola_id, aluno_id, ano_letivo);


-- ============================================================================
-- 5. TABELA STAGING (Buffer de Importação)
-- ============================================================================
ALTER TABLE public.staging_alunos
  ADD COLUMN IF NOT EXISTS numero_processo text,
  ADD COLUMN IF NOT EXISTS bi_numero text,
  ADD COLUMN IF NOT EXISTS nif text,
  ADD COLUMN IF NOT EXISTS encarregado_nome text,
  ADD COLUMN IF NOT EXISTS encarregado_telefone text,
  ADD COLUMN IF NOT EXISTS encarregado_email text,
  ADD COLUMN IF NOT EXISTS turma_codigo text;


-- ============================================================================
-- 6. FUNÇÕES AUXILIARES
-- ============================================================================
CREATE OR REPLACE FUNCTION public.initcap_angola(text) RETURNS text AS $$
BEGIN
  RETURN initcap(lower(trim($1)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================================
-- 7. RPC: IMPORTAÇÃO INTELIGENTE (Detect, Resolve & Lazy Create)
-- ============================================================================
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
  v_turmas_created int := 0;

  v_clean_nome text;
  v_clean_telefone text;
  v_clean_turma_codigo text;
BEGIN
  FOR r IN SELECT * FROM public.staging_alunos WHERE import_id = p_import_id LOOP
    BEGIN
      -- Higienização
      v_clean_nome := public.initcap_angola(r.nome);
      v_clean_telefone := regexp_replace(r.encarregado_telefone, '[^0-9+]', '', 'g');
      v_clean_turma_codigo := upper(regexp_replace(r.turma_codigo, '[^a-zA-Z0-9]', '', 'g'));

      IF v_clean_telefone = '' OR v_clean_telefone IS NULL THEN RAISE EXCEPTION 'Telefone inválido'; END IF;

      -- Upsert Aluno
      INSERT INTO public.alunos (
        escola_id, numero_processo, nome, nome_completo, bi_numero, nif,
        encarregado_nome, encarregado_telefone, encarregado_email
      )
      VALUES (
        p_escola_id, r.numero_processo, v_clean_nome, v_clean_nome,
        upper(trim(r.bi_numero)), upper(trim(COALESCE(r.nif, r.bi_numero))),
        public.initcap_angola(r.encarregado_nome), v_clean_telefone, lower(trim(r.encarregado_email))
      )
      ON CONFLICT (escola_id, numero_processo) DO UPDATE SET
        nome = EXCLUDED.nome,
        nome_completo = EXCLUDED.nome_completo,
        bi_numero = EXCLUDED.bi_numero,
        encarregado_nome = COALESCE(EXCLUDED.encarregado_nome, public.alunos.encarregado_nome),
        encarregado_telefone = EXCLUDED.encarregado_telefone,
        updated_at = now()
      RETURNING id INTO v_aluno_id;

      -- Matrícula Automática (se tiver turma)
      IF r.turma_codigo IS NOT NULL AND r.turma_codigo <> '' THEN
        SELECT id INTO v_turma_id FROM public.turmas
        WHERE escola_id = p_escola_id AND ano_letivo = p_ano_letivo
          AND upper(regexp_replace(turma_codigo, '[^a-zA-Z0-9]', '', 'g')) = v_clean_turma_codigo
        LIMIT 1;

        IF v_turma_id IS NULL THEN
          INSERT INTO public.turmas (
            escola_id, ano_letivo, turma_codigo, nome, status_validacao, classe_id, curso_id
          ) VALUES (
            p_escola_id, p_ano_letivo, r.turma_codigo, r.turma_codigo || ' (Imp. Auto)', 'rascunho', NULL, NULL
          ) RETURNING id INTO v_turma_id;
          v_turmas_created := v_turmas_created + 1;
        END IF;

        INSERT INTO public.matriculas (
          escola_id, aluno_id, turma_id, ano_letivo, status, ativo,
          numero_matricula, data_matricula
        ) VALUES (
          p_escola_id, v_aluno_id, v_turma_id, p_ano_letivo, 'ativo', true,
          (SELECT numero_processo FROM public.alunos WHERE id = v_aluno_id) || '/' || p_ano_letivo, now()
        ) ON CONFLICT (escola_id, aluno_id, ano_letivo) DO NOTHING;
      END IF;

      v_total_imported := v_total_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.import_errors (import_id, row_number, message, raw_value)
      VALUES (p_import_id, r.row_number, SQLERRM, COALESCE(r.numero_processo, r.nome));
      v_total_errors := v_total_errors + 1;
    END;
  END LOOP;

  RETURN json_build_object('imported', v_total_imported, 'errors', v_total_errors, 'turmas_created', v_turmas_created);
END;
$$;


-- ============================================================================
-- 8. RPC: MATRÍCULA EM MASSA (Enturmação / Rematrícula)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.matricular_lista_alunos(
  p_escola_id uuid,
  p_turma_id uuid,
  p_ano_letivo int,
  p_aluno_ids uuid[]
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sucesso int := 0;
  v_erros int := 0;
  v_aluno_id uuid;
  v_processo text;
BEGIN
  PERFORM 1 FROM public.turmas WHERE id = p_turma_id AND escola_id = p_escola_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Turma não pertence a esta escola'; END IF;

  FOREACH v_aluno_id IN ARRAY p_aluno_ids LOOP
    BEGIN
      SELECT numero_processo INTO v_processo FROM public.alunos WHERE id = v_aluno_id;

      INSERT INTO public.matriculas (
        escola_id, aluno_id, turma_id, ano_letivo, status, ativo,
        numero_matricula, data_matricula
      )
      VALUES (
        p_escola_id, v_aluno_id, p_turma_id, p_ano_letivo, 'ativo', true,
        v_processo || '/' || p_ano_letivo, now()
      )
      ON CONFLICT (escola_id, aluno_id, ano_letivo)
      DO UPDATE SET
        turma_id = EXCLUDED.turma_id,
        status = 'ativo',
        ativo = true,
        data_matricula = COALESCE(public.matriculas.data_matricula, EXCLUDED.data_matricula);

      v_sucesso := v_sucesso + 1;
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
    END;
  END LOOP;

  RETURN json_build_object('sucesso', v_sucesso, 'erros', v_erros);
END;
$$;


-- ============================================================================
-- 9. AUTH TRIGGER (Segurança do Profile)
-- ============================================================================
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
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

COMMIT;
