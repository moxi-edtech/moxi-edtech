# Secretaria — dashboard partilhado com Operações

A secretaria adopta a composição e os componentes do dashboard de Operações usado pelo admin financeiro. O contexto académico passa a usar o mesmo `EstadoVitalBanner`, consultado pela API existente, autorizada por escola e baseada em `vw_escola_estado_hoje`. Atalhos, caixa, produtividade e visão geral usam `AcaoRapidaCard` e `OperationalMetricCard`, com os mesmos espaçamentos e grelhas responsivas.

Evidências:
- `apps/web/src/app/secretaria/(portal-secretaria)/Dashboard.tsx`: atendimento em destaque, pesquisa global recolhida, ações compactas, consulta dos indicadores em drawers e fluxos existentes de Balcão.
- `apps/web/src/components/secretaria/ResumoCaixaSecretaria.tsx`: cartões partilhados, valores indisponíveis explícitos, cancelamento de leituras e recarga após sucesso no Balcão. Cada leitura é local à instância, sem cache partilhada de dados do funcionário.
- `apps/web/src/components/secretaria/MinhaProdutividade.tsx`: cartões partilhados e atividade recolhida por defeito.
- `apps/web/src/components/secretaria/ExpedienteDashboardCard.tsx`: variante compacta nas duas funções; âmbito operacional/supervisão preservado.
- `apps/web/src/components/layout/escola-admin/EstadoVitalBanner.stories.tsx`: contexto regular, interrupção e evento do dia nas duas variantes.

Sem alterações de API, SQL, RLS, permissões ou dependências de produção. As métricas financeiras continuam limitadas ao funcionário autenticado. Não se introduzem consultas agregadas adicionais nem polling na dashboard. A nova leitura de contexto académico corre após o primeiro render, com `no-store`, sem bloquear os restantes conteúdos. O polling preexistente de pedidos de reabertura permanece no hub partilhado.

Metas de performance: dashboard/derivados p95 <200 ms; primeira apresentação com skeleton <300 ms; feedback de mutação <50 ms. São metas do contrato existente, não medições desta sessão.

Validação: TypeScript, ESLint dos ficheiros alterados e contratos de Operações/fecho/reabertura. A revisão visual interactiva de mobile/desktop e temas continua necessária; o browser deste ambiente recusou a ligação à prévia local.

Próximos passos:
- Rever a apresentação com sessão de secretaria em mobile e desktop.
- Confirmar os checks da PR antes da integração.
