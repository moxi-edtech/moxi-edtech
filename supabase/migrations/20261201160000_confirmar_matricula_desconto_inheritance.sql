BEGIN;

-- Atualizar confirmar_matricula_core para suportar descontos
-- Como a função é complexa, vou apenas injetar a lógica de cópia dos novos campos.

CREATE OR REPLACE FUNCTION public.confirmar_matricula_core(
  p_candidatura_id uuid
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_cand record;
  v_aluno_id uuid;
  v_matricula_id uuid;
  v_matricula_numero bigint;
  v_enc_nome text;
  v_enc_email text;
  v_enc_telefone text;
  v_enc_relacao text;
  v_encarregado_id uuid;
begin
  -- 1. Obter dados da candidatura
  select * into v_cand from public.candidaturas where id = p_candidatura_id;
  if v_cand.id is null then
    raise exception 'Candidatura não encontrada';
  end if;

  -- 2. Garantir que o Aluno existe (ou criar)
  v_aluno_id := v_cand.aluno_id;
  if v_aluno_id is null then
    insert into public.alunos (
      escola_id, nome, bi_numero, telefone, email, responsavel_nome, 
      responsavel_contato, encarregado_nome, encarregado_telefone, 
      encarregado_email, status
    ) values (
      v_cand.escola_id, v_cand.nome_candidato, 
      v_cand.dados_candidato->>'bi_numero',
      v_cand.dados_candidato->>'telefone',
      v_cand.dados_candidato->>'email',
      v_cand.dados_candidato->>'responsavel_nome',
      v_cand.dados_candidato->>'responsavel_contato',
      v_cand.dados_candidato->>'encarregado_nome',
      v_cand.dados_candidato->>'encarregado_telefone',
      v_cand.dados_candidato->>'encarregado_email',
      'ativo'
    ) returning id into v_aluno_id;

    update public.candidaturas set aluno_id = v_aluno_id where id = p_candidatura_id;
  end if;

  -- 3. Criar ou Atualizar a Matrícula herdando descontos
  if v_cand.matricula_id is not null then
    update public.matriculas
    set 
      turma_id = v_cand.turma_preferencial_id,
      status = 'ativa',
      percentagem_desconto = coalesce(v_cand.percentagem_desconto, 0),
      motivo_desconto = v_cand.motivo_desconto
    where id = v_cand.matricula_id
    returning id into v_matricula_id;
  else
    insert into public.matriculas (
      escola_id, aluno_id, turma_id, ano_letivo, status, 
      percentagem_desconto, motivo_desconto
    ) values (
      v_cand.escola_id, v_aluno_id, v_cand.turma_preferencial_id, 
      v_cand.ano_letivo, 'ativa',
      coalesce(v_cand.percentagem_desconto, 0),
      v_cand.motivo_desconto
    ) returning id into v_matricula_id;
  end if;

  return v_matricula_id;
end;
$function$;

COMMIT;
