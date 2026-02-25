BEGIN;

CREATE OR REPLACE FUNCTION public.confirmar_matricula_core(p_candidatura_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_cand record;
  v_aluno_id uuid;
  v_matricula_id uuid;
  v_matricula_numero bigint;
  v_encarregado_id uuid;
  v_enc_nome text;
  v_enc_email text;
  v_enc_telefone text;
  v_enc_relacao text;
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
      responsavel,
      responsavel_nome,
      responsavel_contato,
      encarregado_nome,
      encarregado_telefone,
      encarregado_email,
      status,
      created_at
    ) values (
      v_cand.escola_id,
      coalesce(
        v_cand.nome_candidato,
        v_cand.dados_candidato->>'nome_completo',
        v_cand.dados_candidato->>'nome',
        v_cand.dados_candidato->>'nome_candidato'
      ),
      v_cand.dados_candidato->>'bi_numero',
      coalesce(
        v_cand.dados_candidato->>'telefone_responsavel',
        v_cand.dados_candidato->>'responsavel_contato',
        v_cand.dados_candidato->>'encarregado_telefone',
        v_cand.dados_candidato->>'telefone'
      ),
      coalesce(
        v_cand.dados_candidato->>'email',
        v_cand.dados_candidato->>'encarregado_email'
      ),
      coalesce(
        v_cand.dados_candidato->>'responsavel',
        v_cand.dados_candidato->>'responsavel_nome',
        v_cand.dados_candidato->>'encarregado_nome'
      ),
      v_cand.dados_candidato->>'responsavel_nome',
      v_cand.dados_candidato->>'responsavel_contato',
      v_cand.dados_candidato->>'encarregado_nome',
      v_cand.dados_candidato->>'encarregado_telefone',
      v_cand.dados_candidato->>'encarregado_email',
      'ativo',
      now()
    )
    returning id into v_aluno_id;

    update public.candidaturas
    set aluno_id = v_aluno_id
    where id = p_candidatura_id;
  end if;

  v_enc_nome := coalesce(
    v_cand.dados_candidato->>'responsavel_nome',
    v_cand.dados_candidato->>'responsavel',
    v_cand.dados_candidato->>'encarregado_nome'
  );
  v_enc_email := v_cand.dados_candidato->>'encarregado_email';
  v_enc_telefone := coalesce(
    v_cand.dados_candidato->>'responsavel_contato',
    v_cand.dados_candidato->>'encarregado_telefone',
    v_cand.dados_candidato->>'telefone_responsavel'
  );
  v_enc_relacao := v_cand.dados_candidato->>'encarregado_relacao';

  if v_enc_nome is not null or v_enc_email is not null or v_enc_telefone is not null then
    if v_enc_email is not null and v_enc_email <> '' then
      insert into public.encarregados (escola_id, nome, telefone, email)
      values (v_cand.escola_id, coalesce(v_enc_nome, 'Encarregado'), v_enc_telefone, v_enc_email)
      on conflict (escola_id, email)
      do update set
        nome = excluded.nome,
        telefone = coalesce(excluded.telefone, public.encarregados.telefone)
      returning id into v_encarregado_id;
    else
      insert into public.encarregados (escola_id, nome, telefone)
      values (v_cand.escola_id, coalesce(v_enc_nome, 'Encarregado'), v_enc_telefone)
      returning id into v_encarregado_id;
    end if;

    if v_encarregado_id is not null then
      insert into public.aluno_encarregados (escola_id, aluno_id, encarregado_id, relacao, principal)
      values (v_cand.escola_id, v_aluno_id, v_encarregado_id, v_enc_relacao, true)
      on conflict (aluno_id, encarregado_id)
      do update set
        relacao = coalesce(excluded.relacao, public.aluno_encarregados.relacao),
        principal = true;
    end if;
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

COMMIT;
