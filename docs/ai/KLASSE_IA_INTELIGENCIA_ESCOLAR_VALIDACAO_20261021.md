# Validação do pacote de inteligência escolar · 21/10/2026

## Estado e decisão de segurança

PR #214 empilhado sobre PR #212, sem merge, deploy ou migration. Reutiliza o `data-copilot/tool-registry` e o `AiChatWidget`, com catálogo tipado, filtros validados, continuação de conversa ligada a utilizador e escola, limites e recusa explícita de resultados não demonstráveis. Não foi adicionada ferramenta de escrita nem SQL livre. O conjunto de ferramentas existente permanece em funcionamento.

## Mapeamento efetivamente implementado

| Pergunta | Resultado atual | Fonte | Estado |
|---|---|---|---|
| 1. Docentes com notas por lançar | Distintos, denominador, 3 estados, prazo; recusa se calendário/atribuição ausente | `vw_professor_pendencias`, `periodos_letivos`, `vw_turmas_para_matricula` | Parcial: falta provar atribuições completas/avaliações previstas fora da MV |
| 2. Docentes/turmas | Lista paginada, máximo 8 docentes, turmas e disciplinas | Idem + `vw_search_professores` | Parcial, condicionado à mesma prova |
| 3. Alunos sem notas numa disciplina | Recusa correta: view por avaliação duplica alunos | `vw_professor_pendencias` | Lacuna documentada |
| 4. Alunos com mais de N faltas no mês | Recusa correta: fonte não tem recorte mensal | `vw_frequencia_resumo_aluno` | Lacuna documentada |
| 5. Matrículas pendentes | Recusa correta: candidatura não equivale a matrícula | `vw_admissoes_counts_por_status` | Lacuna documentada |
| 6. Turmas com vagas | Contagem e lista limitadas por classe e ano | `vw_turmas_para_matricula` | Implementada para papéis organizacionais |
| 7. Previsto e recebido | Montantes separados por mês/ano, caixa liquidado | `vw_financeiro_kpis_mes_ano` | Implementada para papéis organizacionais |
| 8. Mensalidades vencidas há N dias | Recusa correta: falta detalhe por mensalidade | `vw_financeiro_inadimplencia_top_ano` | Lacuna documentada |
| 9. Alunos sem documentos | Recusa correta: falta obrigatoriedade canónica | `documentos_emitidos` | Lacuna documentada |
| 10. Risco de reprovação por turma | Recusa correta: radar heurístico não equivale ao resolvedor RAA | `raa-progression-server`, `vw_risco_pedagogico_aluno` | Lacuna documentada |

## Testes e limites do que foi provado

- Teste golden local: 50 formulações equivalentes, 5 por intenção; provedor real não chamado.
- Testes de contagem: docente em várias turmas, parcial, não exigível, ausência de atribuição e de prazo, mudança de trimestre, filtros inválidos, dados maliciosos e troca de escola/utilizador.
- O cenário visual usa **dados inteiramente sintéticos**. Playwright com Chrome instalado substitui agent-browser. As capturas em `docs/ai/evidence/intelligence/` cobrem 360×640, 390×844, 768×1024, 1366×768 e 1920×1080, em 100%, 125% e 150%; incluem também papel de Secretaria, Direção e Professor e duas escolas sintéticas. A fixture intercepta o endpoint, não testa integração real com Postgres/Auth.
- **Não provado:** E2E autenticado com Supabase local, testes de contrato reais das views contra Postgres descartável, índices/EXPLAIN das MVs, fiabilidade do provedor real, polo (ausente no read-model), consistência das atribuições e critérios de reprovação RAA.
- A auditoria usa `audit_logs` com contagem por utilizador e escola; na ausência de autorização de leitura/inserção recusa, não desativa o guard. Esta integração necessita teste de contrato com RLS real.
- O orçamento por consulta é 5,5 s nos pedidos às views e 7,5 s no cliente; limites de linhas evitam extrapolação de amostras. A operação não cria cron, não altera views ou banco em produção e não faz chamadas ao provedor para o catálogo.

## Passos gated e riscos residuais

1. **Dados de polo:** aprovar modelo canónico de vínculo utilizador↔polo↔turma/financeiro, testes de RLS e leitura isolada. Até lá a Secretaria não obtém visão agregada escolar pelo catálogo, mesmo com permissão de módulo; é uma recusa deliberada.
2. **Docentes:** validar em Postgres descartável a cobertura de atribuições, calendário e avaliações previstas, inclusive docente sem pendência, antes de considerar denominador completo. A MV de pendências não garante esse universo; o total atualmente pode subcontar docentes com lançamentos completos.
3. **Fontes em falta:** read-models canónicos para alunos distintos sem nota, faltas mensais, matrícula pendente, documento obrigatório, mensalidades por vencimento e critérios oficiais de reprovação. Qualquer migration nova precisa teste de aplicação/reaplicação/reversão e aprovação separada antes de produção.
4. **Ambiente autenticado:** fixtures locais por escola/polo/papel e E2E com Auth/Postgres/RLS para comprovar acesso cruzado e auditoria.
5. **Provedor:** não é necessário ao catálogo determinístico; respostas conversacionais fora do catálogo continuam a depender da configuração existente.

**Nenhuma lacuna é mascarada com números inventados.** A entrega é segura para revisão de código, mas não demonstra ainda a definição integral de pronto para ativação operacional.
