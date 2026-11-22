-- Add the real minimal academic names/tenants that the 2025 document-review selectors need.
CREATE SCHEMA IF NOT EXISTS internal;
ALTER TABLE public.classes ADD COLUMN nome text;
ALTER TABLE public.turmas ADD COLUMN nome text;
ALTER TABLE public.historico_disciplinas ADD COLUMN disciplina_nome text;
UPDATE public.classes SET nome='3ª Classe';
UPDATE public.turmas SET nome='3ª Classe A';
UPDATE public.historico_disciplinas SET disciplina_nome='Matemática';
CREATE TABLE public.alunos(id uuid PRIMARY KEY,escola_id uuid,nome text,nome_completo text,numero_processo text);
INSERT INTO public.alunos VALUES
('70000000-0000-4000-8000-000000000001','3744879f-2e19-4671-8995-78604302d8c5','Aluno teste 1','Aluno teste 1','T001'),
('70000000-0000-4000-8000-000000000002','3744879f-2e19-4671-8995-78604302d8c5','Aluno teste 2','Aluno teste 2','T002'),
('70000000-0000-4000-8000-000000000003','3744879f-2e19-4671-8995-78604302d8c5','Aluno teste 3','Aluno teste 3','T003');

-- Fixture only: permit assertions to inspect grade and outbox rows as authenticated role.
GRANT SELECT ON public.notas,public.outbox_events TO authenticated;

-- Synthetic secretarial operator has the same school membership but no global privileges.
INSERT INTO public.escola_users VALUES ('3744879f-2e19-4671-8995-78604302d8c5','10000000-0000-4000-8000-000000000003','secretaria');
