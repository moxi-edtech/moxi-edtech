# Relatório de Backlogs — KLASSE

run_timestamp: 2026-02-28T00:00:00Z
contexto: Inventário de gaps para o fluxo "Caminho Feliz" (Fases 1–5)

## Prioridade P0 (bloqueante)

### BL-001 — QR não fecha validação pública ponta a ponta
- **fase:** 5
- **problema:** QR está baseado apenas em `hash_validacao` e não em URL pública completa com identificador público.
- **impacto:** validação por terceiros pode falhar sem contexto adicional.
- **ação proposta:** codificar no QR a URL de verificação pública com identificador e hash de validação.

### BL-002 — Batch de boletim/certificado sem seleção explícita de alunos
- **fase:** 5
- **problema:** fluxo está orientado por turma sem seleção granular por aluno.
- **impacto:** secretaria perde precisão operacional para reemissões e lotes parciais.
- **ação proposta:** habilitar seleção de alunos (1–40) e encaminhar `alunos_ids` no submit.

### BL-003 — GradeEngine de fecho sem filtro oficial completo
- **fase:** 4
- **problema:** cálculo de transição final pode considerar disciplinas fora do filtro oficial (`conta_para_media_med`).
- **impacto:** risco de decisão de aprovação/reprovação inconsistente com regra oficial.
- **ação proposta:** aplicar filtro oficial no cálculo final do GradeEngine/SQL de decisão.

### BL-004 — Vínculo matrícula-financeiro com risco em rematrícula
- **fase:** 2
- **problema:** regra de conflito financeiro ainda pode colidir por aluno/mês/ano sem garantir vínculo por matrícula.
- **impacto:** nova matrícula pode ficar sem títulos financeiros dedicados.
- **ação proposta:** revisar chave de unicidade/conflito para incluir `matricula_id` (ou política equivalente explícita).

## Prioridade P1 (alto impacto)

### BL-005 — Emissão batch sem idempotência forte
- **fase:** 5
- **problema:** reprocessamento pode gerar novas emissões/hashes sem política clara de versão.
- **impacto:** duplicidade documental e reconciliação operacional mais difícil.
- **ação proposta:** definir chave idempotente por aluno/tipo/ano/lote com política de reemissão.

### BL-006 — UX textual ainda centrada em pautas
- **fase:** 5
- **problema:** mensagens da UI não estão totalmente contextualizadas para boletim/certificado.
- **impacto:** ruído operacional para secretaria.
- **ação proposta:** tornar labels/toasts dinâmicos por tipo de documento.

## Prioridade P2 (governança e consistência)

### BL-007 — Lógica de extenso sem contrato único documentado
- **fase:** 5
- **problema:** coexistência de implementação no banco e no app sem SSOT formal versionado.
- **impacto:** risco de divergência futura em casos limite.
- **ação proposta:** documentar contrato único de extenso (preferencialmente no backend para snapshot oficial).

## Ordem recomendada de execução
1. **P0:** BL-001, BL-003, BL-004
2. **P1:** BL-002, BL-005
3. **P2:** BL-006, BL-007

## Resultado
- **status geral:** BACKLOG ABERTO
- **próxima ação sugerida:** converter P0 em issues com owner, esforço e prazo.
