BEGIN;

CREATE OR REPLACE FUNCTION internal.get_radar_inadimplencia_for_current_user()
RETURNS TABLE (
  escola_id uuid,
  mensalidade_id uuid,
  aluno_id uuid,
  nome_aluno text,
  responsavel text,
  telefone text,
  nome_turma text,
  valor_previsto numeric(10,2),
  valor_pago_total numeric,
  valor_em_atraso numeric,
  data_vencimento date,
  dias_em_atraso integer,
  status_risco text,
  status_mensalidade text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    m.escola_id,
    m.mensalidade_id,
    m.aluno_id,
    m.nome_aluno,
    m.responsavel,
    m.telefone,
    m.nome_turma,
    m.valor_previsto,
    m.valor_pago_total,
    m.valor_em_atraso,
    m.data_vencimento,
    m.dias_em_atraso,
    m.status_risco,
    m.status_mensalidade
  FROM internal.mv_radar_inadimplencia AS m
  WHERE auth.role() = 'service_role'
     OR EXISTS (
       SELECT 1
       FROM public.escola_users AS eu
       WHERE eu.escola_id = m.escola_id
         AND eu.user_id = auth.uid()
         AND eu.tenant_type = 'k12'
         AND lower(trim(coalesce(eu.papel, ''))) = ANY (
           ARRAY[
             'admin',
             'admin_escola',
             'staff_admin',
             'secretaria',
             'financeiro',
             'admin_financeiro',
             'secretaria_financeiro'
           ]::text[]
         )
     );
$$;

REVOKE ALL
  ON FUNCTION internal.get_radar_inadimplencia_for_current_user()
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
  ON FUNCTION internal.get_radar_inadimplencia_for_current_user()
  TO authenticated, service_role;

COMMIT;
