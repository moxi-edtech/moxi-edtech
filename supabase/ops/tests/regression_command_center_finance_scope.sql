\set ON_ERROR_STOP on
-- DISPOSABLE PostgreSQL 17 fixture; synthetic records only.
\ir regression_command_center_operational_roster_v1.sql
RESET ROLE;
-- Exercise the actual add-on migration (finance scope and retention).
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY, acao text NOT NULL, details jsonb NOT NULL
);
-- Versioned canonical enrollment order is identical to the billing guard:
-- data_inicio_financeiro/data_matricula/created_at, not arbitrary UUID order.
ALTER TABLE public.matriculas
  ADD COLUMN data_inicio_financeiro date,
  ADD COLUMN data_matricula date,
  ADD COLUMN created_at timestamptz DEFAULT now();
UPDATE public.matriculas SET data_inicio_financeiro='2026-01-01';

\ir ../../migrations/20271022134000_command_center_finance_audit_gates.sql
-- Reapplication must succeed without touching existing finance triggers/RLS.
\ir ../../migrations/20271022134000_command_center_finance_audit_gates.sql
TRUNCATE public.public_rate_limits;

-- Student 2: partial settlement has a true positive overdue balance.
-- Student 4: partial+document signals; student 5: settled obligation.
-- Student 7: stale legacy obligation without matricula_id must NOT inherit
-- a current active matrícula, even if ano_letivo matches.
INSERT INTO public.mensalidades
VALUES ('00000000-0000-4000-8500-000000000007','00000000-0000-4000-8000-0000000000a1',
'00000000-0000-4000-8100-000000000007',NULL,'2026','2026-01-10','pendente',100,100,0);
-- Student 8: two current-year matriculas, debt on OLD enrollment must not
-- be attributed to the newest current enrollment selected by the roster.
INSERT INTO public.matriculas VALUES
('00000000-0000-4000-8299-000000000008','00000000-0000-4000-8000-0000000000a1',
 '00000000-0000-4000-8000-000000000026',2026,
 '00000000-0000-4000-8000-0000000000f1',
 '00000000-0000-4000-8100-000000000008',8,'ativo',true);
UPDATE public.matriculas SET data_inicio_financeiro='2026-09-01'
WHERE id='00000000-0000-4000-8299-000000000008';
INSERT INTO public.mensalidades
VALUES ('00000000-0000-4000-8500-000000000008','00000000-0000-4000-8000-0000000000a1',
'00000000-0000-4000-8100-000000000008',
'00000000-0000-4000-8200-000000000008','2026','2026-01-10','pendente',100,100,0);
-- Student 9: obligation from previous academic year must not be mixed.
INSERT INTO public.mensalidades
VALUES ('00000000-0000-4000-8500-000000000009','00000000-0000-4000-8000-0000000000a1',
'00000000-0000-4000-8100-000000000009',
'00000000-0000-4000-8200-000000000009','2025','2026-01-10','pendente',100,100,0);
-- Student 10: approved secretary proof but not liquidated; canonical monthly
-- balance is unchanged and remains due. A rejected or resent proof likewise
-- must never update settled counters from this read model.
INSERT INTO public.mensalidades
VALUES ('00000000-0000-4000-8500-000000000010','00000000-0000-4000-8000-0000000000a1',
'00000000-0000-4000-8100-000000000010',
'00000000-0000-4000-8200-000000000010','2026','2026-01-10','pendente',100,100,0);
CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY, mensalidade_id uuid, status text NOT NULL,
  valor_pago numeric NOT NULL
);
INSERT INTO public.pagamentos VALUES
('00000000-0000-4000-8600-000000000001','00000000-0000-4000-8500-000000000010','aprovado_secretaria',100),
('00000000-0000-4000-8600-000000000002','00000000-0000-4000-8500-000000000010','rejeitado',100),
('00000000-0000-4000-8600-000000000003','00000000-0000-4000-8500-000000000010','reenviado',100);
GRANT SELECT ON public.pagamentos TO authenticated;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000d1';
DO $$
DECLARE
  actual uuid[];
  allowed uuid[] := ARRAY[
    '00000000-0000-4000-8100-000000000002'::uuid,
    '00000000-0000-4000-8100-000000000004'::uuid,
    '00000000-0000-4000-8100-000000000010'::uuid
  ];
  forbidden boolean := false;
BEGIN
  SELECT array_agg(aluno_id ORDER BY aluno_id) INTO actual
  FROM public.command_center_roster_operational_v1(
    p_escola_id=>'00000000-0000-4000-8000-0000000000a1',p_ano_letivo=>2026,
    p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
    p_filter=>'propinas_vencidas',p_limit=>20);
  IF actual IS DISTINCT FROM allowed THEN
    RAISE EXCEPTION 'Finance scope: expected only 2,4,10 (got %)',actual;
  END IF;
  BEGIN
    PERFORM public.cleanup_command_center_export_audits();
  EXCEPTION WHEN insufficient_privilege THEN forbidden := true;
  END;
  IF NOT forbidden THEN RAISE EXCEPTION 'Unprivileged audit purge exposed'; END IF;
END; $;

RESET ROLE;
INSERT INTO public.audit_logs VALUES
('00000000-0000-4000-8700-000000000001','command_center_roster_export',
 jsonb_build_object('retention_until',(now()-interval '1 day')::text)),
('00000000-0000-4000-8700-000000000002','command_center_roster_export',
 jsonb_build_object('retention_until',(now()+interval '1 day')::text)),
('00000000-0000-4000-8700-000000000003','unrelated_audit',
 jsonb_build_object('retention_until',(now()-interval '1 day')::text));
-- Values in live metadata are ISO timestamps. These synthetic values test
-- both expiry and retention without any student content.
UPDATE public.audit_logs SET details=jsonb_build_object('retention_until',
 to_char((now()-interval '1 day') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS')||'Z')
 WHERE id='00000000-0000-4000-8700-000000000001';
UPDATE public.audit_logs SET details=jsonb_build_object('retention_until',
 to_char((now()+interval '1 day') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS')||'Z')
 WHERE id='00000000-0000-4000-8700-000000000002';

DO $$
DECLARE d bigint;
BEGIN
  SELECT public.cleanup_command_center_export_audits() INTO d;
  IF d<>1 OR (SELECT count(*) FROM public.audit_logs)<>2 THEN
    RAISE EXCEPTION 'Audit expiry removed wrong records: %',d;
  END IF;
END; $;

-- Prove apply + reapply and reverse only on the disposable database.
\ir ../rollback_command_center_finance_audit_gates.sql
DO $$
BEGIN
  IF to_regprocedure('public.cleanup_command_center_export_audits()') IS NOT NULL THEN
    RAISE EXCEPTION 'Rollback must remove ONLY newly introduced cleanup function';
  END IF;
END; $;
\ir ../../migrations/20271022134000_command_center_finance_audit_gates.sql
EXPLAIN (ANALYZE,BUFFERS)
SELECT * FROM public.command_center_roster_operational_v1(
 p_escola_id=>'00000000-0000-4000-8000-0000000000a1',p_ano_letivo=>2026,
 p_turma_id=>'00000000-0000-4000-8000-0000000000f1',
 p_filter=>'propinas_vencidas',p_limit=>20);
