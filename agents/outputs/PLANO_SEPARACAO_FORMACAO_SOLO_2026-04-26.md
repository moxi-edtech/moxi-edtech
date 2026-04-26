# Plano de Separação — Formação Center vs Solo Creator
data: 2026-04-26  
escopo: `apps/formacao` + `apps/auth`  
objetivo: eliminar mistura de produto na dashboard/sidebar e impor fronteira clara entre **Centro de Formação** e **Solo Creator**.

## Status de execução (2026-04-26)
- ✅ P0.1 concluído: middleware com bloqueio explícito por produto (`product_mismatch`) para prefixos críticos.
- ✅ P0.2 concluído: contrato de acesso `/admin/dashboard` alinhado com middleware (somente admin/super/global).
- ✅ P1.1 concluído: navegação separada por produto (`CENTER_NAV_CONFIG` e `SOLO_NAV_CONFIG`).
- ✅ P1.2 concluído: split de rota de mentoria e dashboard admin exclusivo de center.
- ✅ P2.1 concluído: auth central modela `solo_creator` e roteia para destino canônico solo.
- ✅ P2.2 concluído: removida preferência cega por `formacao`; seleção prioriza contexto ativo (`current_escola_id`) com fallback determinístico.
- ✅ Split de rota de mentoria concluído: `/admin/mentorias/nova` foi descontinuada para uso direto e redireciona para `/mentor/mentorias/nova`.
- ✅ Navegação atualizada para Solo Creator apontando para `/mentor/mentorias/nova`.
- ✅ `select-context` agora também persiste `profiles.current_escola_id` para fixar contexto da sessão.
- ✅ Testes unitários executados com sucesso:
  - `apps/formacao`: 10/10 pass
  - `apps/auth` (`resolveTenantRoute`): 3/3 pass
- ✅ Base de testes de integração e E2E da matriz de não-mistura montada:
  - `apps/formacao/tests/integration/non-mistura-matrix.spec.ts`
  - `apps/formacao/tests/e2e/non-mistura-matrix.e2e.spec.ts`
  - `apps/auth/tests/integration/tenant-routing-matrix.spec.ts`
- ✅ Execução atual:
  - `apps/formacao test:integration`: 5/5 pass
  - `apps/formacao test:e2e:matrix`: 3/3 pass
  - `apps/auth test:integration`: 3/3 pass
  - `apps/auth test:unit`: 3/3 pass

## Como executar os testes da matriz (baseline atual)
```bash
pnpm -C apps/formacao run test:integration
pnpm -C apps/formacao run test:e2e:matrix
pnpm -C apps/auth run test:integration
pnpm -C apps/auth run test:unit
```

## Contexto
Foi identificada mistura de navegação e dashboard entre os dois produtos no app de Formação.  
Este documento consolida:
- mapeamento técnico com evidências
- plano de execução em fases
- critérios de aceite e testes de não-mistura

## Mapeamento (evidências)
### 1. Navegação híbrida para dois produtos
- `apps/formacao/lib/navigation-engine.ts:54`
- `apps/formacao/app/(portal)/layout.tsx:90`

Diagnóstico:
- Um único `NAVIGATION_CONFIG` atende CENTER e SOLO_CREATOR.
- Sidebar depende desse motor único, herdando itens cruzados.

### 2. Regra que mistura papéis no contexto CENTER
- `apps/formacao/lib/navigation-engine.ts:196`

Diagnóstico:
- Exceção permite compartilhamento de menus de Gestão entre `ADMIN` e `MENTOR` no tenant `CENTER`.
- Essa exceção é vetor direto de mistura.

### 3. Rota `/admin/dashboard` multiplexada com dois produtos
- `apps/formacao/app/(portal)/admin/dashboard/page.tsx:63`
- `apps/formacao/app/(portal)/admin/dashboard/page.tsx:168`

Diagnóstico:
- A mesma página renderiza layout de centro e layout de mentor/solo por branch.
- Mistura de responsabilidades e risco de conteúdo cruzado.

