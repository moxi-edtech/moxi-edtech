-- Disposable synthetic source-class correction for a pupil like Suriel.
-- No customer data, no application to any live Supabase project.
\ir fixture.sql

ALTER TABLE public.turmas ADD COLUMN status_validacao text DEFAULT 'ativo';
ALTER TABLE public.matriculas ADD COLUMN updated_by uuid;
ALTER TABLE public.audit_logs ADD COLUMN before jsonb;
ALTER TABLE public.audit_logs ADD COLUMN after jsonb;
CREATE TABLE public.notas_avaliacoes(matricula_id uuid);
CREATE TABLE public.lancamentos(matricula_id uuid,escola_id uuid);
CREATE TABLE public.frequencias(matricula_id uuid,escola_id uuid);
CREATE TABLE public.exame_resultados(matricula_id uuid,escola_id uuid);

INSERT INTO public.turmas(
 id,escola_id,session_id,ano_letivo,status_fecho,regime,
 capacidade_maxima,classe_id,curso_id,status_validacao
) VALUES (
 '40000000-0000-4000-8000-000000000003',
 '20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',2025,'ABERTO',
 '{"escala":"quantitativa_primario"}',35,
 'c0000000-0000-4000-8000-000000000003',
 'd0000000-0000-4000-8000-000000000001','ativo'
), (
 '40000000-0000-4000-8000-000000000004',
 '20000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',2025,'ABERTO',
 '{"escala":"quantitativa_primario"}',35,
 'c0000000-0000-4000-8000-000000000004',
 'd0000000-0000-4000-8000-000000000001','ativo'
);
INSERT INTO public.matriculas(
 id,escola_id,aluno_id,turma_id,session_id,ano_letivo,
 status,ativo,status_fecho_origem
) VALUES (
 '60000000-0000-4000-8000-000000000003',
 '20000000-0000-4000-8000-000000000001',
 '50000000-0000-4000-8000-000000000003',
 '40000000-0000-4000-8000-000000000003',
 '30000000-0000-4000-8000-000000000001',
 2025,'pendente',false,'manual'
);

\ir ../../../migrations/20271112030000_balcao_pauta_corrigir_turma_origem.sql

CREATE TRIGGER test_legacy_evidence_before_turma
BEFORE UPDATE OF turma_id ON public.matriculas FOR EACH ROW
EXECUTE FUNCTION public.guard_turma_transfer_academic_evidence_v1();
CREATE TRIGGER test_secondary_evidence_before_turma
BEFORE UPDATE OF turma_id ON public.matriculas FOR EACH ROW
EXECUTE FUNCTION public.guard_turma_transfer_secondary_evidence_v1();
