# POP-P2-03 - Relatorios e Auditoria Operacional (Admin)

Versao: 1.1.0
Data: 2026-06-28
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 10-25 minutos por consulta

## 1. Objetivo

Padronizar a consulta do audit trail do portal para monitorar eventos e investigar ocorrencias. Exportacao CSV/JSON so deve ser usada quando a rota de export existir no codigo.

## 2. Quando usar

- Revisao operacional diaria.
- Investigacao de incidente funcional.
- Preparacao de evidencias para auditoria interna.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel: Secretaria/Financeiro/Coordenacao (conforme evento)
- Escalonamento: Suporte tecnico

## 4. Pre-condicoes

- Acesso a `Admin > Relatorios`.
- Sessao autenticada valida.
- Escola correta selecionada.

## 4.1 Estado fiel ao codigo

- A pagina server-side existe em `apps/web/src/app/escola/[id]/(portal)/admin/relatorios/page.tsx`.
- A consulta real usa `audit_logs` com filtros por escola, portal, periodo e busca por `action/entity`.
- A pagina renderiza links para CSV/JSON, mas nao existe rota `admin/relatorios/export` na worktree validada em 2026-06-28. Portanto, exportacao CSV/JSON esta marcada como `NAO OPERACIONAL NO CODIGO ACTUAL` ate o endpoint ser implementado.

## 5. Procedimento A - Abrir painel de relatorios

1. Entrar em `Admin > Relatórios`.
2. Confirmar exibicao do painel `Relatórios da Secretaria`.
3. Verificar cards de resumo:
- `Eventos`
- `Tipos únicos`
- `Erros`

## 6. Procedimento B - Filtrar consulta

1. Definir periodo em `Período`:
- `1 dia`
- `7 dias`
- `30 dias`
- `90 dias`
2. Usar campo `Buscar acção ou entidade...` quando necessario.
3. Selecionar portal no filtro:
- `Secretaria`
- `Professor`
- `Financeiro`
- `Aluno`
- `Encarregado`
- `Admin`
4. Clicar `Filtrar`.
5. Se necessario, usar `Limpar` para reset de filtros.

## 7. Procedimento C - Analisar eventos

1. Na tabela, revisar colunas:
- `Quando`
- `Acção`
- `Entidade`
- `ID`
- `Detalhes`
2. Expandir `Ver detalhes` nos eventos relevantes para ler payload JSON.
3. Priorizar analise de eventos com erro (acoes contendo `error` ou `fail`).
4. Para alta volumetria, refinar busca antes de concluir analise.

## 8. Procedimento D - Exportar evidencia

NAO OPERACIONAL NO CODIGO ACTUAL.

1. A pagina mostra links `CSV` e `JSON`.
2. Nao ha ficheiro de rota para `/escola/{id}/admin/relatorios/export`.
3. Ate o endpoint existir, use captura da tela filtrada e copie o identificador do evento auditado como evidencia operacional.

## 9. Resultado esperado

- Consulta executada com filtros corretos.
- Eventos relevantes identificados e analisados.
- Evidencias consultadas na tela filtrada. Export CSV/JSON depende de endpoint ainda ausente.

## 10. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| Tela sem eventos | Filtro restritivo ou periodo curto | Ajustar periodo/portal e repetir filtro | Persistir vazio com expectativa de eventos |
| `Erro ao carregar logs. Tente novamente.` | Falha na consulta de `audit_logs` | Recarregar pagina e refazer consulta | Falha recorrente |
| Resultado limitado a 200 eventos | Limite de listagem da pagina | Refinar filtros por periodo/busca/portal | Necessidade de volume maior sem acesso por export |
| Exportacao nao abre | Endpoint `admin/relatorios/export` ausente no codigo actual | Usar captura da tela filtrada como evidencia temporaria | Implementar rota de export ou remover links da UI |

## 11. Evidencias obrigatorias

- Captura dos filtros usados (periodo, busca, portal).
- Captura de evento analisado com `Ver detalhes` expandido.
- Captura da tela filtrada com timestamp e operador.
- Arquivo CSV/JSON apenas quando o endpoint de export existir.

## 12. Referencia tecnica (fiel ao codigo)

- Pagina server-side com `dynamic = "force-dynamic"`.
- Controle de acesso com `resolveEscolaIdForUser` e redirecionamento para login quando invalido.
- Consulta principal:
- tabela `audit_logs`
- filtros por `escola_id`, `portal`, `created_at >= since`
- busca por `action` e `entity` (`ilike`)
- ordenacao desc por `created_at`
- limite de `200` registros por consulta
- Exportacao:
- `NAO OPERACIONAL NO CODIGO ACTUAL`: a pagina aponta para `/escola/{escola}/admin/relatorios/export?format=csv|json&days=...&q=...&portal=...`, mas a rota nao existe na worktree validada.

## 13. Revisao e versao

- Ultima revisao: 2026-06-28
- Proxima revisao: 2026-07-12
- Mudancas desta versao: marcada exportacao CSV/JSON como nao operacional por ausencia de rota no codigo.
