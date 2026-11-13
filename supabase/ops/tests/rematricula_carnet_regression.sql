SELECT set_config('request.jwt.claim.sub',fixture_id('staff')::text,false);
CREATE FUNCTION public.fixture_assert_rejected(command text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE command;
  RAISE EXCEPTION 'Expected rejection: %',command;
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Não é permitido lançar mensalidade para matrícula não activa%' THEN RAISE; END IF;
END $$;
DO $$ DECLARE result jsonb; BEGIN
  result:=garantir_vinculo_financeiro_rematricula(fixture_id('school'),fixture_id('reservation'),fixture_id('year'));
  ASSERT result->>'ok'='true' AND (result->>'mensalidades_geradas')::int=11, result::text;
  ASSERT (SELECT count(*)=11 AND min(make_date(ano_referencia,mes_referencia,1))='2026-09-01'::date AND max(make_date(ano_referencia,mes_referencia,1))='2027-07-01'::date AND sum(valor_previsto)=27500 FROM mensalidades);
  ASSERT (SELECT status='pendente' AND ativo=false FROM matriculas WHERE id=fixture_id('reservation'));
  ASSERT coalesce(current_setting('klasse.rematricula_carnet_matricula_id',true),'')='';
  -- A second request reuses the same carnet and preserves settled amounts.
  UPDATE mensalidades SET valor_pago_total=2500,status='pago' WHERE ano_referencia=2026 AND mes_referencia=9;
  result:=garantir_vinculo_financeiro_rematricula(fixture_id('school'),fixture_id('reservation'),fixture_id('year'));
  ASSERT (result->>'mensalidades_geradas')::int=0 AND (SELECT count(*)=11 FROM mensalidades);
  ASSERT (SELECT valor_pago_total=2500 AND status='pago' FROM mensalidades WHERE ano_referencia=2026 AND mes_referencia=9);
END $$;
-- Ordinary direct generation and scope edits must still reject pending rows.
SELECT fixture_assert_rejected($q$ SELECT financeiro.gerar_carnet_anual(fixture_id('reservation')) $q$);
SELECT fixture_assert_rejected($q$ UPDATE mensalidades SET turma_id=turma_id WHERE mes_referencia=10 $q$);
-- Even with a forged scope, wrong roles and invalid source links fail.
SELECT set_config('request.jwt.claim.sub',fixture_id('student')::text,false);
SELECT fixture_assert_rejected($q$ SELECT garantir_vinculo_financeiro_rematricula(fixture_id('school'),fixture_id('reservation'),fixture_id('year')) $q$);
SELECT set_config('request.jwt.claim.sub',fixture_id('otherstaff')::text,false);
DO $$ BEGIN ASSERT (garantir_vinculo_financeiro_rematricula(fixture_id('school'),fixture_id('reservation'),fixture_id('year'))->>'erro')='FORBIDDEN'; END $$;
SELECT set_config('request.jwt.claim.sub',fixture_id('staff')::text,false);
UPDATE matriculas SET origem_transicao_matricula_id=null WHERE id=fixture_id('reservation');
SELECT fixture_assert_rejected($q$ SELECT garantir_vinculo_financeiro_rematricula(fixture_id('school'),fixture_id('reservation'),fixture_id('year')) $q$);
UPDATE matriculas SET origem_transicao_matricula_id=fixture_id('source') WHERE id=fixture_id('reservation');
UPDATE matriculas SET aluno_id=fixture_id('differentstudent') WHERE id=fixture_id('source');
SELECT fixture_assert_rejected($q$ SELECT garantir_vinculo_financeiro_rematricula(fixture_id('school'),fixture_id('reservation'),fixture_id('year')) $q$);
UPDATE matriculas SET aluno_id=fixture_id('student') WHERE id=fixture_id('source');
UPDATE matriculas SET escola_id=fixture_id('otherschool') WHERE id=fixture_id('source');
SELECT fixture_assert_rejected($q$ SELECT garantir_vinculo_financeiro_rematricula(fixture_id('school'),fixture_id('reservation'),fixture_id('year')) $q$);
UPDATE matriculas SET escola_id=fixture_id('school'),ano_letivo=2027 WHERE id=fixture_id('source');
SELECT fixture_assert_rejected($q$ SELECT garantir_vinculo_financeiro_rematricula(fixture_id('school'),fixture_id('reservation'),fixture_id('year')) $q$);
UPDATE matriculas SET ano_letivo=2025 WHERE id=fixture_id('source');
UPDATE matriculas SET status='cancelado' WHERE id=fixture_id('reservation');
SELECT fixture_assert_rejected($q$ SELECT garantir_vinculo_financeiro_rematricula(fixture_id('school'),fixture_id('reservation'),fixture_id('year')) $q$);
-- After the existing finalizer activates enrollment, normal generation works.
UPDATE matriculas SET status='ativo',ativo=true WHERE id=fixture_id('reservation');
DO $$ BEGIN
  ASSERT (financeiro.gerar_carnet_anual(fixture_id('reservation'))->>'ok')='true';
  ASSERT (SELECT count(*)=11 FROM mensalidades);
  ASSERT (SELECT count(*)=2 FROM matriculas);
  ASSERT coalesce(current_setting('klasse.rematricula_carnet_matricula_id',true),'')='';
END $$;
