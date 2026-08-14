# P0 — Checklist de integridade da reabertura de notas

Objetivo: provar que o fluxo de reabertura não permite lançamento indevido, vazamento entre escolas ou decisão sem auditoria.

## Estado da infraestrutura

- [x] Migração `20261214000000_auditoria_excecoes_pauta_p0.sql` aplicada.
- [x] Função `audit_excecao_pauta_changes` criada.
- [x] Trigger `trg_audit_excecoes_pauta_changes` ativo.
- [ ] Executar os testes funcionais com contas de homologação.

## Testes manuais obrigatórios

Executar em ambiente de homologação com contas de teste, nunca com dados reais de alunos.

1. Professor atribuído + turma fechada:
   - abrir notas;
   - confirmar bloqueio;
   - enviar justificativa válida;
   - confirmar estado `PENDENTE`.
2. Secretaria rejeita:
   - tentar rejeitar sem motivo;
   - confirmar erro de validação;
   - rejeitar com motivo;
   - confirmar que o professor vê `REJEITADO` e o motivo da decisão.
3. Secretaria aprova:
   - aprovar uma solicitação pendente;
   - confirmar prazo de 24 horas;
   - lançar/corrigir nota;
   - confirmar mensagem de sucesso.
4. Expiração:
   - alterar `expira_em` apenas em fixture de teste para o passado;
   - tentar lançar nota novamente;
   - confirmar `409` e bloqueio no banco.
5. Professor não atribuído:
   - enviar solicitação com turma/disciplina fora das atribuições;
   - confirmar `403` e nenhuma linha criada.
6. Isolamento:
   - usar conta da escola A para consultar/aprovar ID da escola B;
   - confirmar `403` ou `409` sem alteração na escola B.

## Consultas read-only de verificação

```sql
select id, escola_id, turma_id, disciplina_id, status,
       solicitado_por, aprovado_por, decidido_em, expira_em
from public.excecoes_pauta
order by created_at desc
limit 20;

select action, entity, entity_id, actor_id, escola_id,
       before, after, created_at
from public.audit_logs
where entity = 'excecoes_pauta'
   or tabela = 'excecoes_pauta'
order by created_at desc
limit 30;
```

## Critérios P0

- Nenhuma decisão sem linha correspondente em `audit_logs`.
- Nenhuma autorização expirada permite bypass no trigger.
- Nenhuma solicitação é criada sem escola, ano letivo e atribuição válidos.
- Nenhuma API retorna dados fora da escola resolvida do utilizador.
- Motivo original e motivo da decisão permanecem separados.
