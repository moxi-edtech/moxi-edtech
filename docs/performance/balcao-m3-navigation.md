# M3 — navegação, histórico e contexto

Alteração real: `BalcaoPageClient` usa **History API nativa** ao trocar de abas; isso preserva entradas distintas para Voltar/Avançar e evita executar novamente o Server Component a cada clique. Trocar/alocar aluno continua a usar `router.replace` para não acumular identidades anteriores no histórico sem necessidade. `setBalcaoLocationContext` preserva aluno corrente como `atendimentoAlunoId` durante Nova Matrícula, sem dar esse aluno como alvo da inscrição. Os dados visíveis continuam isolados por `(operador, escola, polo, aluno)`.

## E2E controlado executado

`apps/web/scripts/performance/balcao-route-e2e.mjs` usa Playwright/Chromium, servidor local de componentes React reais e apenas dados sintéticos: Aluno A → Pagamentos → Perfil → Nova Matrícula → Voltar → aluno A → Avançar; confirmação do alvo independente; respostas simuladas com 450 ms e 15 ms e teste de geração, pelo qual uma resposta velha **não substitui** o aluno B; campos editados em abas retidas, cancelamento de troca com rascunho pendente. O teste não aplica skip e é executado pelo orçamento CI.

O script de evidência opcional produz **105 capturas** em 5 viewports × 3 zooms CSS × 7 superfícies, com assertions de overflow horizontal do documento. `docs/performance/balcao-m3-evidence.json` guarda apenas viewport, zoom, overflow, nome e categoria da fixture.

## Prova NÃO realizada / gate

O teste de URL/React exercita o mecanismo original, mas o ambiente é Vite com ator/role de fixture, **não** autentica contra Auth do Supabase, não executa RLS e não prova transação financeira real. Homologação Next.js autenticada fica gated pelo replay das **todas** migrations num Postgres descartável (M2), que continua bloqueado por problemas históricos de ordenação e sintaxe de migrations (ver `balcao-m2-finance-integration.md`). Não interpretar teste sintético como validação real de permissão. Nenhum dado da produção foi acedido.
