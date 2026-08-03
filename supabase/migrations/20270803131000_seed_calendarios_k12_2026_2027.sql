-- Official MED 2026/2027 calendars for the remaining K12 subsystems.
-- Source: CALENDÁRIO ESCOLAR NACIONAL-2026-2027-FINAL-ACTUALIZADO.pdf.

BEGIN;

WITH templates(id, nome, descricao, subsistema, fonte_referencia) AS (
  VALUES
    ('b5d7b33a-8a77-4d74-9c65-202620270002'::uuid,
     'Calendário Escolar Nacional 2026/2027 - Pré-escolar (MED)',
     'Subsistema de educação pré-escolar.',
     'PRE_ESCOLAR',
     'Calendário Nacional do Subsistema de Educação Pré-escolar, Ano Lectivo 2026/2027'),
    ('b5d7b33a-8a77-4d74-9c65-202620270003'::uuid,
     'Calendário Escolar Nacional 2026/2027 - Técnico-profissional (MED)',
     'Subsistema do ensino secundário técnico-profissional.',
     'TECNICO_PROFISSIONAL',
     'Calendário Escolar Nacional do Subsistema do Ensino Secundário Técnico-profissional, Ano Lectivo 2026/2027'),
    ('b5d7b33a-8a77-4d74-9c65-202620270004'::uuid,
     'Calendário Escolar Nacional 2026/2027 - Secundário pedagógico (MED)',
     'Ensino secundário pedagógico, modelos integrado e sequencial.',
     'SECUNDARIO_PEDAGOGICO',
     'Calendário Escolar Nacional do Ensino Secundário Pedagógico, Ano Lectivo 2026/2027')
)
INSERT INTO public.calendario_templates (
  id, nome, ano_base, data_inicio, data_fim, descricao, is_oficial,
  subsistema, estado, fonte_nome, fonte_referencia, versao_documento
)
SELECT
  id, nome, 2026, DATE '2026-09-01', DATE '2027-08-31', descricao, true,
  subsistema, 'PUBLICADO', 'Ministério da Educação da República de Angola',
  fonte_referencia, 'FINAL-ACTUALIZADO'
FROM templates
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  ano_base = EXCLUDED.ano_base,
  data_inicio = EXCLUDED.data_inicio,
  data_fim = EXCLUDED.data_fim,
  descricao = EXCLUDED.descricao,
  is_oficial = EXCLUDED.is_oficial,
  subsistema = EXCLUDED.subsistema,
  estado = EXCLUDED.estado,
  fonte_nome = EXCLUDED.fonte_nome,
  fonte_referencia = EXCLUDED.fonte_referencia,
  versao_documento = EXCLUDED.versao_documento;

WITH template_ids(id) AS (
  VALUES
    ('b5d7b33a-8a77-4d74-9c65-202620270002'::uuid),
    ('b5d7b33a-8a77-4d74-9c65-202620270003'::uuid),
    ('b5d7b33a-8a77-4d74-9c65-202620270004'::uuid)
), common_items(tipo, nome, data_inicio, data_fim, numero, peso) AS (
  VALUES
    ('EVENTO_ESCOLA'::public.tipo_evento_calendario, 'Início do Ano Lectivo 2026/2027', DATE '2026-09-01', DATE '2026-09-01', NULL::smallint, NULL::smallint),
    ('PERIODO_LETIVO', 'I Trimestre', DATE '2026-09-01', DATE '2026-12-18', 1, 30),
    ('PERIODO_LETIVO', 'II Trimestre', DATE '2027-01-04', DATE '2027-04-09', 2, 30),
    ('PERIODO_LETIVO', 'III Trimestre', DATE '2027-04-26', DATE '2027-06-18', 3, 40),
    ('PAUSA_PEDAGOGICA', 'Pausa Pedagógica do I Trimestre', DATE '2026-12-21', DATE '2026-12-31', NULL, NULL),
    ('PAUSA_PEDAGOGICA', 'Pausa Pedagógica do II Trimestre', DATE '2027-04-12', DATE '2027-04-23', NULL, NULL),
    ('FERIADO', 'Dia do Herói Nacional e ponte', DATE '2026-09-17', DATE '2026-09-18', NULL, NULL),
    ('FERIADO', 'Dia dos Finados', DATE '2026-11-02', DATE '2026-11-02', NULL, NULL),
    ('FERIADO', 'Dia da Independência Nacional', DATE '2026-11-11', DATE '2026-11-11', NULL, NULL),
    ('FERIADO', 'Natal', DATE '2026-12-25', DATE '2026-12-25', NULL, NULL),
    ('FERIADO', 'Início da Luta Armada e ponte', DATE '2027-02-04', DATE '2027-02-05', NULL, NULL),
    ('FERIADO', 'Carnaval', DATE '2027-02-08', DATE '2027-02-09', NULL, NULL),
    ('FERIADO', 'Dia Internacional da Mulher', DATE '2027-03-08', DATE '2027-03-08', NULL, NULL),
    ('FERIADO', 'Dia da Libertação da África Austral e ponte', DATE '2027-03-22', DATE '2027-03-23', NULL, NULL),
    ('FERIADO', 'Sexta-feira Santa', DATE '2027-03-26', DATE '2027-03-26', NULL, NULL),
    ('FERIAS_ALUNOS', 'Férias dos Alunos', DATE '2027-06-18', DATE '2027-08-31', NULL, NULL),
    ('MATRICULA', 'Matrículas dos Novos Alunos', DATE '2027-08-16', DATE '2027-08-20', NULL, NULL),
    ('PREPARACAO_ANO_LETIVO', 'Abertura do Ano Lectivo 2027/2028', DATE '2027-08-31', DATE '2027-08-31', NULL, NULL)
)
INSERT INTO public.calendario_template_items (
  id, template_id, tipo, nome, data_inicio, data_fim, numero, peso
)
SELECT
  md5(t.id::text || ':' || i.tipo::text || ':' || i.nome)::uuid,
  t.id, i.tipo, i.nome, i.data_inicio, i.data_fim, i.numero, i.peso
