begin;

create or replace function public.confirmar_matricula_core(p_candidatura_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cand record;
  v_aluno_id uuid;
  v_matricula_id uuid;
  v_matricula_numero bigint;
begin
  select * into v_cand
  from public.candidaturas
  where id = p_candidatura_id
  for update;

  if v_cand.id is null then
    raise exception 'Candidatura não encontrada';
  end if;

  if v_cand.aluno_id is not null then
    v_aluno_id := v_cand.aluno_id;
  else
    insert into public.alunos (
      escola_id,
      nome,
      bi_numero,
      telefone_responsavel,
      email,
      status,
      created_at
    ) values (
      v_cand.escola_id,
      coalesce(v_cand.nome_candidato, v_cand.dados_candidato->>'nome_candidato'),
      v_cand.dados_candidato->>'bi_numero',
      v_cand.dados_candidato->>'telefone',
      v_cand.dados_candidato->>'email',
      'ativo',
      now()
    )
    returning id into v_aluno_id;

    update public.candidaturas
    set aluno_id = v_aluno_id
    where id = p_candidatura_id;
  end if;

  v_matricula_numero := public.confirmar_matricula_core(
    v_aluno_id,
    v_cand.ano_letivo,
    v_cand.turma_preferencial_id,
    v_cand.matricula_id
  );

  select m.id into v_matricula_id
  from public.matriculas m
  where m.aluno_id = v_aluno_id
    and m.ano_letivo = v_cand.ano_letivo
    and m.escola_id = v_cand.escola_id
    and m.numero_matricula = v_matricula_numero::text;

  return v_matricula_id;
end;
$$;

notify pgrst, 'reload schema';

commit;
