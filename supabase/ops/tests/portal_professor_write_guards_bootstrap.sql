-- Synthetic database only. Complements the existing canonical grade-writer fixture.
ALTER TABLE public.matriculas ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.matriculas ADD COLUMN status_fecho_origem text;
CREATE TABLE public.historico_anos(escola_id uuid,matricula_id uuid,resultado_final text);
CREATE FUNCTION public.can_write_historical_grade(uuid,uuid,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
ALTER TABLE public.turmas ADD COLUMN curso_id uuid;
ALTER TABLE public.turmas ADD COLUMN classe_id uuid;
ALTER TABLE public.curso_matriz ADD COLUMN curso_id uuid;
ALTER TABLE public.curso_matriz ADD COLUMN classe_id uuid;
ALTER TABLE public.curso_matriz ADD COLUMN ativo boolean DEFAULT true;
CREATE TABLE public.aulas(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), escola_id uuid NOT NULL, turma_disciplina_id uuid NOT NULL,
 professor_id uuid NOT NULL, data date NOT NULL, slot_id uuid, inicio_previsto time, fim_previsto time,
 status text NOT NULL, inicio_real timestamptz, fim_real timestamptz, created_by uuid, finalizado_por uuid,
 resumo text, observacoes text, conteudo text
);
CREATE TABLE public.aula_eventos(escola_id uuid,aula_id uuid,tipo text,actor_id uuid,metadata jsonb);
