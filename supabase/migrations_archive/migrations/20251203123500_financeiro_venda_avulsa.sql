-- Função para registrar venda avulsa com controle de estoque
-- Atualiza estoque e cria lançamento financeiro de forma atômica
create or replace function public.registrar_venda_avulsa(
  p_escola_id uuid,
  p_aluno_id uuid,
  p_item_id uuid,
  p_quantidade int,
  p_valor_unit numeric,
  p_desconto numeric default 0,
  p_metodo_pagamento metodo_pagamento_enum default 'numerario',
  p_status financeiro_status default 'pago',
  p_descricao text default null,
  p_created_by uuid default null
)
returns table(lancamento_id uuid, estoque_atual int) as $$
declare
  v_item financeiro_itens%rowtype;
  v_total numeric(12,2);
  v_desc text;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade inválida';
  end if;

  select *
    into v_item
    from financeiro_itens
   where id = p_item_id
     and escola_id = p_escola_id
   for update;

  if not found then
    raise exception 'Item não encontrado para a escola';
  end if;

  if v_item.controla_estoque and v_item.estoque_atual < p_quantidade then
    raise exception 'Estoque insuficiente';
  end if;

  v_total := coalesce(p_valor_unit, v_item.preco) * p_quantidade;
  v_desc := coalesce(p_descricao, 'Venda de ' || v_item.nome);

  update financeiro_itens
     set estoque_atual = estoque_atual - case when v_item.controla_estoque then p_quantidade else 0 end,
         updated_at = now()
   where id = v_item.id
   returning estoque_atual into estoque_atual;

  insert into financeiro_lancamentos(
    escola_id,
    aluno_id,
    matricula_id,
    tipo,
    origem,
    descricao,
    valor_original,
    valor_multa,
    valor_desconto,
    status,
    data_pagamento,
    metodo_pagamento,
    created_by
  ) values (
    p_escola_id,
    p_aluno_id,
    null,
    'debito',
    'venda_avulsa',
    v_desc,
    v_total,
    0,
    coalesce(p_desconto, 0),
    coalesce(p_status, 'pago'),
    case when coalesce(p_status, 'pago') = 'pago' then now() else null end,
    p_metodo_pagamento,
    p_created_by
  ) returning id into lancamento_id;

  return next;
end;
$$ language plpgsql security definer set search_path = public;
