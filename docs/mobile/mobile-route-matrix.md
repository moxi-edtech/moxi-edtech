# Mobile route matrix - rotas reais

Data: 2026-07-11
Base auditada: `/Users/gundja/moxi-edtech/apps/web/src/app`

## Aluno

| Modulo | Rota standalone | Rota school-scoped | API principal | Status mobile |
| --- | --- | --- | --- | --- |
| Entrada | `/aluno` | `/escola/[id]/aluno` | n/a | Existe, precisa escolher canonica |
| Dashboard | `/aluno/dashboard` | `/escola/[id]/aluno/dashboard` | `/api/aluno/dashboard`, `/api/aluno/home/status`, `/api/aluno/home/finance-alert`, `/api/aluno/home/recent-grades`, `/api/aluno/home/academic-events` | Pronto para PWA, offline parcial via SW |
| Academico | `/aluno/academico` | `/escola/[id]/aluno/academico` | `/api/aluno/boletim`, `/api/aluno/disciplinas` | Pronto para leitura, offline parcial |
| Avisos | `/aluno/avisos` | `/escola/[id]/aluno/avisos` | `/api/aluno/avisos`, `/api/aluno/avisos/[id]/lido` | Leitura pronta; marcacao lido sem fila offline |
| Disciplinas | `/aluno/disciplinas` | `/escola/[id]/aluno/disciplinas` | `/api/aluno/disciplinas`, `/api/aluno/disciplinas/[disciplinaId]/notas` | Pronto para leitura |
| Documentos | `/aluno/documentos` | `/escola/[id]/aluno/documentos` | `/api/aluno/documentos/catalogo`, `/api/aluno/documentos/solicitar`, `/api/aluno/documentos/emitir`, `/api/aluno/documentos/comprovativo` | Escritas/uploads sem fila offline |
| Financeiro | `/aluno/financeiro` | `/escola/[id]/aluno/financeiro` | `/api/aluno/financeiro`, `/api/aluno/financeiro/comprovativo` | Leitura pronta; upload sem fila offline |
| Horario | `/aluno/horario` | `/escola/[id]/aluno/horario` | `/api/aluno/horario` | Pronto para leitura; bom candidato a snapshot offline |
| Identidade | `/aluno/identidade` | `/escola/[id]/aluno/identidade` | `/api/aluno/perfil/identidade` | Pronto para leitura |
| Perfil | `/aluno/perfil` | `/escola/[id]/aluno/perfil` | `/api/aluno/perfil/dados`, `/api/aluno/perfil/senha` | Escritas sem fila offline |
| Bloqueio | `/aluno/desabilitado` | `/escola/[id]/aluno/desabilitado` | n/a | Existe |

## Professor

| Modulo | Rota standalone | Rota school-scoped | API principal | Status mobile |
| --- | --- | --- | --- | --- |
| Inicio | `/professor` | `/escola/[id]/professor` | `/api/professor/atribuicoes`, `/api/professor/agenda`, `/api/professor/dashboard/pendencias`, `/api/professor/dashboard/overview` | Existe; offline de leitura nao coberto pelo SW |
| Calendario | `/professor/calendario` | `/escola/[id]/professor/calendario` | `/api/professor/calendario` | Existe; offline nao coberto |
| Fluxos | `/professor/fluxos` | `/escola/[id]/professor/fluxos` | Verificar acoplamentos internos | Existe |
| Frequencias | `/professor/frequencias` | `/escola/[id]/professor/frequencias` | `/api/professor/atribuicoes`, `/api/professor/turmas/[id]/alunos`, `/api/professor/presencas` | Escrita offline parcial |
| Materiais | `/professor/materiais` | `/escola/[id]/professor/materiais` | `/api/professor/materiais`, `/api/escolas/[escolaId]/cursos` | Escrita online; offline nao coberto |
| Notas | `/professor/notas` | `/escola/[id]/professor/notas` | `/api/professor/atribuicoes`, `/api/professor/pauta`, `/api/professor/periodos`, `/api/professor/notas` | Escrita offline parcial |
| Perfil | `/professor/perfil` | `/escola/[id]/professor/perfil` | `/api/professor/profile` | Existe; offline nao coberto |

## APIs reais

### Aluno

- `/api/aluno/avisos`
- `/api/aluno/avisos/[id]/lido`
- `/api/aluno/boletim`
- `/api/aluno/boletim/pdf`
- `/api/aluno/dashboard`
- `/api/aluno/disciplinas`
- `/api/aluno/disciplinas/[disciplinaId]/notas`
- `/api/aluno/documentos/catalogo`
- `/api/aluno/documentos/comprovativo`
- `/api/aluno/documentos/emitir`
- `/api/aluno/documentos/solicitar`
- `/api/aluno/financeiro`
- `/api/aluno/financeiro/comprovativo`
- `/api/aluno/home/academic-events`
- `/api/aluno/home/finance-alert`
- `/api/aluno/home/recent-grades`
- `/api/aluno/home/status`
- `/api/aluno/horario`
- `/api/aluno/perfil/dados`
- `/api/aluno/perfil/identidade`
- `/api/aluno/perfil/senha`
- `/api/aluno/push/subscribe`
- `/api/aluno/rematricula/confirmar`
- `/api/aluno/rematricula/status`

### Professor

- `/api/professor/agenda`
- `/api/professor/atribuicoes`
- `/api/professor/calendario`
- `/api/professor/dashboard/overview`
- `/api/professor/dashboard/pendencias`
- `/api/professor/materiais`
- `/api/professor/notas`
- `/api/professor/pauta`
- `/api/professor/periodos`
- `/api/professor/presencas`
- `/api/professor/profile`
- `/api/professor/turmas/[id]/alunos`

## Decisao aprovada

A duplicacao de rotas standalone e school-scoped sera tratada sem refatoracao completa.

- Entrada mobile canonica do Aluno: `/aluno/*`.
- Entrada mobile canonica do Professor: `/professor/*`.
- Rotas `/escola/[id]/aluno/*` e `/escola/[id]/professor/*` continuam existindo para contexto escolar, compatibilidade e redirecionamento.
- O app mobile deve preferir links standalone e preservar `studentId`/contexto necessario via query/session, sem forcar navegacao para outro layout.
- Antes do Capacitor, validar que todos os atalhos, notificacoes e deep links abrem nas rotas canonicas.
