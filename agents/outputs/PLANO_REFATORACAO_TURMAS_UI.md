# Plano de Refatoração — Exibição de Turmas (UI)

## Objetivo
Renderizar um nome de turma mais humano na UI, mantendo o código original (ex.: `TI-10-M-A` → `Téc. Informática · 10ª · Manhã · Turma A`).

## Escopo
- UI de turmas (cards e tabela) e listas onde o nome é exibido diretamente.
- Transformação apenas na camada de apresentação (sem alterar dados no DB).

## Fora de escopo
- Alterações de schema ou dados no banco.
- Mudanças no contrato de API.
- Renomear arquivos/pastas (refactor estrutural).

## Regras de transformação (proposta)
- `SIGLA` → nome do curso (ex.: `TI` → `Téc. Informática`, `CFB` → `Ciências Fís.Bio.`, `EP` → `Ens. Primário`, `ESG` → `Ens. Sec. Geral`, `TG` → `Téc. Gestão`).
- `ANO` numérico → `ANOª` (ex.: `10` → `10ª`).
- `TURNO` (`M|T|N`) → `Manhã|Tarde|Noite`.
- `LETRA` final → `Turma {LETRA}`.
- Se o padrão não for reconhecido, manter `turma.nome` original.

## Passos
1. Mapear todos os pontos de UI onde `turma.nome` é exibido.
2. Criar helper de formatação (ex.: `formatTurmaNome`) com fallback seguro.
3. Aplicar o helper nos componentes prioritários (lista de turmas).
4. Validar visualmente com exemplos reais e garantir fallback.

## Riscos e mitigação
- **Risco:** padrão de código não padronizado → **Mitigação:** fallback para `turma.nome`.
- **Risco:** siglas novas sem mapeamento → **Mitigação:** exibir sigla original.

## Validação
- Verificar cards e tabela de turmas com exemplos reais do DB.
- Confirmar que nenhum dado do DB foi alterado.
