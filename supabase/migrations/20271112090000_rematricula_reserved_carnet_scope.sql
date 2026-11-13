-- Preserve pending reservations until payment; reuse the existing annual writer.
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_mensalidade_matricula_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_matricula record;
  v_ano_letivo int;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_inicio_cobranca date;
  v_competencia date;
begin
  if new.matricula_id is null and new.turma_id is null then
    return new;
  end if;

  if new.matricula_id is null then
    if new.ano_letivo is null or new.ano_letivo !~ '^[0-9]+$' then
      raise exception 'Mensalidade sem ano letivo não pode ser associada a uma matrícula';
    end if;

    select m.*
      into v_matricula
    from public.matriculas m
    where m.escola_id = new.escola_id
      and m.aluno_id = new.aluno_id
      and m.turma_id = new.turma_id
      and m.ano_letivo = new.ano_letivo::int
      and lower(coalesce(m.status, '')) in ('ativo', 'ativa', 'active')
    order by coalesce(m.data_inicio_financeiro, m.data_matricula, m.created_at::date) desc,
             m.created_at desc
    limit 1;

    if v_matricula.id is null then
      raise exception 'Mensalidade sem matrícula activa para o aluno %, turma % e ano %',
        new.aluno_id, new.turma_id, new.ano_letivo;
    end if;
    new.matricula_id := v_matricula.id;
  else
    select m.*
      into v_matricula
    from public.matriculas m
    where m.id = new.matricula_id;

    if v_matricula.id is null then
      raise exception 'Matrícula da mensalidade não encontrada: %', new.matricula_id;
    end if;
  end if;

  if v_matricula.escola_id <> new.escola_id
     or v_matricula.aluno_id <> new.aluno_id
     or (new.turma_id is not null and v_matricula.turma_id is distinct from new.turma_id) then
    raise exception 'Mensalidade não pertence à matrícula informada';
  end if;

  if lower(coalesce(v_matricula.status, '')) not in ('ativo', 'ativa', 'active') then
    -- Only the scoped carnet RPC may INSERT charges on a validated reservation.
    -- Ordinary writes and scope-changing UPDATEs still require an active enrollment.
    if TG_OP <> 'INSERT'
       or public.canonicalize_matricula_status_text(v_matricula.status) is distinct from 'pendente'
       or v_matricula.ativo is distinct from false
       or current_setting('klasse.rematricula_carnet_matricula_id', true) is distinct from v_matricula.id::text
       or public.current_tenant_escola_id() is distinct from v_matricula.escola_id
       or not public.user_has_role_in_school(v_matricula.escola_id,
         ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria','admin_secretario','diretor','secretaria_financeiro','secretaria'])
       or not exists (
         select 1 from public.matriculas origem
         join public.anos_letivos destino on destino.id = v_matricula.session_id
           and destino.escola_id = v_matricula.escola_id
           and destino.ano = v_matricula.ano_letivo and destino.ativo
         join public.turmas turma on turma.id = v_matricula.turma_id
           and turma.escola_id = v_matricula.escola_id and turma.ano_letivo_id = destino.id
         where origem.id = v_matricula.origem_transicao_matricula_id
           and origem.escola_id = v_matricula.escola_id
           and origem.aluno_id = v_matricula.aluno_id
           and origem.ano_letivo < v_matricula.ano_letivo
           and origem.session_id is distinct from v_matricula.session_id
           and public.canonicalize_matricula_status_text(origem.status) in ('ativo','concluido','reprovado','transferido')
       ) then
      raise exception 'Não é permitido lançar mensalidade para matrícula não activa (%)', v_matricula.status;
    end if;
  end if;

  if new.ano_letivo is not null
     and (new.ano_letivo !~ '^[0-9]+$' or new.ano_letivo::int <> v_matricula.ano_letivo) then
    raise exception 'Ano letivo da mensalidade não corresponde à matrícula';
  end if;

  new.turma_id := coalesce(new.turma_id, v_matricula.turma_id);
  new.ano_letivo := v_matricula.ano_letivo::text;
  v_ano_letivo := v_matricula.ano_letivo;

  select al.data_inicio, al.data_fim
    into v_periodo_inicio, v_periodo_fim
  from public.anos_letivos al
  where al.escola_id = v_matricula.escola_id
    and al.ano = v_ano_letivo
  order by al.ativo desc, al.created_at desc
  limit 1;

  if new.mes_referencia is null
     or new.ano_referencia is null
     or new.mes_referencia not between 1 and 12 then
    raise exception 'Competência de mensalidade inválida';
  end if;

  v_competencia := make_date(new.ano_referencia, new.mes_referencia, 1);

  if v_periodo_inicio is not null and v_periodo_fim is not null
     and (
       v_competencia < date_trunc('month', v_periodo_inicio)::date
       or v_competencia > date_trunc('month', v_periodo_fim)::date
     ) then
    raise exception 'Competência %/% fora do calendário do ano letivo %',
      new.mes_referencia, new.ano_referencia, v_ano_letivo;
  end if;

  v_inicio_cobranca := date_trunc(
    'month',
    coalesce(v_periodo_inicio, make_date(v_ano_letivo, 1, 1))
  )::date;

  if v_competencia < v_inicio_cobranca then
    raise exception 'Mensalidade anterior ao início do período letivo (%)', v_inicio_cobranca;
  end if;

  new.aluno_id := v_matricula.aluno_id;
  new.escola_id := v_matricula.escola_id;
  return new;
end;
$function$;


-- Garante, para uma única matrícula, o vínculo financeiro do ano lectivo.
-- É idempotente e não move turma/classe nem cria uma nova matrícula.
CREATE OR REPLACE FUNCTION public.garantir_vinculo_financeiro_rematricula(
  p_escola_id uuid,
  p_matricula_id uuid,
  p_ano_letivo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_matricula record;
  v_previous_scope text := current_setting('klasse.rematricula_carnet_matricula_id', true);
  v_carnet jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'UNAUTHENTICATED');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (p.escola_id = p_escola_id OR p.current_escola_id = p_escola_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'FORBIDDEN');
  END IF;

  SELECT m.id, m.turma_id, m.session_id, m.ano_letivo, m.status, al.id AS ano_id, al.ano, al.data_inicio
    INTO v_matricula
  FROM public.matriculas m
  JOIN public.anos_letivos al ON al.id = p_ano_letivo_id AND al.escola_id = p_escola_id
  JOIN public.turmas t ON t.id = m.turma_id AND t.escola_id = p_escola_id
  WHERE m.id = p_matricula_id
    AND m.escola_id = p_escola_id
    AND m.session_id = al.id
    AND m.ano_letivo = al.ano
    AND t.ano_letivo_id = al.id
  FOR UPDATE OF m;

  IF v_matricula.id IS NULL OR v_matricula.data_inicio IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'MATRICULA_TURMA_ANO_INVALIDOS');
  END IF;

  UPDATE public.matriculas
     SET data_inicio_financeiro = v_matricula.data_inicio,
         updated_at = now()
   WHERE id = v_matricula.id
     AND escola_id = p_escola_id
     AND data_inicio_financeiro IS DISTINCT FROM v_matricula.data_inicio;

  -- Transaction-local and enrollment-specific: never activate a reservation to
  -- generate its carnet. The trigger independently validates tenant, staff and
  -- the real source -> destination relationship before accepting INSERTs.
  IF public.canonicalize_matricula_status_text(v_matricula.status) = 'pendente' THEN
    PERFORM set_config('klasse.rematricula_carnet_matricula_id', v_matricula.id::text, true);
  END IF;
  SELECT financeiro.gerar_carnet_anual(v_matricula.id) INTO v_carnet;
  PERFORM set_config('klasse.rematricula_carnet_matricula_id', coalesce(v_previous_scope, ''), true);
  IF coalesce((v_carnet->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'erro', coalesce(v_carnet->>'erro', 'CARNET_NOT_GENERATED'));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'matricula_id', v_matricula.id,
    'inicio_financeiro', v_matricula.data_inicio,
    'mensalidades_geradas', coalesce((v_carnet->>'mensalidades')::integer, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.garantir_vinculo_financeiro_rematricula(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garantir_vinculo_financeiro_rematricula(uuid, uuid, uuid) TO authenticated;

COMMIT;
