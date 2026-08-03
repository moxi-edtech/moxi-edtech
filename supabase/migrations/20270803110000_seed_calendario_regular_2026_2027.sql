-- Official MED calendar for primary and secondary education (regular/adults).
-- Source: CALENDÁRIO ESCOLAR NACIONAL-2026-2027-FINAL-ACTUALIZADO.pdf, pages 3-4.

DO $seed$
DECLARE
  v_template_id uuid := 'b5d7b33a-8a77-4d74-9c65-202620270001';
BEGIN
  INSERT INTO public.calendario_templates (
    id, nome, ano_base, data_inicio, data_fim, descricao, is_oficial,
    subsistema, estado, fonte_nome, fonte_referencia, versao_documento
  ) VALUES (
    v_template_id,
    'Calendário Escolar Nacional 2026/2027 - Regular e Adultos (MED)',
    2026,
    DATE '2026-09-01',
    DATE '2027-08-31',
    'Ensino primário e secundário regular e de adultos.',
    true,
    'REGULAR_ADULTOS',
    'PUBLICADO',
    'Ministério da Educação da República de Angola',
    'Calendário Escolar Nacional do Ensino Primário e Secundário (Regular e de Adultos), Ano Lectivo 2026/2027',
    'FINAL-ACTUALIZADO'
  )
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

  WITH items(tipo, nome, data_inicio, data_fim, numero, peso) AS (
    VALUES
      ('EVENTO_ESCOLA'::public.tipo_evento_calendario, 'Início do Ano Lectivo 2026/2027', DATE '2026-09-01', DATE '2026-09-01', NULL::smallint, NULL::smallint),
      ('PERIODO_LETIVO', 'I Trimestre', DATE '2026-09-01', DATE '2026-12-18', 1, 30),
      ('PERIODO_LETIVO', 'II Trimestre', DATE '2027-01-04', DATE '2027-04-09', 2, 30),
      ('PERIODO_LETIVO', 'III Trimestre', DATE '2027-04-26', DATE '2027-06-18', 3, 40),
      ('PROVA_TRIMESTRAL', 'Provas do I Trimestre', DATE '2026-12-09', DATE '2026-12-18', 1, NULL),
      ('PROVA_TRIMESTRAL', 'Provas do II Trimestre', DATE '2027-03-31', DATE '2027-04-09', 2, NULL),
      ('PROVA_TRIMESTRAL', 'Provas do III Trimestre', DATE '2027-06-09', DATE '2027-06-18', 3, NULL),
      ('PAUSA_PEDAGOGICA', 'Pausa Pedagógica do I Trimestre', DATE '2026-12-21', DATE '2026-12-31', NULL, NULL),
      ('PAUSA_PEDAGOGICA', 'Pausa Pedagógica do II Trimestre', DATE '2027-04-12', DATE '2027-04-23', NULL, NULL),
      ('FERIADO', 'Dia do Herói Nacional e ponte', DATE '2026-09-17', DATE '2026-09-18', NULL, NULL),
      ('FERIADO', 'Dia dos Finados', DATE '2026-11-02', DATE '2026-11-02', NULL, NULL),
      ('FERIADO', 'Dia da Independência Nacional', DATE '2026-11-11', DATE '2026-11-11', NULL, NULL),
      ('FERIADO', 'Natal', DATE '2026-12-25', DATE '2026-12-25', NULL, NULL),
      ('FERIADO', 'Ano Novo', DATE '2027-01-01', DATE '2027-01-01', NULL, NULL),
      ('FERIADO', 'Início da Luta Armada e ponte', DATE '2027-02-04', DATE '2027-02-05', NULL, NULL),
      ('FERIADO', 'Carnaval', DATE '2027-02-08', DATE '2027-02-09', NULL, NULL),
      ('FERIADO', 'Dia Internacional da Mulher', DATE '2027-03-08', DATE '2027-03-08', NULL, NULL),
      ('FERIADO', 'Dia da Libertação da África Austral e ponte', DATE '2027-03-22', DATE '2027-03-23', NULL, NULL),
      ('FERIADO', 'Sexta-feira Santa', DATE '2027-03-26', DATE '2027-03-26', NULL, NULL),
      ('FERIADO', 'Dia da Paz e Reconciliação Nacional', DATE '2027-04-04', DATE '2027-04-04', NULL, NULL),
      ('FERIADO', 'Dia do Trabalhador', DATE '2027-05-01', DATE '2027-05-01', NULL, NULL),
      ('EXAME_ORAL', 'Exames Orais', DATE '2027-06-21', DATE '2027-06-22', NULL, NULL),
      ('EXAME_ESCRITO', 'Exames Escritos - 1.ª Chamada', DATE '2027-06-21', DATE '2027-07-02', NULL, NULL),
      ('EXAME_ESCRITO', 'Exames Escritos - 2.ª Chamada', DATE '2027-07-05', DATE '2027-07-09', NULL, NULL),
      ('CONSELHO_CLASSE', 'Classificação e Conselhos', DATE '2027-07-12', DATE '2027-07-15', NULL, NULL),
      ('PUBLICACAO_PAUTA', 'Afixação de Pautas', DATE '2027-07-16', DATE '2027-07-16', NULL, NULL),
      ('EVENTO_ESCOLA', 'Recursos', DATE '2027-07-21', DATE '2027-07-23', NULL, NULL),
      ('EXAME_EXTRAORDINARIO', 'Exames Extraordinários', DATE '2027-07-26', DATE '2027-07-28', NULL, NULL),
      ('ENCERRAMENTO_ANO_LETIVO', 'Encerramento do Ano Lectivo 2026/2027', DATE '2027-07-30', DATE '2027-07-30', NULL, NULL),
      ('EVENTO_ESCOLA', 'Inscrição, selecção e publicação de listas de novos alunos', DATE '2027-08-02', DATE '2027-08-13', NULL, NULL),
      ('MATRICULA', 'Matrículas dos Novos Alunos', DATE '2027-08-16', DATE '2027-08-20', NULL, NULL),
      ('PREPARACAO_ANO_LETIVO', 'Abertura do Ano Lectivo 2027/2028', DATE '2027-08-31', DATE '2027-08-31', NULL, NULL)
  )
  INSERT INTO public.calendario_template_items (
    id, template_id, tipo, nome, data_inicio, data_fim, numero, peso
  )
  SELECT
    md5(v_template_id::text || ':' || items.tipo::text || ':' || items.nome)::uuid,
    v_template_id,
    items.tipo,
    items.nome,
    items.data_inicio,
    items.data_fim,
    items.numero,
    items.peso
  FROM items
  ON CONFLICT (id) DO UPDATE SET
    tipo = EXCLUDED.tipo,
    nome = EXCLUDED.nome,
    data_inicio = EXCLUDED.data_inicio,
    data_fim = EXCLUDED.data_fim,
    numero = EXCLUDED.numero,
    peso = EXCLUDED.peso;
END
$seed$;
