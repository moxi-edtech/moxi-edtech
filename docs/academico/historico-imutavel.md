# Histórico Académico Imutável

## Momento exato de congelamento legal

O congelamento legal do histórico acontece **na etapa `GENERATING_HISTORY` do orquestrador de fechamento académico**, imediatamente após a geração/consolidação do histórico anual por matrícula e antes de qualquer nova emissão final.

Implementação técnica:

1. O orquestrador executa `gerar_historico_anual(p_matricula_id)`.
2. Ao concluir essa etapa, o backend deve promover o estado do snapshot para `fechado` via `historico_set_snapshot_state(...)`.
3. O carimbo oficial do congelamento fica em:
   - `historico_snapshot_locks.locked_at`
   - `historico_anos.snapshot_locked_at`
   - `audit_logs.action = HISTORICO_SNAPSHOT_ESTADO_ALTERADO`

A partir desse momento, alterações silenciosas em dados que impactam o histórico final **não são permitidas**.

## Estados oficiais

- `aberto`: histórico em construção/consolidação.
- `fechado`: snapshot legal congelado; emissão de documento final permitida.
- `reaberto`: exceção controlada para retificação, com motivo obrigatório e auditoria.

## Política de reabertura

### Permissões

Somente perfis com função administrativa podem reabrir:
- `admin`
- `admin_escola`
- `staff_admin`

### Motivos válidos (obrigatórios em texto livre auditado)

- erro material comprovado em lançamento de notas/frequências;
- erro de turma/período com impacto documental;
- decisão formal da direção (número de despacho/ata).

### Trilho de auditoria obrigatório

Toda reabertura deve registrar:

- utilizador (`actor_id`)
- matrícula(s) afetada(s)
- ano letivo
- motivo (`motivo` / `reopened_reason`)
- run de fechamento relacionado (`run_id`, quando aplicável)
- timestamps de reabertura e novo fechamento

Eventos de auditoria esperados:
- `HISTORICO_SNAPSHOT_REABERTO`
- `HISTORICO_SNAPSHOT_ESTADO_ALTERADO`

### Impacto em documentos já emitidos

Quando um histórico passa para `reaberto`:

1. documentos finais emitidos com base no snapshot anterior devem ser revistos;
2. suporte/secretaria decide entre revogar e reemitir, conforme norma interna;
3. nova emissão final só deve ocorrer após retorno do estado para `fechado`.

## APIs/RPCs de estado

- RPC: `historico_set_snapshot_state(...)`
- View: `vw_historico_snapshot_status`
- API: `GET/PATCH /api/secretaria/historico/snapshot`

## Regra de bloqueio contra alteração silenciosa

`gerar_historico_anual` falha com `LEGAL_LOCK` quando encontra snapshot `fechado` para a matrícula.

Isso impede recomputações sem reabertura auditada.
