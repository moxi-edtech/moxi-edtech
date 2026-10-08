# Workspace / Command Center — auditoria de UX e plano de execução

**Base:** PR #175, derivado de main; padrão: docs/product/graciosidade.md.
**Objetivo:** um aluno por atendimento, várias operações, sem alteração de domínio, autenticação, RLS ou fiscal.

## Fase 1 — diagnóstico (antes de novas alterações)
1. **Shell:** CommandCenterShell acumula identificação, ação e navegação. A página BalcaoPageClient ainda insere ResumoCaixaSecretaria acima do conteúdo; risco de consumir a primeira dobra em 1366×768 e 150% zoom. Os primeiros commits do PR reduziram min-height e margens, mas não existem screenshots verificadas.
2. **Responsividade:** navegação de sete ações tinha scroll horizontal em toda largura. O PR agora permite flex-wrap em ecrãs largos; modais usam dvh. Ainda é necessário medir overflow horizontal, scroll aninhado e foco em todos os 12 pares resolução/zoom.
3. **Contexto:** matrícula é a única ação de criação de novo aluno; ao acioná-la, BalcaoPageClient remove alunoId e limpa estado do aluno. Risco de transição visual ambígua e de URL legada com alunoId+action=enrollment: controlar a apresentação mesmo com deep-link inesperado.
4. **Perfil:** AlunoProfilePanel é edição rápida de informação pessoal. A implementação integral e autorizada é AlunoPerfilPage (server component), que usa resolveEscolaIdForUser, RPC get_aluno_dossier / get_aluno_dossier_contextual e DossierHeader + DossierTabs; inclui perfil, financeiro, histórico, documentos. **Decisão:** prevalece AlunoPerfilPage. Não montar server component num client component nem introduzir segundo endpoint RPC sem análise de papéis/polo. Enquanto não houver uma integração server-rendered protegida comprovada, oferecer ligação contextual à ficha integral é mais seguro que duplicar dados.
5. **Módulos:** Visão geral é painel de prioridade; Rematrícula/Pagamentos/Documentos reutilizam BalcaoAtendimento e writers canónicos; Notas usa PautaRapidaModal; Matrícula reutiliza AdmissaoWizardClient. Não redefinir estados sem necessidade.
6. **Ergonomia:** alinhar cabeçalho da ação, labels e botões; não disfarçar o estado real de pagamentos, confirmação de matrícula ou emissão.

## Decisões de design
- Dimensões fluidas com limites, sem altura mínima artificial para o painel; área útil contabiliza portal, topbar e sidebar.
- Matrícula recebe título de novo atendimento, independente do aluno anterior, e deep links contraditórios devem ser normalizados sem perder parâmetros académicos.
- Preferir leitura completa autorizada na ficha canónica; edição rápida é ação complementar.
- Reduzir cliques sem ocultar bloqueios ou próxima ação; nenhum sucesso otimista substitui backend.
- Não instalar bibliotecas novas.

## Plano de execução com gates
**Fase 2 — Shell:** navegação e área segura; confirmar typecheck/lint e inspeção responsive.
**Fase 3 — coerência:** contexto Matrícula, revisão de Perfil canónico e regressões da navegação.
**Fase 4 — evidência:** typecheck, lint, build, testes de matrícula/rematrícula/pagamento, capturas com dados fictícios em 1366×768, 1440×900, 1536×864 e 1920×1080 a zoom 100/125/150; medir document.scrollWidth > innerWidth e scrolls aninhados.

## Checklist de aceite — nenhum item pode ser assinalado sem execução
- [ ] 1 Overflow horizontal ausente nos 12 perfis
- [ ] 2 Sem scroll aninhado desnecessário
- [ ] 3 Navegação em todos os zooms
- [ ] 4 Contexto do aluno estável em cada módulo
- [ ] 5 Matrícula inicia contexto independente
- [ ] 6 Perfil integral conforme papéis e polo
- [ ] 7 Ações visíveis em portáteis
- [ ] 8 Sem regressões matrícula/rematrícula/pagamentos

## Limites de segurança
Nenhuma migration, RLS, policy, guard fiscal, segredo, fixture com dados reais, deploy ou merge em produção. CI e browser devem comprovar em vez de presumir.
