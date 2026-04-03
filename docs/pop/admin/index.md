# POP/SOP - Portal Admin da Escola

Versao: 1.6.0
Data base: 2026-04-03
Escopo: Usuario final do modulo Admin da Escola

## Objetivo deste pacote

Este pacote documenta os Procedimentos Operacionais Padrao (POP) para o usuario Admin da Escola executar o trabalho diario com seguranca, rastreabilidade e consistencia.

## Documentos deste pacote

## Baseline
- [`_template-pop.md`](/Users/gundja/moxi-edtech/docs/pop/admin/_template-pop.md)
- [`_glossario.md`](/Users/gundja/moxi-edtech/docs/pop/admin/_glossario.md)
- [`_rbac-operacional.md`](/Users/gundja/moxi-edtech/docs/pop/admin/_rbac-operacional.md)

## P0 - Operacao critica
- [`p0-dashboard-admin.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p0-dashboard-admin.md)
- [`p0-alunos-admin.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p0-alunos-admin.md)
- [`p0-turmas-curriculo.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p0-turmas-curriculo.md)
- [`p0-avaliacao-quadro-horario.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p0-avaliacao-quadro-horario.md)

## P1 - Consolidacao operacional
- [`p1-setup-configuracoes.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p1-setup-configuracoes.md)
- [`p1-fechamento-periodo-pauta-oficial.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p1-fechamento-periodo-pauta-oficial.md)
- [`p1-professores-atribuicoes.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p1-professores-atribuicoes.md)

## P2 - Governanca e rastreabilidade
- [`p2-configuracoes-financeiras.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p2-configuracoes-financeiras.md)
- [`p2-mensalidades-emolumentos.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p2-mensalidades-emolumentos.md)
- [`p2-relatorios-auditoria-admin.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p2-relatorios-auditoria-admin.md)

## P3 - Operacoes ampliadas
- [`p3-funcionarios-acessos.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p3-funcionarios-acessos.md)
- [`p3-migracao-matriculas-em-massa.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p3-migracao-matriculas-em-massa.md)
- [`p3-documentos-oficiais-lote.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p3-documentos-oficiais-lote.md)
- [`p3-operacoes-academicas-monitor.md`](/Users/gundja/moxi-edtech/docs/pop/admin/p3-operacoes-academicas-monitor.md)

## Governanca do pacote
- [`CHANGELOG.md`](/Users/gundja/moxi-edtech/docs/pop/admin/CHANGELOG.md)
- [`controle-revisoes.md`](/Users/gundja/moxi-edtech/docs/pop/admin/controle-revisoes.md)
- [`matriz-sop-rota-endpoint.md`](/Users/gundja/moxi-edtech/docs/pop/admin/matriz-sop-rota-endpoint.md)

## Ordem recomendada de leitura e execucao
1. `_rbac-operacional.md`
2. `p0-dashboard-admin.md`
3. `p0-alunos-admin.md`
4. `p0-turmas-curriculo.md`
5. `p0-avaliacao-quadro-horario.md`
6. `p1-setup-configuracoes.md`
7. `p1-fechamento-periodo-pauta-oficial.md`
8. `p1-professores-atribuicoes.md`
9. `p2-configuracoes-financeiras.md`
10. `p2-mensalidades-emolumentos.md`
11. `p2-relatorios-auditoria-admin.md`
12. `p3-funcionarios-acessos.md`
13. `p3-migracao-matriculas-em-massa.md`
14. `p3-documentos-oficiais-lote.md`
15. `p3-operacoes-academicas-monitor.md`
16. `matriz-sop-rota-endpoint.md`
17. `controle-revisoes.md`

## Convencoes de uso
- Cada POP deve ser executado exatamente na ordem dos passos.
- Onde houver campos obrigatorios, o operador deve validar antes de confirmar a acao.
- Acoes destrutivas exigem dupla confirmacao operacional (operador + aprovador interno).
- Erros recorrentes devem ser registados para melhoria continua do POP.

## Controle de revisao

- Proxima revisao planejada: 2026-04-17
- Gatilhos de revisao antecipada:
  - mudanca de fluxo em tela admin
  - mudanca de permissao de perfil
  - mudanca em rotinas de alunos, turmas, curriculo, setup ou fechamento
