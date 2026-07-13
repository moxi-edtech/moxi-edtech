# Mobile security review - KLASSE Mobile V1

Data: 2026-07-11

## Pontos positivos encontrados

- Rotas de aluno usam contexto server-side via `getAlunoContext` em grande parte das APIs.
- APIs de professor consultam usuario autenticado com Supabase server.
- Layout school-scoped de professor valida escola ativa e roles permitidas.
- APIs de notas e presencas exigem `idempotency-key`.
- Operacoes importantes usam RPCs para concentrar logica atomica no banco:
  - `lancar_notas_batch`
  - `upsert_frequencias_batch`
- Service worker ignora requisicoes cross-origin e non-GET no fetch handler.
- Service worker e removido em desenvolvimento para evitar cache enganoso.

## Riscos antes do mobile

| Risco | Evidencia | Impacto | Resolução / Status |
| --- | --- | --- | --- |
| Cache de APIs autenticadas | `sw.js` cacheia GET de `/api/aluno/*` | Dados de aluno podem ficar persistidos no device | **Resolvido:** O Service Worker limpa a cache de dados e o IndexedDB local na ação de logout com timeout de segurança. |
| Professor sem cache controlado | `/api/professor/*` nao entra no data cache | Experiencia professor offline inconsistente | **Resolvido:** Adicionado cacheamento controlado e seletivo apenas para os endpoints chaves de leitura do professor. |
| Fila offline sem criptografia local | IndexedDB guarda body completo | Dados sensiveis podem ficar no dispositivo | **Monitorado:** Payloads enxutos e limpeza completa assegurada do IndexedDB no logout. |
| Idempotencia incompleta | Header e exigido, mas persistencia nao confirmada nas rotas auditadas | Duplicidade em reenvio de notas/presencas | **Resolvido:** O servidor executa validação e lock atômico de idempotência em nível de banco (`idempotency_keys`) para notas/presenças. |
| Conflito nao modelado | `409` apenas interrompe processamento | Professor nao sabe resolver divergencia | **Resolvido:** IndexedDB V2 armazena `conflictData` em caso de erro 409 e cessa tentativas automáticas. |
| Upload offline nao definido | Comprovativos usam upload direto | Falha comum em rede movel | **Online-only:** Mantido restrito online para segurança no V1. |
| Rotas duplicadas | `/aluno/*` e `/escola/[id]/aluno/*`; `/professor/*` e `/escola/[id]/professor/*` | Deep links e sessao podem cair em contexto errado | **Pendente:** Normalização para rotas standalone mobile. |
| Manifesto unico | Manifesto atual e de aluno | App professor herdaria nome/start_url incorretos | **Resolvido:** Manifesto separado em `manifest-aluno.json` e `manifest-professor.json`, injetados condicionalmente nos layouts de portal. |

## Checklist de seguranca para Sprint 0/1

- Confirmar RLS para tabelas lidas por aluno e professor.
- Confirmar que todas as APIs de aluno validam aluno autorizado quando recebem `studentId`.
- Confirmar que APIs de professor validam vinculo do professor com turma/disciplina antes de qualquer leitura/escrita.
- Implementar limpeza de caches e IndexedDB ao logout ou troca de usuario.
- Persistir idempotency keys no servidor para escritas offline.
- Definir TTL para snapshots offline.
- Evitar cache offline para senha, tokens, comprovativos assinados e dados financeiros sensiveis sem regra clara.
- Adicionar telemetria de fila offline: itens pendentes, falhas, conflitos e tempo ate sync.

## Decisao de seguranca

Para V1, recomendo:

- Aluno: permitir leitura offline de dashboard, horario, financeiro resumido, boletim e documentos catalogo; manter senha e uploads online-only ate haver fila de upload dedicada.
- Professor: permitir leitura offline de atribuicoes, turmas, alunos, periodos e pauta; permitir escrita offline apenas para notas e presencas, com idempotencia persistida e conflito explicito.
- **Otimização de Idempotência (Futuro):** Atualmente, o lock distribuído e atômico é controlado na rota da API via restrição de unicidade no banco (placeholder insert/delete). Para futura otimização, recomenda-se mover esse controle de lock diretamente para dentro das funções RPC (`lancar_notas_batch` e `upsert_frequencias_batch`), integrando-o em uma única transação PostgreSQL.

## Decisao aprovada de implementacao

Nao fazer refatoracao completa. O caminho seguro e aplicar mudancas incrementais:

- Camada mobile/PWA primeiro.
- KLASSE Aluno primeiro.
- KLASSE Professor depois.
- Capacitor somente apos validar rotas canonicas, limpeza de cache/logout e offline minimo.
- Qualquer cache local com dados sensiveis deve ter regra clara de expiracao e limpeza.
