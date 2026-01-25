begin;

insert into public.frequencias (escola_id, matricula_id, data, status)
select
  p.escola_id,
  m.id as matricula_id,
  p.data,
  p.status
from public.presencas p
join public.matriculas m
  on m.aluno_id = p.aluno_id
 and m.turma_id = p.turma_id
 and m.escola_id = p.escola_id
 and m.status in ('ativo','ativa','active')
where p.escola_id is not null
on conflict (escola_id, matricula_id, data) do nothing;

notify pgrst, 'reload schema';

commit;
