# Relatório de Refatoração — Navegação dos Portais (Sidebar)

## Contexto
No portal do admin, ao clicar em alguns menus, a navegação troca de segmento (ex.: `/escola/[id]/admin/*` para `/admin/*`). Isso desmonta o layout atual e faz o sidebar “recarregar”, dando a impressão de refresh completo.

## Objetivo
Eliminar o remount do layout nas rotas do portal do admin (e reduzir o risco de ocorrer nos demais portais) sem alterar autenticação, guards, breadcrumbs ou a separação entre sidebars por role.

## Estratégia aplicada (Fases 1–4 — unificação parcial)
Criar um route group compartilhado para portais da escola e mover segmentos de forma incremental.

### Mudanças aplicadas
1. **Criar layout compartilhado** em `/escola/[id]/(portal)/layout.tsx` com `AppShell` + `requireSchoolActive`.
2. **Mover rotas do admin** para `/escola/[id]/(portal)/admin`.
3. **Mover rotas de horários** para `/escola/[id]/(portal)/horarios`.
4. **Mover rotas da secretaria** para `/escola/[id]/(portal)/secretaria` mantendo o guard.
5. **Mover rotas de professores** para `/escola/[id]/(portal)/professores`.
6. **Atualizar imports internos** que referenciam `/escola/[id]/admin` ou `/escola/[id]/professores`.
7. **Ajustar imports relativos quebrados** após o move (páginas `admin/calendario/novo`, `admin/funcionarios` e `admin/configuracoes/estrutura`).
8. **Mover demais segmentos da escola** para o route group `(portal)` (alunos, avaliações, biblioteca, dashboard, eventos, financeiro, funcionários, rotina, turmas).
9. **Atualizar imports** que apontavam para estes segmentos.
10. **Corrigir paths relativos** pós-move em `admin/calendario/novo` e `admin/funcionarios`.

### Por que é segura
- **URLs não mudam**: route group não altera paths, então breadcrumbs continuam intactos.
- **Guards preservados**: `requireSchoolActive` agora está no layout compartilhado.
- **Sidebars por role intactos**: o `AppShell` segue sendo o mesmo.
- **Risco limitado**: só dois segmentos sem guards adicionais.

## Escopo aplicado
- Segmentos unificados: `admin`, `horarios`, `secretaria`, `professores`, `alunos`, `avaliacoes`, `biblioteca`, `dashboard`, `eventos`, `financeiro`, `funcionarios`, `rotina`, `turmas`.

### Arquivos envolvidos
- `apps/web/src/app/escola/[id]/(portal)/layout.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/**`
- `apps/web/src/app/escola/[id]/(portal)/horarios/**`
- `apps/web/src/app/escola/[id]/(portal)/secretaria/**`
- `apps/web/src/app/escola/[id]/(portal)/professores/**`
- `apps/web/src/app/escola/[id]/(portal)/alunos/**`
- `apps/web/src/app/escola/[id]/(portal)/avaliacoes/**`
- `apps/web/src/app/escola/[id]/(portal)/biblioteca/**`
- `apps/web/src/app/escola/[id]/(portal)/dashboard/**`
- `apps/web/src/app/escola/[id]/(portal)/eventos/**`
- `apps/web/src/app/escola/[id]/(portal)/financeiro/**`
- `apps/web/src/app/escola/[id]/(portal)/funcionarios/**`
- `apps/web/src/app/escola/[id]/(portal)/rotina/**`
- `apps/web/src/app/escola/[id]/(portal)/turmas/**`
- `apps/web/src/components/escola/settings/SettingsHub.tsx`
- `apps/web/src/components/layout/escola-admin/QuickActionsSection.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/calendario/novo/page.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/estrutura/page.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/funcionarios/page.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/funcionarios/novo/page.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/mensalidades/page.tsx`
- `apps/web/src/app/financeiro/configuracoes/precos/page.tsx`
 - `apps/web/src/app/escola/[id]/(portal)/admin/calendario/novo/page.tsx`

## Riscos e mitigação
- **Risco:** imports internos ainda apontarem para o caminho antigo.
  - **Mitigação:** atualizar imports e validar build.
- **Risco:** algum layout dependia do `requireSchoolActive` local.
  - **Mitigação:** `requireSchoolActive` foi movido para o layout compartilhado.

## Passos de validação
1. Entrar no portal admin em `/escola/[id]/admin`.
2. Navegar entre `/admin`, `/horarios`, `/secretaria`, `/professores` e confirmar que o sidebar não remonta.
3. Validar que páginas dos segmentos unificados continuam funcionais.

## Próximos passos (Fase 5 — concluída)
1. Revisão de paths relativos pós-move concluída.
2. `typecheck` validado após ajustes.
