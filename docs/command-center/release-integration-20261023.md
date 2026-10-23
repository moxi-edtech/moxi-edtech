# Integração do Command Center — 23/10/2026

## Escopo da integração
A branch `integration/command-center-all-20261023` agrega a cadeia de funcionalidades
#234 → #236 → #237 → #238 → #239 → #240 → #241 → #243 → #245 → #246 → #248
→ #250 → #251, os testes da fase D (#249), a auditoria #233, a correção da
pesquisa de professores #231 e a implementação paralela de UX #235
(reconciliada em favor dos contratos mais recentes quando ambos alteravam o mesmo ficheiro).

Esta branch nasce da `main` atual; não replica a `main` antiga da #234.
Os ajustes de densidade da Dashboard (#247) foram preservados. O conflito da
`Topbar.tsx` foi resolvido conservando tanto a largura responsiva
`clamp(230px,27vw,420px)` quanto o Command Center controlado e o retorno ao Balcão.

## Política de escola/polo

- #250 nega consultas amplas do Command Center a papéis sem permissão institucional e fecha acesso direto à RPC de roster.
- #251 introduz um modelo **opt-in** de polos com RLS restritiva. Não são inferidas ou preenchidas associações históricas.
- O modelo de polos NÃO é ativado automaticamente. O acesso anterior por escola mantém-se em sistemas legados sem escola ativada.
- É incorreto afirmar que o KLASSE inteiro é multi-polo seguro apenas pela presença dessas migrations. Views definer, RPCs externas ao Command Center e fluxos de matrícula requerem revisão.

## CI e qualidade exigidas para a integração

Executar sobre o HEAD final desta branch: typecheck, lint de ficheiros em conflito,
todos os testes unitários, build de produção Next.js, PostgreSQL 17 de roster,
CC-003 de duas escolas/dois polos, pesquisa, D integração e fixture de três
atendimentos. Resultados devem ser anexados ao PR de integração.

## Bloqueios de ativação/deploy (não dispensados pelo merge de código)

1. Replay do catálogo real de migrations (CC-001) e homologação GoTrue autenticada.
2. Instalação versionada e segura de RPCs indispensáveis; nunca `db push`
   automático num esquema com histórico divergente.
3. Matrículas, transferências, financeiro e balcão contra uma réplica fiel.
4. Políticas canónicas escola/polo aprovadas e ativação de escolas individualizada.
5. Acessibilidade assistiva manual, p95 comparável e validação funcional autenticada.

**Merge na main é integração de código, não certificação desses itens, nem autorização
para habilitar polos sem diagnóstico do ambiente instalado.**
