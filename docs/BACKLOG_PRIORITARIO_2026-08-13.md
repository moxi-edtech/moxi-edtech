# KLASSE — Backlog consolidado de produto e engenharia

Data de consolidação: 13 de agosto de 2026  
Regra: cada item deve ser validado no ambiente antes de ser marcado como concluído.

## P0 — Segurança, integridade e produção

- [ ] Executar teste manual de reabertura com professor: turma aberta, turma fechada, solicitação pendente, rejeição e aprovação. Infraestrutura de auditoria já aplicada.
- [ ] Confirmar que uma aprovação expirada é rejeitada pelo trigger/RPC, mesmo que a UI esteja desatualizada.
- [ ] Confirmar que professor não atribuído não consegue solicitar reabertura.
- [ ] Confirmar isolamento por `escola_id` nas rotas de solicitação e decisão.
- [x] Registrar auditoria completa da decisão: solicitante, decisor, motivo original, motivo da decisão, prazo e before/after.
- [ ] Validar RLS de `excecoes_pauta` em ambiente de produção; a policy legada `tenant_all_access` precisa ser revisada se permitir acesso além das APIs.
- [ ] Confirmar aplicação remota das migrações de aulas, planos e vínculo de atividades; migrações de reabertura e auditoria já verificadas.
- [x] Criar checklist documentado para rollback/verificação da alteração de auditoria.

## P1 — Fluxo gracioso de professores e secretaria

- [ ] Permitir que o professor veja o histórico das próprias solicitações, não apenas a solicitação atual.
- [ ] Exibir status e prazo de reabertura na tela de notas sem exigir refresh completo da página.
- [ ] Permitir nova solicitação após rejeição com histórico preservado.
- [ ] Adicionar nomes e contexto completos no painel: classe, turma, disciplina, trimestre e professor.
- [ ] Adicionar filtro por escola, turma, disciplina, trimestre e status no painel de operações.
- [ ] Criar ação de aprovação em lote apenas após definir regra de justificativa e auditoria.
- [ ] Mostrar no portal do aluno o plano de aula aprovado associado à aula, quando a escola permitir.
- [ ] Permitir anexos com validação de tipo, tamanho, armazenamento e remoção segura no plano de aula.
- [x] Fechar o ciclo aula → confirmação do professor → chamada → resumo → relatório da secretaria.
- [x] Exibir no relatório operacional um resumo de presentes, ausentes, atrasados e plano associado.
- [x] Exibir atividades pedagógicas associadas no relatório operacional da aula.
- [x] Criar relatório detalhado por ocorrência com exportação PDF para secretaria e administração escolar.
- [x] Oferecer feedback de exportação, retry, atualização manual/automática e estados vazios orientados no relatório.
- [x] Exibir frequência nominal no relatório da ocorrência e no PDF.
- [x] Adicionar busca por turma, disciplina, professor e filtro por estado na Dashboard de Operações.

## P1 — Notas, frequência e retornos

- [ ] Testar o botão de salvar presença com dados reais e erro de RPC reproduzido.
- [x] Exibir retorno de falha da chamada com ação explícita para tentar novamente.
- [ ] Testar feedback de salvar notas em sucesso, conflito de trimestre fechado, offline e timeout.
- [ ] Padronizar mensagens de erro de RPC para não expor detalhes internos ao usuário.
- [ ] Validar ano letivo obrigatório em todas as entradas de notas, frequência, relatórios e exportações.
- [ ] Garantir que trimestre fechado e ano letivo incorreto sejam diferenciados na mensagem ao professor.
- [ ] Verificar atualização das notas no portal do aluno após lançamento e correção autorizada.

## P1 — Horários e turmas compartilhadas

- [x] Permitir edição inline de slots de horário com validação temporal existente.
- [x] Permitir acesso do professor ao quadro publicado completo da turma compartilhada.
- [x] Rejeitar conflitos de slot, professor e sala dentro da própria publicação do quadro.
- [ ] Permitir criação e edição do quadro com validação e apresentação visual de conflitos de turma, sala, professor e disciplina em uma única experiência.
- [ ] Mostrar horários compartilhados de uma turma para todos os professores atribuídos.
- [ ] Na home do professor, sugerir ações contextuais: confirmar aula, marcar presença, lançar nota, abrir plano e ver turma.
- [ ] Permitir localizar diretamente a ocorrência de aula correspondente ao horário atual.
- [ ] Registrar alterações de horário com autor, data, motivo e versão anterior.

## P2 — Notificações e acompanhamento

- [ ] Usar notificações existentes da secretaria para informar nova solicitação de reabertura.
- [ ] Informar professor quando a solicitação for aprovada ou rejeitada, sem depender de realtime.
- [ ] Criar fila de pendências com contagem por perfil: secretaria, admin escola, financeiro e admin secretaria.
- [ ] Definir política de retenção e arquivamento para decisões antigas.
- [ ] Adicionar métricas operacionais: tempo até decisão, solicitações aprovadas, rejeitadas e expiradas.

## P2 — Performance e qualidade

- [ ] Resolver avisos de hooks na página de notas e eliminar `any` nos contratos novos.
- [ ] Revisar o aviso `react-hooks/set-state-in-effect` do painel de operações.
- [ ] Confirmar limites de paginação das listas de solicitações e relatórios.
- [ ] Executar o scan previsto no contrato de engenharia e registrar `REPORT_SCAN.md` e `REPORT_SCAN.json`.
- [ ] Executar o Performance Gate para as rotas de dashboard afetadas.
- [ ] Criar testes automatizados para as APIs de solicitação, decisão e expiração.
- [ ] Criar teste E2E professor → secretaria → aprovação → lançamento.

## P2 — Higiene do repositório

- [ ] Triar os muitos arquivos não rastreados em `agents/outputs/`.
- [ ] Decidir se `.playwright-mcp/` deve ser ignorado ou versionado.
- [ ] Remover ou versionar conscientemente `tsconfig.tsbuildinfo`.
- [ ] Separar artefatos acadêmicos e de produto em commits/documentos próprios.
- [ ] Revisar arquivos em `output/` e `portfolio/` antes de qualquer publicação.
- [ ] Criar `.gitignore` para artefatos temporários, se ainda não existir regra equivalente.

## P3 — Produto e validação externa

- [ ] Preparar dossiê UNESCO com arquitetura sanitizada, metodologia, evidências e limitações.
- [ ] Executar experimento controlado com dados de teste ou piloto autorizado.
- [ ] Preparar sessão pedagógica e instrumentos de feedback com consentimento.
- [ ] Registrar resultados agregados sem dados pessoais de alunos.
- [ ] Atualizar o plano acadêmico em `academic-pending-work-plan.md` somente com evidências verificáveis.

## Ordem recomendada

1. Validar segurança e expiração da reabertura em ambiente real.
2. Confirmar migrações de aulas, planos e atividades.
3. Testar o ciclo completo da aula com chamada e relatório.
4. Corrigir notas/frequência e mensagens de erro.
5. Consolidar notificações e pendências por perfil.
6. Fazer scan, performance gate e testes E2E.
7. Triar artefatos não rastreados e organizar commits.
8. Retomar validação UNESCO e documentação acadêmica.