### 4. Desalinhamento entre autorização da página e middleware
- Página aceita `formador`: `apps/formacao/app/(portal)/admin/dashboard/page.tsx:16`
- Middleware bloqueia `/admin` para `formador`: `apps/formacao/middleware.ts:60`

Diagnóstico:
- Contrato de acesso inconsistente.
- Gera comportamento imprevisível (permitido no componente, negado na borda).

### 5. Resolução de contexto enviesada para formação
- `apps/formacao/lib/session-context.ts:83`
- `apps/formacao/middleware.ts:112`

Diagnóstico:
- Fluxo privilegia `formacao` como contexto preferido.
- Em contas multi-contexto, isso aumenta chance de seleção errada.

### 6. Auth sem produto explícito para solo_creator
- `apps/auth/lib/getUserTenants.ts:5`
- `apps/auth/lib/resolveTenantRoute.ts:3`

Diagnóstico:
- `TenantType` no auth está restrito a `k12 | formacao`.
- Solo Creator não é modelado como produto explícito no roteamento central.

## Estratégia de separação
Princípio: **produto primeiro, papel depois**.

- Produto canônico por sessão: `tenant_type` (`formacao` | `solo_creator` | `k12`).
- Navegação e dashboards separados por produto.
- Middleware aplica matriz `produto x papel x prefixo`.
- Auth e seleção de contexto reconhecem `solo_creator` como produto próprio.

## Plano de execução
## Fase P0 — Guardrails de Produto (bloqueio de mistura)
### Tarefa P0.1 — Matriz de acesso por produto no middleware
Arquivos:
- `apps/formacao/middleware.ts`

Ações:
- Introduzir validação explícita de prefixos por `tenant_type`.
- Separar `role_mismatch` de `product_mismatch`.
- Bloquear acesso cross-produto antes de validar papel.

Critérios de aceite:
- Usuário `solo_creator` não acessa páginas exclusivas de center.
- Usuário `formacao` não acessa páginas exclusivas de solo.
- Logs incluem `reason: product_mismatch`.

### Tarefa P0.2 — Alinhar contratos de acesso página x middleware
Arquivos:
- `apps/formacao/app/(portal)/admin/dashboard/page.tsx`
- `apps/formacao/lib/auth-context.ts`

Ações:
- Remover permissões contraditórias (ex.: `formador` em `/admin`).
- Garantir que regras de página espelham as regras da borda.

Critérios de aceite:
- Sem divergência entre guard de página e middleware para rotas críticas.

## Fase P1 — Split de UI (sidebar + dashboards)
### Tarefa P1.1 — Separar motor de navegação por produto
Arquivos:
- `apps/formacao/lib/navigation-engine.ts`
- `apps/formacao/app/(portal)/layout.tsx`

Ações:
- Criar duas configs explícitas:
  - `NAV_CENTER`
  - `NAV_SOLO_CREATOR`
- Remover exceção de compartilhamento `ADMIN/MENTOR` em CENTER.
- Renderizar sidebar por produto, nunca por exceção de papel.

Critérios de aceite:
- Sidebar de CENTER nunca mostra itens de SOLO.
- Sidebar de SOLO nunca mostra itens de CENTER.

### Tarefa P1.2 — Desacoplar dashboards por rota/produto
Arquivos:
- `apps/formacao/app/(portal)/admin/dashboard/page.tsx`
- nova rota de dashboard solo (ex.: `/mentor/dashboard`, já existente)

Ações:
- Remover branch dupla dentro de `/admin/dashboard`.
- Manter `/admin/dashboard` exclusivo CENTER.
- Manter `/mentor/dashboard` exclusivo SOLO/mentor.

Critérios de aceite:
- Cada rota renderiza um único produto.
- Nenhum card/ação de produto cruzado.

## Fase P2 — Auth e contexto multi-tenant
### Tarefa P2.1 — Modelar `solo_creator` no roteamento central de auth
Arquivos:
- `apps/auth/lib/getUserTenants.ts`
- `apps/auth/lib/resolveTenantRoute.ts`

