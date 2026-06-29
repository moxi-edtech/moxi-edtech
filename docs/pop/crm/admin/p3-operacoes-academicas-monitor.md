# POP-P3-04 - Monitor de Operacoes Academicas (Admin)

Versao: 1.2.0
Data: 2026-06-28
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 10-20 minutos por rotina

## 1. Objetivo

Padronizar o monitoramento de jobs academicos (fechamento e lotes de documentos), com filtros e exportacao de evidencias.

## 2. Quando usar

- Acompanhamento diario da operacao academica.
- Investigacao de jobs travados/falhados.
- Preparacao de relatorio operacional para coordenacao.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel: Secretaria
- Escalonamento: Suporte tecnico

## 4. Pre-condicoes

- Acesso a `Admin > Operações Académicas`.
- Perfil vinculado a escola.

## 4.1 Estado fiel ao codigo

Validado contra `apps/web/src/app/secretaria/(portal-secretaria)/operacoes-academicas/page.tsx` e wrapper `apps/web/src/app/escola/[id]/(portal)/admin/operacoes-academicas/page.tsx`.

- A rota Admin e um wrapper que reutiliza a pagina da Secretaria.
- Alem de fechamento e documentos, a tela mostra `SSOT virada`, `Saúde da Virada de Ano (SSOT)`, botao `Executar dry-run`, bloqueadores/alertas e `Receitas de reprocessamento`.
- Os links `Abrir monitor` apontam para `/admin/operacoes-academicas/fechamento-academico?...` e `/admin/operacoes-academicas/documentos-oficiais?...`.
- Exportacoes disponiveis: `Exportar JSON` e `Exportar CSV`.

## 5. Procedimento A - Abrir monitor e definir filtros

1. Entrar em `Operações Académicas`.
2. Definir filtros no topo:
- `Período` (`24h`, `7d`, `30d`)
- `Status` (`Todos`, `Sucesso`, `Falha`, `Em processamento`)
- `Tipo` (`Todos`, `Fechamento`, `Documentos`)
3. Clicar `Aplicar filtros`.
4. Exportar snapshot quando necessario:
- `Exportar JSON`
- `Exportar CSV`

## 6. Procedimento B - Ler indicadores operacionais

1. Validar cards:
- `SSOT virada`
- `Fechamentos em aberto`
- `Lotes em aberto`
- `Falhas recentes`
2. Validar o bloco `Saúde da Virada de Ano (SSOT)`:
- turmas/matriculas sem sessao
- historico anual e snapshot locks
- mensalidades fora da janela ou sem matricula
- curriculos, pautas anuais e snapshots pendentes
3. Priorizar acao quando houver falhas > 0 ou status `BLOCKED` no SSOT.

## 7. Procedimento C - Tratar jobs de fechamento

1. No bloco `Fechamento Académico`, revisar:
- tipo de fechamento
- `run_id` curto
- ultima etapa
- estado
2. Se houver jobs acima de 30 minutos sem conclusao, registrar como incidente.
3. Usar link `Abrir monitor` para detalhe operacional em secretaria.

## 8. Procedimento D - Tratar jobs de documentos em lote

1. No bloco `Documentos Oficiais (Lote)`, revisar:
- tipo de documento/lote
- progresso (`processadas/total`)
- status
2. Se houver jobs acima de 30 minutos sem conclusao, registrar e escalar.
3. Usar `Abrir monitor` para atuar no fluxo de documentos.

## 9. Resultado esperado

- Jobs criticos monitorados no prazo.
- Falhas identificadas e encaminhadas.
- Snapshot exportado para auditoria quando necessario.

## 9A. Procedimento E - Checklist de saude dos endpoints criticos

1. Na rotina diaria, validar com Suporte Tecnico o painel de eventos academicos da escola.
2. Confirmar os 3 tipos obrigatorios de evento operacional no periodo:
- `academico.horario_quadro_post`
- `academico.professor_create`
- `academico.atribuir_professor_turma`
3. Para cada tipo, validar:
- taxa de erro (`payload.status = error`)
- p95 de latencia (`payload.duration_ms`)
- codigos de erro mais frequentes (`payload.error_code`)
4. Se erro > 2% por 15 min, abrir incidente operacional com prioridade alta.
5. Se p95 acima do baseline interno por 30 min, abrir tratativa de performance.
6. Em qualquer incidente, anexar janela de tempo, tipo de evento, `http_status`, `error_code` e escola.

## 9B. Procedimento F - Saude da virada de ano

1. No bloco `Saúde da Virada de Ano (SSOT)`, validar se o status esta `OK`, `WARN` ou `BLOCKED`.
2. Se houver bloqueadores, tratar antes de executar fechamento anual ou virada.
3. Quando necessario, clicar `Executar dry-run`.
4. Usar as acoes exibidas em `CutoverResolveActions` para resolver inconsistencias suportadas pela UI.
5. Registrar metricas criticas e resultado do dry-run.

## 10. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| Tela sem dados | Perfil sem escola vinculada ou filtro restritivo | Revisar vinculo/filtros | Dados esperados nao aparecem |
| Jobs em aberto > 30 min | Fila/processamento degradado | Confirmar estado e abrir monitor especifico | Persistencia apos janela operacional |
| Exportacao inconsistente | Filtros nao aplicados corretamente | Reaplicar filtros e exportar novamente | Divergencia recorrente no output |

## 11. Evidencias obrigatorias

- Captura dos filtros aplicados.
- Captura dos cards e blocos monitorados.
- Arquivo JSON/CSV exportado com timestamp.

## 12. Referencia tecnica (fiel ao codigo)

- Pagina agrega:
- `fechamento_academico_jobs`
- `fechamento_academico_job_steps`
- `pautas_lote_jobs`
- Saude de virada:
- `buildCutoverHealthReport`
- `POST /api/secretaria/operacoes-academicas/virada/dry-run`
- Filtro por periodo:
- `24h`, `7d`, `30d` com recorte por `created_at >= minDate`
- Exportacao:
- `GET /api/secretaria/operacoes-academicas/export?...&format=json|csv`
- Links operacionais:
- `/secretaria/fechamento-academico?...`
- `/secretaria/documentos-oficiais?...`
- Endpoints criticos instrumentados:
- `POST /api/escolas/{id}/horarios/quadro` -> evento `academico.horario_quadro_post`
- `POST /api/escolas/{id}/professores/create` -> evento `academico.professor_create`
- `POST /api/secretaria/turmas/{id}/atribuir-professor` -> evento `academico.atribuir_professor_turma`
- Campos minimos emitidos no payload:
- `status`, `http_status`, `duration_ms` e `error_code` (quando houver falha)

## 13. Revisao e versao

- Ultima revisao: 2026-06-28
- Proxima revisao: 2026-07-12
- Mudancas desta versao: alinhado com wrapper Admin, SSOT/dry-run e secoes reais da tela.
