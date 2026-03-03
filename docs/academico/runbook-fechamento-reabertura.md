# Runbook Operacional — Fechamento Académico e Reabertura de Histórico

## Público
- Secretaria
- Suporte

## Fluxo padrão (sem reabertura)

1. Executar sanidade em `/api/secretaria/fechamento-academico/sanidade`.
2. Corrigir pendências críticas (notas/frequências/pauta).
3. Iniciar fechamento em `/api/secretaria/fechamento-academico`.
4. Acompanhar `run_id` até `DONE`.
5. Confirmar snapshots em estado `fechado`.

## Fluxo de reabertura (exceção)

1. Coletar evidência do erro e autorização da direção.
2. Definir matrículas impactadas.
3. Executar:
   - `PATCH /api/secretaria/historico/snapshot`
   - `novo_estado = reaberto`
   - `motivo` obrigatório
4. Reprocessar fechamento (`PATCH /api/secretaria/fechamento-academico`) com `motivo_reabertura`.
5. Refechar snapshots para `fechado` após correção.
6. Revisar documentos finais emitidos anteriormente (revogar/reemitir conforme política interna).

## Checklist de suporte

- [ ] run_id de origem identificado
- [ ] motivo de reabertura registrado
- [ ] usuário com role permitida
- [ ] auditoria criada
- [ ] documentos afetados listados
- [ ] snapshots retornaram a `fechado`

## Incidentes comuns

### Erro `LEGAL_LOCK`

Causa: tentativa de recalcular histórico com snapshot `fechado`.

Ação: solicitar reabertura auditada e repetir processo com motivo.

### Erro de permissão na reabertura

Causa: utilizador sem role administrativa.

Ação: delegar para `admin`, `admin_escola` ou `staff_admin`.