Ações:
- Incluir `solo_creator` no tipo de tenant do auth.
- Rotear `solo_creator` para destino canônico solo sem passar por rota de center.

Critérios de aceite:
- Login com contexto `solo_creator` não cai em dashboard/admin de center.

### Tarefa P2.2 — Rever escolha de contexto preferido no app formacao
Arquivos:
- `apps/formacao/lib/session-context.ts`

Ações:
- Evitar “preferência cega” por `formacao`.
- Selecionar contexto conforme cookie/tenant ativo; fallback determinístico.

Critérios de aceite:
- Sessão multi-contexto mantém produto correto em navegação e redirects.

## Testes obrigatórios (não-mistura)
### Unit
- motor de navegação por produto
- matriz de acesso middleware (`product_mismatch`, `role_mismatch`)
- resolveTenantRoute com `solo_creator`

### Integração
- login + redirect para cada combinação:
  - `formacao_admin`
  - `formacao_secretaria`
  - `formacao_financeiro`
  - `formador` (solo)
  - `formando`

### E2E
- sidebar de center não mostra itens de solo
- sidebar de solo não mostra itens de center
- tentativa de rota cruzada retorna `/forbidden` com motivo correto em log

## Critérios de fechamento
- Zero itens de produto cruzado no sidebar por perfil.
- Zero rendering cruzado em dashboards.
- Zero acesso cross-produto permitido pelo middleware.
- Redirect pós-login consistente por `tenant_type + role`.
- Relatório final de validação sem regressões.

## Sequência recomendada
1. P0.1
2. P0.2
3. P1.1
4. P1.2
5. P2.1
6. P2.2
7. testes unit/integration/e2e



Observações importantes.


. A Bomba-Relógio do Papel "Mentor" (Ameaça ao P1.1)
O Problema: No Solo Creator, o MENTOR é o "Deus" (o equivalente ao Admin). Num Centro de Formação, o MENTOR (Formador) é um funcionário restrito que só pode ver as suas próprias turmas. Se na base de dados (perfis_usuarios) a role for exatamente a mesma string ('MENTOR') para ambos os casos, o teu Middleware vai ter um trabalho infernal para não se confundir.

A Minha Decisão/Sugestão: Não tentes resolver isto com if (tenant === 'solo' && role === 'MENTOR'). Isso é código esparguete. Temos de criar um abismo semântico. A role do Solo Creator devia ser SOLO_ADMIN ou CREATOR. Deixa a role MENTOR ou FORMADOR apenas para o peão do Centro de Formação. Concordas em mudarmos a nomenclatura da role no DB?

2. O Gargalo de Latência no Middleware (Ameaça ao P0.1)
O Problema: O Middleware do Next.js corre no Edge (Vercel). Se a cada clique o teu middleware tiver de ir ao Supabase fazer um SELECT tenant_type FROM escolas para saber se bloqueia a rota ou não, a tua aplicação vai ficar lenta.

A Minha Decisão/Sugestão: O tenant_type (CENTER ou SOLO_CREATOR) e o role têm de estar injetados diretamente nos JWT Claims (no cookie de sessão) no exato momento do Login (Fase P2.1). Assim, o Middleware lê o cookie instantaneamente sem bater no banco de dados, bloqueando a mistura de produtos em 0 milissegundos.

3. A Armadilha do Multi-Contexto (Ameaça ao P2.2)
O Problema: Estás a prever que o session-context evite a "preferência cega" por formacao. Mas imagina a realidade: O David (com o e-mail david@klasse.ao) é o Administrador da Moxi Academy (CENTER), mas também decidiu criar a sua própria mentoria ao fim de semana (SOLO_CREATOR). Ele faz login. Para onde é que o sistema o atira?

A Minha Decisão/Sugestão: Se a query de login detetar que o mesmo e-mail está associado a múltiplos tenants, o redirecionamento pós-login não pode ser automático. Ele tem de cair numa página /select-tenant (Ecrã de Seleção de Workspace, estilo Notion ou Slack) para ele clicar se quer entrar como Moxi Academy ou como David Chocali.
