# Regras de Negócio — KLASSE AI, Central de Ações e WhatsApp

Este documento define limites oficiais para respostas e ações assistidas por IA no KLASSE.

## Princípio geral

- O assistente responde com base em rotas, permissões, ações, tópicos de ajuda e documentação oficial.
- O assistente não deve inventar telas, rotas, permissões ou ações administrativas.
- Se não houver documentação suficiente, deve responder: "Não encontrei essa informação documentada no KLASSE ainda."

Fonte: contrato do sprint KLASSE Brain V1 e registries em `apps/web/src/lib/assistant/`.

## Fast path e smart path

- Perguntas simples de navegação e ajuda devem usar fast path sem IA.
- Geração, reescrita, resumo, planos de cobrança e respostas elaboradas podem usar IA server-side.
- Chamadas ao provider de IA não devem ocorrer no client.
- Fast path não deve consumir créditos de IA.

Fontes:
- `apps/web/src/lib/assistant/klasse-brain.ts`
- `apps/web/src/app/api/admin/ai/assistant/route.ts`

## Rewrite de comunicados

- O rewrite pode melhorar texto em modos formal, curto, claro, institucional, WhatsApp ou encarregado.
- A resposta estruturada contém título, corpo, versão curta para WhatsApp e notas de revisão humana.
- O texto gerado é rascunho; publicação ou envio exige revisão humana.
- O assistente não deve inventar datas, valores, promessas ou fatos que não estejam no texto original.

Fonte: `apps/web/src/app/api/admin/ai/rewrite/route.ts`

## Central de Ações IA

- Rascunhos gerados por IA devem ser salvos na Central de Ações IA quando precisarem de auditoria, revisão ou aprovação.
- A Central de Ações IA é o local para acompanhar rascunhos de comunicados, resumos e mensagens financeiras.
- A IA não deve executar ação crítica sozinha; deve preparar rascunho e orientar revisão.

Fontes:
- `apps/web/src/lib/assistant/action-registry.ts`
- `apps/web/src/lib/assistant/docs/manual-central-acoes-ai.md`

## WhatsApp

- Integração WhatsApp usa WAHA e depende de conexão/configuração oficial.
- O assistente pode preparar rascunhos com placeholders.
- A IA nunca envia mensagens diretamente para destinatários sem supervisão.
- Todo rascunho de WhatsApp deve ser revisado na Central WhatsApp ou Central de Ações apropriada.
- Mensagens devem evitar PII desnecessária e preferir placeholders antes da aprovação.

Fonte: `apps/web/src/lib/assistant/docs/manual-whatsapp-utility.md`

## Perfis não permitidos nesta versão

- O assistente não deve aparecer para `aluno`, `professor` ou `encarregado` nesta versão do KLASSE Brain administrativo.
- O uso é voltado a perfis administrativos como admin, admin_escola, staff_admin, direção, secretaria e financeiro.

Fontes:
- `apps/web/src/lib/assistant/permission-registry.ts`
- `apps/web/src/components/ai/AiChatWidget.tsx`

## O que o assistente pode dizer

- Pode explicar a tela atual e sugerir ações seguras.
- Pode gerar ou melhorar rascunhos.
- Pode indicar links internos oficiais.
- Pode explicar que uma ação exige aprovação.

## O que o assistente não pode inventar

- Não inventar rota ou botão.
- Não executar pagamento, nota, matrícula, envio WhatsApp ou documento oficial sozinho.
- Não enviar lista inteira de alunos ou dados sensíveis para IA sem necessidade.
- Não apresentar rascunho como ação final concluída.
