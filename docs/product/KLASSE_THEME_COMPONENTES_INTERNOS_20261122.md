# KLASSE — Theme Switcher: auditoria de componentes internos (22/11/2026)

**Branch:** `fix/theme-internal-components-20261122`; **base para integração:** `fix/theme-p0-operacoes-escola-secretaria-20261122` (PR #447), ainda não integrada na `main`.

## Diagnóstico

A auditoria percorreu os componentes internos operacionais, em vez de contar apenas os ficheiros `page.tsx`. Nas nove áreas prioritárias foram catalogados 234 ficheiros TSX, 106 já alterados nas PRs #446/#447 e 112 selecionados para inspeção individual depois de retirar ficheiros de impressão e exemplos. A consulta também se estendeu a primitivas de UI, feedback, autenticação, sessão, Dashboard e Admin Escola.

**Resultado:** 23 ficheiros ainda continham cores neutras fixas em superfícies que devem acompanhar Claro/Escuro/Sistema. Foram migradas cerca de **447 ocorrências** na expressão de auditoria, sem alterar lógica funcional. Ocorrências não significam bugs de interface confirmados: o resultado serve como referência de dívida de código, não como certificado WCAG.

### Componentes corrigidos

| Grupo | Ficheiros |
|---|---:|
| Onboarding académico (seletor curricular, matriz, turnos, cabeçalho, rodapé e logótipo) | 6 |
| Cartões e etiquetas partilhadas | 3 |
| Migração e matrículas em massa | 2 |
| Financeiro: extrato, preços, alerta e reversão | 4 |
| Admin Escola: lista de alunos, filtros, modais, pagamento e seleção em massa | 1 |
| Feedback global | 1 |
| Bloqueio de sessão | 1 |
| Skeletons do Dashboard | 2 |
| Autenticação, estado de configuração e sidebar partilhada | 3 |
| **Total** | **23** |

### Escolhas de design

- Superfícies neutras: `bg-card`, `bg-muted`, `border-border`, `text-foreground` e `text-muted-foreground`.
- Skeletons: `bg-muted-foreground/15`, para manter separação do fundo.
- Ações e seleção curricular: `klasse-gold` com texto `klasse-gold-900`; verde institucional para identidade e estados escolares.
- Alertas, taxas, estados críticos e reversão financeira mantêm semântica amber/rose/emerald, com variantes `dark:*` para contraste.
- O quadro de matrícula no onboarding passa a ter região de scroll acessível ao teclado.
- Os hexadecimais de marca inline no `escola-admin/AlunosListClient.tsx` foram trocados pelos tokens compartilhados.
- Painéis escuros intencionais, transparências dos cabeçalhos de marca e impressões/PDF permanecem fora da substituição mecânica.

### Gates

O teste `apps/web/tests/unit/internal-operational-theme-coverage.spec.mjs` cobre os 23 ficheiros, garante ausência das cores neutras fixas da auditoria e de hexadecimais institucionais diretos, e verifica os contratos visuais de seleção, matriz, financeiro, bloqueio e skeletons. O teste foi integrado em `theme-color-coverage.spec.mjs` e é executado pelo workflow `Theme Switcher Guard`.

**Não modificados:** APIs, Supabase, RLS, RPC, modelos académicos, cálculos financeiros, regras de matrícula, ações de reversão e permissões. **Pendente para release:** CI verde do novo head, integração da PR #447 e reconciliação da PR #446; homologação autenticada de Claro/Escuro/Sistema continua a ser uma etapa distinta dos testes estáticos.

## Exclusões deliberadas

Ficheiros de impressão/recibos e portais aluno/professor deliberadamente light-only. A classe clara na rota de impressão de `AppShell.tsx` permanece intencional. Sidebar escura intencional conserva cores do seu contexto de contraste. O módulo fiscal não faz parte desta PR.
