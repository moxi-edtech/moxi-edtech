# RAA ↔ Balcão — resolução no mesmo atendimento

Branch: feat/balcao-raa-contextual-resolution-20261029 (empilhada sobre a PR #296).

## Contrato
- Preservar aluno, matrícula de origem e rascunho financeiro durante a resolução.
- Mostrar apenas ações compatíveis com o bloqueio devolvido pelo RAA.
- Lançamento de notas: reutilizar EnrollmentPostActionModal e API de notas com guardas de período, escala e competência.
- Reapreciação: consultar/criar/decidir pedidos via APIs existentes; deferir não significa aprovação académica.
- Faltas: decidir justificações enviadas pelo encarregado; a aprovação não modifica frequência original nem levanta automaticamente retenção.
- Indisciplina: a direção deve documentar revisão, sem desfazer sanções silenciosamente.
- Conclusão de ciclo: ir ao separador de documentos, nunca rematricular automaticamente.
- Após cada ação, voltar à mesma ficha, reconsultar RAA e abrir rematrícula apenas se a API confirmar elegibilidade.
- Não alterar matrículas.status, historico_anos, financeiro, fiscal ou AGT para contornar bloqueios.

## Homologação necessária
1. Testar roles de secretaria/direção/professor e anos históricos.
2. Conciliar justificações aprovadas com assiduidade oficial (a API atual mantém falta original).
3. Integrar resultados de exames extraordinários/recurso à publicação oficial do resultado, sem atalhos.
4. Testar contexto do aluno, abas, rascunhos e concorrência de sessões.
5. Validar Supabase v3 da PR #296 antes de merge/deploy.

## Resultados acrescentados nesta branch
- O Balcão consulta sessões oficiais de recurso e extraordinário no ano letivo da matrícula de origem; lança uma nota por componente e aluno através do endpoint canónico. Sem sessão oficial aberta, mostra a pendência, sem simulá-la.
- A API de exames exige aluno, turma, ano de origem, componente da sessão, escala, matrícula ativa e sessão aberta/publicada. Lançamentos existentes não são substituídos: repetição idempotente da mesma nota ou conflito se houve alteração.
- As justificações formalmente aprovadas passam a deixar de contar como faltas **injustificadas** no resolvedor jurídico do decreto (somente por `frequencia_id` idêntico). A frequência original e a petição mantêm-se auditáveis e imutáveis.
- O fecho legal não pode ser alterado pela nota ou pela decisão de uma petição.
- O painel revalida a elegibilidade central após a decisão; nenhum pagamento é capturado antes de ela autorizar o destino.

## Limitações que ainda exigem homologação
- Verificar paridade exata entre o resolvedor PostgreSQL e o adaptador do decreto em TypeScript após justificações de faltas, incluindo percentuais EJA e turmas com várias disciplinas.
- Uma nota de exame `submetido` não equivale ao estado `validado` ou à pauta legal publicada. A interface não cria atalhos para essa decisão.
- Contextos históricos fechados exigem reabertura formal; a simples aprovação de pedido não reescreve histórico.
- Testes unitários e GitHub CI não substituem ensaio autenticado em banco real; dependência da PR #296 permanece.
