-- Corrige o 42501 no radar de admissões.
--
-- Contexto:
--   A view public.view_admissao_oportunidades_lista_espera foi marcada com
--   security_invoker = true em 20260718123000_security_invoker_and_public_rls_hardening.sql,
--   e o seu corpo chama public.admissao_turma_ocupacao_reservada(...).
--   Como a view passa a executar com os privilégios de QUEM CHAMA, e a função foi
--   trancada a service_role em 20270602125500_admissoes_turma_ocupacao_inclui_reservas.sql,
--   o pessoal de secretaria (role authenticated) passou a apanhar
--   42501 permission denied for function admissao_turma_ocupacao_reservada.
--   O radar de admissões devolve 500 desde 2026-07-18.
--
-- Porque não se resolve de outra forma:
--   - Remover o security_invoker da view NÃO é opção: a view não tem filtro de escola
--     nenhum (faz SELECT ... FROM turmas WHERE status_validacao = 'ativo'), e o
--     isolamento por escola depende inteiramente de o RLS de turmas/candidaturas
--     actuar como caller. Sem security_invoker a view correria como postgres e
--     exporia a lista de espera de TODAS as escolas, incluindo nome_candidato (PII).
--   - Conceder EXECUTE a authenticated sem mais nada abriria um caminho directo de
--     .rpc() pelo browser onde qualquer autenticado lê a ocupação de outra escola,
--     porque a função é SECURITY DEFINER e recebe p_escola_id como parâmetro.
--
-- O que esta migration faz:
--   Embrulha a contagem (inalterada) numa verificação de pertença à escola.
--   A view não é tocada: security_invoker e RLS ficam como estão.
--
-- Porque é que can_manage_school é a condição certa:
--   can_manage_school(p_escola_id) pede os papéis admin, admin_escola, staff_admin,
--   secretaria, secretario, financeiro. Através da expansão de user_has_role_in_school,
--   isso cobre os papéis armazenados {admin, staff_admin, admin_escola, admin_financeiro,
--   secretaria, secretaria_financeiro, secretario, financeiro} — que é superconjunto
--   tanto de K12_SECRETARIA_OPERACIONAL_ROLE_GROUP (guarda do radar) como de
--   K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP (guarda do convert). Nenhum utilizador que
--   hoje passa um desses portões passa a ver o radar vazio.
--
-- Caminho interno preservado:
--   admissao_finalizar_matricula é SECURITY DEFINER e chama esta função para o
--   hard-gate de capacidade; o seu único chamador (api/secretaria/admissoes/convert)
--   usa a guarda K12_FINANCEIRO_OPERACIONAL, contida em can_manage_school. O gate
--   continua a funcionar.
--
-- Porque é que a condição inclui is_internal_service_role():
--   is_super_admin() e check_super_admin_role() identificam super_admin/global_admin
--   através de auth.uid() e de profiles. Num pedido com a service role NÃO há auth.uid(),
--   portanto ambos devolvem false e can_manage_school devolve false. Como os três
--   endpoints públicos de admissão (page.tsx, .../configuracao, .../candidatar) chamam
--   esta função por .rpc() com o cliente de service role, sem esta cláusula a ocupação
--   passaria a NULL e o hard-gate de capacidade desligava-se em silêncio -- pior do que
--   o 42501 que esta migration corrige. is_internal_service_role() cobre os dois casos:
--   auth.role() = 'service_role' e current_setting('role') = 'service_role'.
--
--   A cláusula não alarga nada para utilizadores normais: auth.role() vem do JWT assinado
--   e current_setting('role') é definido pelo PostgREST, não pelo cliente.
--
-- Modo de falha para quem não é da escola: NULL, que faz a linha sair de vagas_abertas
-- (capacidade_maxima - NULL é NULL). Falha fechada, sem erro 500.

BEGIN;

CREATE OR REPLACE FUNCTION public.admissao_turma_ocupacao_reservada(
  p_escola_id uuid,
  p_turma_id uuid,
  p_excluir_candidatura_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.is_internal_service_role()
      OR public.can_manage_school(p_escola_id) THEN (
      WITH matriculas_ativas AS (
        SELECT count(*)::integer AS total
        FROM public.matriculas m
        WHERE m.escola_id = p_escola_id
          AND m.turma_id = p_turma_id
          AND lower(coalesce(m.status, '')) IN ('ativa', 'ativo', 'active')
      ),
      reservas_validas AS (
        SELECT count(*)::integer AS total
        FROM public.candidaturas c
        WHERE c.escola_id = p_escola_id
          AND c.turma_preferencial_id = p_turma_id
          AND lower(coalesce(c.status, '')) = 'aguardando_pagamento'
          AND coalesce(c.expires_at, now() - interval '1 second') > now()
          AND (
            p_excluir_candidatura_id IS NULL
            OR c.id IS DISTINCT FROM p_excluir_candidatura_id
          )
      )
      SELECT coalesce(matriculas_ativas.total, 0) + coalesce(reservas_validas.total, 0)
      FROM matriculas_ativas, reservas_validas
    )
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.admissao_turma_ocupacao_reservada(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admissao_turma_ocupacao_reservada(uuid, uuid, uuid)
  TO authenticated, service_role;

COMMIT;