FROM template_ids t
CROSS JOIN common_items i
ON CONFLICT (id) DO UPDATE SET
  tipo = EXCLUDED.tipo,
  nome = EXCLUDED.nome,
  data_inicio = EXCLUDED.data_inicio,
  data_fim = EXCLUDED.data_fim,
  numero = EXCLUDED.numero,
  peso = EXCLUDED.peso;

WITH items(template_id, tipo, nome, data_inicio, data_fim) AS (
  VALUES
    ('b5d7b33a-8a77-4d74-9c65-202620270002'::uuid, 'EVENTO_ESCOLA'::public.tipo_evento_calendario, 'Inscrição de Crianças durante todo o Ano Civil', DATE '2026-09-01', DATE '2027-08-31'),
    ('b5d7b33a-8a77-4d74-9c65-202620270002'::uuid, 'ENCERRAMENTO_ANO_LETIVO', 'Encerramento do Ano Lectivo 2026/2027', DATE '2027-07-30', DATE '2027-07-30'),
    ('b5d7b33a-8a77-4d74-9c65-202620270003'::uuid, 'EVENTO_ESCOLA', 'Estágio Profissional Supervisionado', DATE '2026-09-01', DATE '2027-05-31'),
    ('b5d7b33a-8a77-4d74-9c65-202620270003'::uuid, 'EXAME_ESCRITO', 'Exames Escritos da 12.ª Classe', DATE '2027-06-23', DATE '2027-07-02'),
    ('b5d7b33a-8a77-4d74-9c65-202620270003'::uuid, 'EXAME_EXTRAORDINARIO', 'Exame Especial', DATE '2027-08-23', DATE '2027-08-25'),
    ('b5d7b33a-8a77-4d74-9c65-202620270003'::uuid, 'PUBLICACAO_PAUTA', 'Classificação, Conselho e Pautas do Exame Especial', DATE '2027-08-26', DATE '2027-08-27'),
    ('b5d7b33a-8a77-4d74-9c65-202620270004'::uuid, 'EVENTO_ESCOLA', 'Estágio Profissional Supervisionado', DATE '2026-09-01', DATE '2027-07-31'),
    ('b5d7b33a-8a77-4d74-9c65-202620270004'::uuid, 'EXAME_ORAL', 'Exames Orais', DATE '2027-06-21', DATE '2027-06-22'),
    ('b5d7b33a-8a77-4d74-9c65-202620270004'::uuid, 'EXAME_ESCRITO', 'Exames Escritos da 12.ª Classe', DATE '2027-06-23', DATE '2027-07-02'),
    ('b5d7b33a-8a77-4d74-9c65-202620270004'::uuid, 'EXAME_EXTRAORDINARIO', 'Exame Especial', DATE '2027-08-23', DATE '2027-08-25'),
    ('b5d7b33a-8a77-4d74-9c65-202620270004'::uuid, 'RECONFIRMACAO_MATRICULA', 'Reconfirmação Automática de Matrículas', DATE '2027-07-05', DATE '2027-07-23')
)
INSERT INTO public.calendario_template_items (
  id, template_id, tipo, nome, data_inicio, data_fim, numero, peso
)
SELECT
  md5(template_id::text || ':' || tipo::text || ':' || nome)::uuid,
  template_id, tipo, nome, data_inicio, data_fim, NULL, NULL
FROM items
ON CONFLICT (id) DO UPDATE SET
  tipo = EXCLUDED.tipo,
  nome = EXCLUDED.nome,
  data_inicio = EXCLUDED.data_inicio,
  data_fim = EXCLUDED.data_fim;

COMMIT;
