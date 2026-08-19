# Status — Janela de cobrança por turma

Data: 2026-08-15  
Estado: implementação concluída; homologação pendente

## Objetivo

Permitir que turmas de exame tenham uma janela de cobrança própria, sem alterar cobranças de turmas regulares e sem espalhar regras entre telas e APIs.

## Fonte única da verdade

- Configuração persistida: `public.turma_janelas_cobranca`.
- Resolução efetiva: `public.resolve_turma_janela_cobranca(turma_id, ano_letivo_id)`.
- Regra de competência na aplicação: `apps/web/src/lib/financeiro/turma-billing-window.ts`.
- Enforcement adicional: triggers e funções financeiras existentes no banco.

## Consumidores migrados

- pagamento no balcão;
- geração de mensalidades;
- rematrícula;
- confirmação de rematrícula;
- painel contextual de erro.

## Fluxo gracioso

Quando uma mensalidade está fora da janela, o sistema informa a competência e abre **Configurar janela da turma**. O painel mostra turma, ano letivo, período atual, data final permitida e prévia das mensalidades. Depois de guardar, tenta o pagamento novamente. Se o retry falhar, o painel permanece aberto.

## Validação realizada

- RPC criada e validada no Supabase com a assinatura esperada.
- `git diff --check` passou nas áreas alteradas.
- Nenhum dado financeiro foi alterado pela migration.

## Pendente para fechar a entrega

- executar homologação com uma turma regular;
- executar homologação com uma turma de exame;
- testar extensão da janela e retry do pagamento;
- confirmar que competência fora da janela continua bloqueada;
- fazer commit e deploy.

