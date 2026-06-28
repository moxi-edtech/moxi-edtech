# Regras de Negócio — Financeiro, Cobranças e Pagamentos

Este documento resume regras financeiras oficiais que o KLASSE Brain pode usar em respostas sobre Radar, cobranças, pagamentos e recibos.

## Radar de inadimplência

- O Radar Financeiro mostra parcelas/propinas em atraso no ano letivo ativo.
- O usuário pode filtrar devedores por turma, dias de atraso ou valores.
- O assistente pode ajudar a priorizar cobranças e preparar rascunhos, mas não deve executar cobrança crítica sozinho.

Fonte: `apps/web/src/lib/assistant/docs/manual-financeiro.md`

## Registro de pagamentos

- Pagamentos devem ser registrados em Financeiro > Pagamentos.
- O usuário deve selecionar aluno, parcelas em aberto, forma de pagamento e valor.
- O sistema bloqueia lançamentos de mensalidades futuras se houver mensalidades anteriores em aberto.
- Recibos oficiais e notas de crédito/débito são emitidos/assinados pelo fluxo oficial.

Fonte: `apps/web/src/lib/assistant/docs/manual-financeiro.md`

## Cobranças financeiras

- Cobranças podem usar canal `whatsapp`, `sms`, `email` ou `manual`.
- Status de cobrança pode incluir `enviada`, `entregue`, `respondida`, `paga` ou `falha`.
- A criação de cobranças registra escola, aluno, mensalidade, canal, mensagem, status, data de envio e usuário criador.
- O assistente deve tratar cobrança como rascunho/apoio operacional, não como execução automática de cobrança sem revisão.

Fonte: `apps/web/src/app/api/financeiro/cobrancas/route.ts`

## Templates de cobrança

- Templates de cobrança exigem nome, canal e corpo.
- Canais aceitos para template incluem `whatsapp`, `sms`, `email` e `push`.
- Templates pertencem à escola e registram usuário criador.

Fonte: `apps/web/src/app/api/financeiro/cobrancas/templates/nova/route.ts`

## Planos de cobrança com IA

- A IA pode sugerir planos de cobrança, mensagens e priorização.
- Rascunhos financeiros devem ser revisados por usuário financeiro autorizado.
- A IA não deve excluir, alterar ou consolidar dados financeiros diretamente.
- Mensagens financeiras devem usar placeholders quando possível, como `[Nome]`, `[Valor]` e `[Data]`.

Fontes:
- `apps/web/src/lib/assistant/docs/manual-financeiro.md`
- `apps/web/src/lib/assistant/docs/manual-whatsapp-utility.md`

## O que o assistente pode dizer

- Pode indicar o Radar Financeiro para inadimplentes.
- Pode explicar por que pagamento futuro pode ser bloqueado por parcelas anteriores.
- Pode gerar rascunho de cobrança ou plano de ação para revisão.
- Pode orientar abertura da Central WhatsApp ou Central de Ações IA.

## O que o assistente não pode inventar

- Não confirmar pagamento que não foi lançado no fluxo oficial.
- Não prometer emissão de recibo se o pagamento não foi registrado.
- Não enviar cobrança ou WhatsApp sem revisão humana.
- Não expor dados financeiros individuais desnecessários no prompt de IA.
