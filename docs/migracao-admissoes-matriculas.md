# Migração: Matrículas -> Admissões (SSOT)

## Objetivo
Garantir single source of truth no fluxo de admissão/matrícula, eliminando o legado de `/api/secretaria/matriculas` após migração segura.

## Estado Atual

### Endpoints de Matrículas (ativos)
- `GET /api/secretaria/matriculas/preview-numero`
- `PATCH /api/secretaria/matriculas/[matriculaId]`
- `PUT /api/secretaria/matriculas/[matriculaId]/status`
- `PUT /api/secretaria/matriculas/[matriculaId]/transfer`
- `GET /api/secretaria/matriculas/[matriculaId]/check-transfer`
- `GET /api/secretaria/matriculas/[matriculaId]/frequencia`
- `GET /api/secretaria/matriculas/[matriculaId]/declaracao`

### Endpoints de Admissões (ativos)
- `POST /api/secretaria/admissoes/draft`
- `GET /api/secretaria/admissoes/config`
- `GET /api/secretaria/admissoes/lead`
- `GET /api/secretaria/admissoes/vagas`
- `POST /api/secretaria/admissoes/save_for_later`
- `GET /api/secretaria/admissoes/radar`
- `POST /api/secretaria/admissoes/convert`

### Lacunas de Equivalência
- Nenhum endpoint de `/matriculas` possui equivalente direto em `/admissoes` hoje.
- `POST /admissoes/convert` cobre apenas a conversão de candidatura em matrícula, não a gestão do ciclo de vida da matrícula.
- Existe uso de `/api/secretaria/matriculas` na UI, mas o handler base está apenas como `route.ts.bk`.

## Escopo de Migração

### Regras de domínio sugeridas
- **Admissões** = candidatura + conversão para matrícula.
- **Matrículas** = gestão pós-conversão (status, número, transferências, declarações, frequência).

Se a meta é SSOT com nomenclatura única, definir se “admissoes” vai absorver a gestão pós-conversão ou se “matriculas” fica como fonte única dessa fase.

## Plano de Migração Proposto

### Fase 1 — Normalizar contratos (sem quebra)
1. Definir o destino canônico para a gestão pós-conversão:
   - Opção A: criar `/api/secretaria/admissoes/matriculas/*` com handlers que chamem a lógica atual.
   - Opção B: manter `/matriculas` como domínio pós-conversão e renomear fluxos de UI.
2. Criar aliases explícitos (proxy) caso escolha a Opção A.
3. Atualizar UI para usar o endpoint canônico escolhido.
4. Acompanhar chamadas antigas com `rg` e remover quando zeradas.

### Estado (Opção A)
- Aliases adicionados em `/api/secretaria/admissoes/matriculas/*`.
- Chamadas de API migradas em componentes e documentos.
- Legado `/api/secretaria/matriculas` removido.

### Fase 2 — Deprecar legado
1. Marcar `/api/secretaria/matriculas/*` como deprecated (já parcial).
2. Remover chamadas de `/secretaria/matriculas` na UI.
3. Remover `route.ts.bk` se não for restaurado.

### Fase 3 — Remoção segura
1. Garantir zero referências via `rg` para `/matriculas`.
2. Validar fluxos:
   - criação/convert
   - transferência
   - status
   - declarações
   - frequência
3. Deletar `apps/web/src/app/api/secretaria/matriculas`.

## Critério de “pronto para deletar”
- Nenhuma chamada para `/api/secretaria/matriculas` na UI.
- Todos os fluxos de matrícula operam via endpoint canônico escolhido.
- Registro de testes/QA cobrindo transferências, status e PDFs.
