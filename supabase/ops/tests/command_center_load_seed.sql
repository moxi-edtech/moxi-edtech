\set ON_ERROR_STOP on
-- Disposable database only. Uses actual Command Center SQL migrations and
-- synthetic academic/payment records; GoTrue and full replay are separate gates.
\ir regression_command_center_combined_filters.sql
RESET ROLE;
TRUNCATE public.public_rate_limits;
-- 3 schools, 6.7k additional synthetic students, 24 groups; never copy live data.
INSERT INTO public.escola_users(escola_id,user_id,papel,role) VALUES
 ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-0000000000d3','secretaria','secretaria'),
 ('00000000-0000-4000-8000-0000000000b2','00000000-0000-4000-8000-0000000000d4','secretaria','secretaria'),
 ('00000000-0000-4000-8000-0000000000c3','00000000-0000-4000-8000-0000000000d5','secretaria','secretaria');
INSERT INTO public.classes(id,escola_id,curso_id) VALUES
 ('00000000-0000-4000-8000-0000000000c4','00000000-0000-4000-8000-0000000000c3',NULL);
INSERT INTO public.turmas(id,escola_id,classe_id,curso_id,ano_letivo_id,ano_letivo,nome,capacidade_maxima)
SELECT ('00000000-0000-4000-8f00-'||lpad(n::text,12,'0'))::uuid,
 CASE WHEN n<=16 THEN '00000000-0000-4000-8000-0000000000a1'::uuid
      WHEN n<=20 THEN '00000000-0000-4000-8000-0000000000b2'::uuid
      ELSE '00000000-0000-4000-8000-0000000000c3'::uuid END,
 CASE WHEN n<=16 THEN '00000000-0000-4000-8000-0000000000c1'::uuid
      WHEN n<=20 THEN '00000000-0000-4000-8000-0000000000c2'::uuid
      ELSE '00000000-0000-4000-8000-0000000000c4'::uuid END,
 NULL,'00000000-0000-4000-8000-000000000026'::uuid,2026,'Turma Fictícia '||n,400
FROM generate_series(1,24) AS n;
WITH seed AS (
  SELECT n,CASE WHEN n<=5000 THEN '00000000-0000-4000-8000-0000000000a1'::uuid
    WHEN n<=6200 THEN '00000000-0000-4000-8000-0000000000b2'::uuid
    ELSE '00000000-0000-4000-8000-0000000000c3'::uuid END AS escola,
   CASE WHEN n<=5000 THEN ((n-1)%16)+1
     WHEN n<=6200 THEN ((n-5001)%4)+17
     ELSE ((n-6201)%4)+21 END AS turma_no
  FROM generate_series(1,6700) n
)
INSERT INTO public.alunos(id,escola_id,nome,nome_completo,numero_processo,deleted_at)
SELECT ('00000000-0000-4000-9a00-'||lpad(n::text,12,'0'))::uuid,
 escola,'Estudante Fictício '||lpad(n::text,5,'0'),
 'Estudante Fictício '||lpad(n::text,5,'0'),'SYN/'||lpad(n::text,6,'0'),NULL
FROM seed;
WITH seed AS (
 SELECT n,CASE WHEN n<=5000 THEN '00000000-0000-4000-8000-0000000000a1'::uuid
     WHEN n<=6200 THEN '00000000-0000-4000-8000-0000000000b2'::uuid
     ELSE '00000000-0000-4000-8000-0000000000c3'::uuid END AS escola,
 CASE WHEN n<=5000 THEN ((n-1)%16)+1
      WHEN n<=6200 THEN ((n-5001)%4)+17
      ELSE ((n-6201)%4)+21 END AS turma_no
 FROM generate_series(1,6700) n
)
INSERT INTO public.matriculas(id,escola_id,session_id,ano_letivo,turma_id,aluno_id,numero_chamada,status,ativo,data_inicio_financeiro,data_matricula,created_at)
SELECT ('00000000-0000-4000-9b00-'||lpad(n::text,12,'0'))::uuid,
 escola,'00000000-0000-4000-8000-000000000026'::uuid,2026,
 ('00000000-0000-4000-8f00-'||lpad(turma_no::text,12,'0'))::uuid,
 ('00000000-0000-4000-9a00-'||lpad(n::text,12,'0'))::uuid,
 n%400+1,'ativo',true,'2026-01-01','2026-01-01','2026-01-01'::timestamptz
FROM seed;
INSERT INTO public.mensalidades(id,escola_id,aluno_id,matricula_id,ano_letivo,data_vencimento,status,valor,valor_previsto,valor_pago_total)
SELECT ('00000000-0000-4000-9c00-'||lpad(n::text,12,'0'))::uuid,
 CASE WHEN n<=5000 THEN '00000000-0000-4000-8000-0000000000a1'::uuid
      WHEN n<=6200 THEN '00000000-0000-4000-8000-0000000000b2'::uuid
      ELSE '00000000-0000-4000-8000-0000000000c3'::uuid END,
 ('00000000-0000-4000-9a00-'||lpad(n::text,12,'0'))::uuid,
 ('00000000-0000-4000-9b00-'||lpad(n::text,12,'0'))::uuid,
 '2026','2026-02-10',CASE WHEN n%9=0 THEN 'parcial' ELSE 'pendente' END,
 1000,1000,CASE WHEN n%9=0 THEN 500 ELSE 0 END
FROM generate_series(1,6700) n WHERE n%3=0;
INSERT INTO public.candidaturas(id,escola_id,aluno_id,matricula_id,ano_letivo)
SELECT ('00000000-0000-4000-9d00-'||lpad(n::text,12,'0'))::uuid,
 CASE WHEN n<=5000 THEN '00000000-0000-4000-8000-0000000000a1'::uuid
      WHEN n<=6200 THEN '00000000-0000-4000-8000-0000000000b2'::uuid
      ELSE '00000000-0000-4000-8000-0000000000c3'::uuid END,
 ('00000000-0000-4000-9a00-'||lpad(n::text,12,'0'))::uuid,
 ('00000000-0000-4000-9b00-'||lpad(n::text,12,'0'))::uuid,2026
FROM generate_series(1,6700) n WHERE n%5=0;
INSERT INTO public.candidaturas_status_log(id,candidatura_id,escola_id,created_at,metadata)
SELECT ('00000000-0000-4000-9e00-'||lpad(n::text,12,'0'))::uuid,
 ('00000000-0000-4000-9d00-'||lpad(n::text,12,'0'))::uuid,
 CASE WHEN n<=5000 THEN '00000000-0000-4000-8000-0000000000a1'::uuid
      WHEN n<=6200 THEN '00000000-0000-4000-8000-0000000000b2'::uuid
      ELSE '00000000-0000-4000-8000-0000000000c3'::uuid END,
 '2026-04-01','{"tipo":"DOCUMENTOS_PENDENTES"}'::jsonb
FROM generate_series(1,6700) n WHERE n%5=0;
-- These queries are optimised using the same planner table statistics as PostgreSQL.
ANALYZE public.matriculas;
ANALYZE public.alunos;
ANALYZE public.turmas;
ANALYZE public.mensalidades;
ANALYZE public.candidaturas;
ANALYZE public.candidaturas_status_log;
SELECT jsonb_build_object('schools',3,'new_students',count(*),'new_monthly_records',(SELECT count(*) FROM public.mensalidades)) AS synthetic_fixture
FROM public.alunos WHERE id::text LIKE '00000000-0000-4000-9a00-%';
