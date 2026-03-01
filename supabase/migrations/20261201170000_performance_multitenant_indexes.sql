BEGIN;

-- 1. Índice Crítico para a nova tabela de exceções (usada no trigger de notas)
CREATE INDEX IF NOT EXISTS idx_excecoes_pauta_escola_user 
  ON public.excecoes_pauta (escola_id, user_id, expira_em);

-- 2. Índice para acelerar a busca de utilizadores por escola (usado no painel do diretor)
CREATE INDEX IF NOT EXISTS idx_profiles_escola_role 
  ON public.profiles (escola_id, role);

-- 3. Garantir índice simples de escola nas tabelas que podem crescer muito (audit)
-- Já existe audit_logs_escola_id_idx, mas vamos garantir que é B-Tree limpo
CREATE INDEX IF NOT EXISTS idx_audit_logs_escola_lookup 
  ON public.audit_logs (escola_id, created_at DESC);

-- 4. Otimização de busca de turmas por curso (usado na Promoção em Massa)
CREATE INDEX IF NOT EXISTS idx_turmas_curso_escola 
  ON public.turmas (escola_id, curso_id, ano_letivo);

COMMIT;
