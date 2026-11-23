# KLASSE — Cores de tema na Secretaria, Balcão e Gestão Académica

**Data:** 22/11/2026. **Base:** `main` em `1d2daedfb`.
**Âmbito:** 23 ficheiros operacionais da Secretaria/Balcão e Gestão Académica/Configurações; sem alterações nas APIs, RPCs, RLS, dados, pagamentos, impressões ou políticas de acesso.

## Problema e solução

O `ThemeProvider` já disponibiliza Claro/Escuro/Sistema, mas os componentes operacionais ainda usavam `bg-white`, `bg-slate-50`, `text-slate-900`, `border-slate-200` e cores de marca expressas diretamente em hexadecimal. Esses estilos ignoravam os tokens `:root`/`.dark` e podiam criar cartões, modais e formulários claros em interfaces escuras.

Conversão: `bg-card` para cartões e modais, `bg-muted` para superfícies secundárias, `text-foreground` para texto principal, `text-muted-foreground` para texto de suporte, `border-border` para bordas e `ring-ring` para foco neutro. Os skeletons usam `bg-muted-foreground/15` nos placeholders. Classes de marca utilizam `klasse-green`/`klasse-gold` e variantes de contraste `dark:text-klasse-green-300` ou `dark:text-klasse-gold-300`.

Nos componentes de Turmas e Pagamento foram removidos mapas locais de hexadecimais redundantes; estados montados dinamicamente como `bg-[${C.green}]` foram convertidos em classes estáticas do Tailwind (de outra forma a classe não é garantida no build). Botões dourados receberam `text-klasse-gold-900` para contraste sobre `#E3B23C`.

## Cobertura

- **Secretaria/Balcão (12):** TurmasListClient, TurmaDetailClient, BalcaoAtendimento, RematriculaBalcaoModal, RematriculaBalcaoCard, EnrollmentPostActions, TurmaHorarioModal, AcessoPortalManager, AcoesRapidasBalcao, ModalPagamentoRapido, QuickViewTimeline e AlunosSecretariaPage.
- **Gestão Académica/Configurações (11):** página Turmas, página Alunos, SettingsHub, CourseManager, CurriculumBuilder, ConfirmDialog, SchoolCurriculumManager, HorarioWizard, StepSlots, Configurações/Fluxos e AcademicYearSelector.

Os 1.352 + 528 sinais da auditoria inicial eram correspondências brutas, **não** bugs validados; conversões limitadas a superfícies operacionais e atributos de cor. Os tons escuros de blocos editoriais, overlays transparentes e estados de erro/sucesso continuam com aparência intencional. Não forçar cor escura no Portal do Aluno/Professor: a política `LIGHT_ONLY_PORTAL_PATH_PATTERN` permanece inalterada.

## Critérios de aceitação e regressão

1. Troca Claro/Escuro/Sistema mantém fundos, textos, bordas, focus e scroll legíveis nas superfícies acima.
2. Cartões, filtros, modais, horários e estados de rematrícula/pagamento continuam com a mesma lógica e ações.
3. Nenhuma ação do Balcão, matrícula, notas, propinas ou decisões académicas é modificada.
4. `operational-theme-coverage.spec.mjs` impede a reintrodução de superfícies neutras fixas nos 23 ficheiros; o teste faz parte do Theme Switcher Guard.
5. Validar typecheck, testes e CI. Antes do merge, realizar revisão visual autenticada com escola e papel autorizados em ambos os modos e em dispositivos móveis.

### Exclusões justificadas
Impressão/PDF/recibo, emails, gradientes de áreas editoriais, overlays para foco e portais intencionalmente light-only. O padrão de cores institucionais deve continuar associado aos tokens do Design System. Qualquer nova exceção tem de estar documentada.
