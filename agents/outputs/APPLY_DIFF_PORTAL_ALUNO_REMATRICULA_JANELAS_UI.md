# Diff aplicado — Gestão de Janelas de Rematrícula

run_id: PORTAL-ALUNO-REM-JANELAS-UI-20260604
status: APPLIED

## Escopo

Criar tela/fluxo para a Secretaria/Admin gerir as janelas de rematrícula online sem SQL manual.

## Alterações

- `apps/web/src/app/api/secretaria/rematricula/janelas/route.ts`
  - `GET`: lista janelas e anos letivos da escola.
  - `POST`: cria janela.
  - `PATCH`: edita ou ativa/desativa janela.
  - `DELETE`: remove janela.
  - Resolve escola com `resolveEscolaIdForUser`.
  - Autoriza staff com `authorizeEscolaAction`.
  - Valida datas, ano letivo e duplicidade de janela ativa.

- `apps/web/src/app/secretaria/(portal-secretaria)/rematricula/janelas/page.tsx`
  - Tela para criar, editar, ativar/desativar e remover janelas.
  - Mostra estado atual: aberta agora, ativa fora do período ou inativa.
  - Usa `cache: no-store` nas leituras.

- `apps/web/src/app/escola/[id]/(portal)/secretaria/(portal-secretaria)/rematricula/janelas/page.tsx`
  - Re-export para a rota canônica dentro de `/escola/[id]`.

- `apps/web/src/app/secretaria/(portal-secretaria)/rematricula/page.tsx`
  - Atalho visível para “Gerir janelas de rematrícula online”.
  - Payload de triagem tipado e normalizado.

- `apps/web/src/lib/sidebarNav.ts`
  - Entrada “Janelas de rematrícula” no submenu de Alunos/Rematrícula.

## Validação

- `pnpm -C apps/web typecheck`: PASS
- `pnpm -C apps/web exec eslint src/app/api/secretaria/rematricula/janelas/route.ts 'src/app/secretaria/(portal-secretaria)/rematricula/janelas/page.tsx' 'src/app/escola/[id]/(portal)/secretaria/(portal-secretaria)/rematricula/janelas/page.tsx' 'src/app/secretaria/(portal-secretaria)/rematricula/page.tsx' src/lib/sidebarNav.ts --max-warnings 10000`: PASS

## Observações

A tabela `public.rematricula_janelas` e a RPC de bloqueio já tinham sido aplicadas no `GAP-REM-003`. Este diff adiciona o fluxo operacional para gerir essas janelas pela interface.
