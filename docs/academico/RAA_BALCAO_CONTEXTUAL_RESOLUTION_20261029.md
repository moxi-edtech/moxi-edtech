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
