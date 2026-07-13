# Offline operation matrix - KLASSE Mobile V1

Data: 2026-07-11

## Infra atual

| Area | Implementacao atual | Observacao |
| --- | --- | --- |
| Service worker | `apps/web/public/sw.js` | Registrado apenas em producao; em desenvolvimento remove registros e caches. Ajustado com SWR seguro e limpeza. |
| Cache estatico | `STATIC_CACHE = klasse-static-v5` | Cacheia offline.html, manifesto, favicon e icones |
| Cache dados | `DATA_CACHE = klasse-data-v1` | GET de `/api/aluno/*`, `/api/public/*` e `/api/professor/*` selecionados |
| IndexedDB | `klasse-offline`, versao 2 | Stores `snapshots` e `queue` (migrado para V2) |
| Snapshot | `saveSnapshot`, `readSnapshot` | Existe, mas uso encontrado e limitado |
| Fila | `enqueueOfflineAction`, `processOfflineQueue` | Salva url/method/headers/body/type e remove ao sucesso. Gerencia retentativas e erros. |
| Status de rede | `useOfflineStatus` | Usa `navigator.onLine` |
| Sync global | `useOfflineSync` | Processa ao montar e ao evento `online` |

## Lacunas contra o roadmap

| Requisito do roadmap | Estado atual | Status |
| --- | --- | --- |
| `mutationId` | Adicionado à fila e propagado | ✅ Resolvido (V2) |
| `baseVersion` | Adicionado para controle de versão do dado | ✅ Resolvido (V2) |
| `payloadHash` | Adicionado para integridade do payload | ✅ Resolvido (V2) |
| Status da fila | Adicionados `pending`, `syncing`, `failed`, `conflict` | ✅ Resolvido (V2) |
| Retry count | Adicionado com limite de 5 tentativas | ✅ Resolvido (V2) |
| Ultima tentativa | Gravado em `lastAttemptAt` | ✅ Resolvido (V2) |
| Proxima tentativa | Agendado em `nextRetryAt` com Backoff Exponencial | ✅ Resolvido (V2) |
| Erro persistido | Gravado em `lastError` | ✅ Resolvido (V2) |
| Conflict data | Armazenado em `conflictData` a partir de respostas 409 | ✅ Resolvido (V2) |
| Tratamento 409 | 409 marca item como `conflict` e cessa retries automáticos | ✅ Resolvido (V2) |
| Idempotencia servidor | Lock atômico implementado no banco para notas e presenças de professores | ✅ Resolvido (V2) |

## Operacoes reais por perfil

### Aluno

| Operacao | Rota/API | Tipo | Offline atual | Prioridade |
| --- | --- | --- | --- | --- |
| Ver dashboard | `/api/aluno/dashboard`, `/api/aluno/home/*` | Leitura | Cache SW parcial | Alta |
| Ver horario | `/api/aluno/horario` | Leitura | Cache SW parcial | Alta |
| Ver financeiro | `/api/aluno/financeiro` | Leitura | Cache SW parcial | Alta |
| Enviar comprovativo financeiro | `/api/aluno/financeiro/comprovativo` | Upload/escrita | Sem fila offline | Alta |
| Ver boletim | `/api/aluno/boletim` | Leitura | Cache SW parcial | Media |
| Baixar boletim PDF | `/api/aluno/boletim/pdf` | Download | Sem garantia offline | Baixa |
| Ver documentos | `/api/aluno/documentos/catalogo` | Leitura | Cache SW parcial | Media |
| Solicitar documento | `/api/aluno/documentos/solicitar` | Escrita | Sem fila offline | Alta |
| Emitir documento | `/api/aluno/documentos/emitir` | Escrita/geracao | Sem fila offline | Media |
| Enviar comprovativo de servico | `/api/aluno/documentos/comprovativo` | Upload/escrita | Sem fila offline | Media |
| Atualizar perfil | `/api/aluno/perfil/dados` | Escrita | Sem fila offline | Media |
| Mudar senha | `/api/aluno/perfil/senha` | Escrita sensivel | Deve ser online-only | Alta |
| Confirmar rematricula | `/api/aluno/rematricula/confirmar` | Escrita | Sem fila offline | Alta |
| Marcar aviso lido | `/api/aluno/avisos/[id]/lido` | Escrita simples | Sem fila offline | Baixa |

### Professor

| Operacao | Rota/API | Tipo | Offline atual | Prioridade |
| --- | --- | --- | --- | --- |
| Ver atribuicoes | `/api/professor/atribuicoes` | Leitura | Sem cache SW professor | Alta |
| Ver pauta | `/api/professor/pauta` | Leitura | Sem snapshot robusto | Alta |
| Ver alunos por turma | `/api/professor/turmas/[id]/alunos` | Leitura | Sem snapshot robusto | Alta |
| Lancar notas | `/api/professor/notas` | Escrita | Fila offline parcial | Alta |
| Registrar presencas | `/api/professor/presencas` | Escrita | Fila offline parcial | Alta |
| Ver periodos | `/api/professor/periodos` | Leitura | Sem cache SW professor | Alta |
| Ver calendario | `/api/professor/calendario` | Leitura | Sem cache SW professor | Media |
| Gerir materiais | `/api/professor/materiais` | Leitura/escrita | Online | Media |
| Ver perfil | `/api/professor/profile` | Leitura | Online | Baixa |

## Sprint 1 proposto

Decisao aprovada: fortalecer offline antes de criar shell Capacitor/app store. Nao refatorar o dominio inteiro; evoluir a infraestrutura compartilhada e aplicar primeiro nas rotas mobile prioritarias.

1. Migrar IndexedDB para versao 2.
2. Evoluir `OfflineQueueItem`.
3. Criar painel/indicador de fila pendente por perfil.
4. Aplicar snapshots offline para:
   - `/api/professor/atribuicoes`
   - `/api/professor/pauta`
   - `/api/professor/turmas/[id]/alunos`
   - `/api/professor/periodos`
   - `/api/aluno/dashboard`
   - `/api/aluno/horario`
   - `/api/aluno/financeiro`
5. Persistir idempotencia em backend para `/api/professor/notas` e `/api/professor/presencas`.
6. Tratar `409` como conflito com `conflictData`.
7. Definir quais operacoes sensiveis permanecem online-only: senha, downloads assinados, uploads pesados e pagamentos/comprovativos, se nao houver suporte de background upload.
