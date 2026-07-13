# Mobile implementation decision - KLASSE Mobile V1

Data: 2026-07-11

## Decisao

O caminho aprovado e criar o app mobile por evolucao incremental da base Next.js/PWA existente, sem refatorar o codigo completo.

## Direcao tecnica

- Base: Next.js/PWA existente em `apps/web`.
- Primeira entrega: KLASSE Aluno.
- Segunda entrega: KLASSE Professor.
- Capacitor: somente depois de validar PWA mobile, rotas canonicas e offline minimo.
- Refatoracao: apenas cirurgica, limitada a layout mobile, manifesto, rotas canonicas, offline e seguranca.

## Rotas canonicas mobile

- Aluno: `/aluno/*`.
- Professor: `/professor/*`.

As rotas `/escola/[id]/aluno/*` e `/escola/[id]/professor/*` permanecem como compatibilidade/contexto escolar. O app mobile deve preferir sempre as rotas standalone para entrada, atalhos, notificacoes e deep links.

## Sequencia de execucao

1. Fechar contrato de rotas mobile.
2. Ajustar manifesto, assets e layout mobile para Aluno.
3. Fortalecer offline comum.
4. Validar Aluno como PWA em dispositivos reais.
5. Adicionar Capacitor apenas depois da validacao PWA.
6. Repetir o fluxo para Professor, reforcando notas e frequencias.

## O que nao fazer agora

- Nao reescrever em React Native.
- Nao refatorar todos os modulos escolares.
- Nao criar `android`/`ios` antes de estabilizar PWA/offline.
- Nao mudar todas as rotas existentes; usar compatibilidade e redirecionamentos quando necessario.

## Criterios para liberar Capacitor

- Login e logout testados em mobile.
- Logout limpa cache/snapshots sensiveis.
- Aluno abre em `/aluno/dashboard`.
- Deep links e notificacoes abrem rotas canonicas.
- Dashboard, horario e financeiro do aluno funcionam com cache offline.
- Operacoes online-only estao claramente bloqueadas/identificadas quando sem internet.
- Build web esta estavel.
