# KLASSE — Plano de padronização do design system e das interações

2026-11-21 · Base: auditoria da main após PR #390 · Estado: execução faseada.

## Objetivo
Uma ação igual deve ter a mesma semântica, aparência, feedback e acessibilidade nos portais de Secretaria, Administração, Operações, Financeiro, Aluno e Professor.

## Restrições de produto e segurança
- Não modificar RLS, tenants, autorizações, RPCs, rotas de API, pagamentos ou notas neste ciclo.
- Não remover as variantes de tom legadas de uma vez: manter compatibilidade enquanto consumidores ativos são migrados.
- Preservar URLs, permissão de impressão, envio de formulários e histórico auditável.
- Diferenciar o estado de negócio da label exibida. Nenhum desconhecido vira pago ou em atraso por heurística de cor.
- Preferir componentes partilhados existentes a criar novas implementações.
- Não declarar publicação até confirmar deployment READY e commit ligado ao domínio ativo.

## PR 1: Fundamentos seguros (execução nesta branch)
- Button: o bloqueio efetivo de loading e disabled não pode ser sobrescrito pelo spread de props; aria-busy e link asChild devem refletir bloqueio. Manter contratos, tones e type do consumidor.
- StatusPill: normalizar o status técnico antes de atribuir cor; em_dia e pago são sucesso, vencidos são perigo, desconhecidos neutros. Testar null e formatos alternativos.
- ModalShell: substituir implementação manual por Dialog Radix já existente sem quebrar open, title, description, size, footer e onClose. Acessibilidade, foco, Escape, scroll e proteção contra clique acidental no backdrop.
- Button e Badge: geometria coerente com rounded-xl e rounded-full; foco visível.
- Gates: testes de regressão de estado, tipagem e lint; validação visual em preview dos consumidores críticos.

## PR 2: Identidade, mobile e skeleton
- Auditar o inset útil na área de conteúdo e o padding do shell; aprovar em viewports 320, 375, 390, 768 e 1280 px.
- Espelhar skeleton e conteúdo real em Configurações, Professor e páginas da Secretaria; reduzir layout shift.
- Migrar gradualmente cores antigas moxinexa-teal e fontes fora do design system nas rotas efetivamente ativas, com revisão de contraste e tokens KLASSE.
- Preservar exceções de impressão, calendários e grelhas complexas.
- Gates: screenshots autenticados por papel, acesso por teclado, light/dark e smoke em mobile.

## PR 3: Padrão operacional
- Unificar tabelas, header, densidade, células de ações, scroll horizontal, paginação, filtros e estados vazios/erro/loading.
- Centralizar formatação do Kwanza, datas e ano letivo respeitando timezone e valores date-only sem converter acidentalmente para UTC.
- Adotar FeedbackSystem ou adapter único para notificações e confirmações; migrar window.confirm e sonner de forma gradual por fluxo.
- Reutilizar mensagens claras e a próxima ação nos bloqueios, sem mascarar impedimentos reais.
- Gates: smoke autenticado com perfis Secretaria, Admin, Admin Financeiro, Admin Secretário, Direção, Professor e Aluno.

## Checklist antes de integração
1. CI sem falhas e testes específicos verdes.
2. Loading bloqueia clique mesmo com disabled=false; links Slot expõem aria-disabled.
3. Estados em_dia, pago, atrasado, pendente, desconhecido, null com cor e label coerentes.
4. Modais: Tab, Shift+Tab, Escape, foco restaurado, scroll interno mobile e ações de fecho.
5. Nenhuma alteração SQL/RLS/API no diff.
6. Preview testado nos percursos críticos sem substituir funcionalidades.
7. Merge e deploy separados; verificar commit exato na produção.
