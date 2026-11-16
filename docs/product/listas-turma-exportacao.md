# Listas nominais — decisões de produto (2026-11-16)

Padrão: docs/product/graciosidade.md. PRs empilhadas: P0 histórico → P1 acesso → P1 PDF → P2 lote.

## Modos e estados (P0)
- **Lista do ano letivo (histórica):** considera apenas a sessão académica da turma/classe seleccionada. Inclui activas, concluídas, transferidas e trancadas. A saída (transferida/trancada) é identificada. Exclui pendentes, canceladas e estados desconhecidos, informando as quantidades por motivo.
- **Lista operacional actual:** somente matrículas com estado activo e indicador activo. Exclui as demais, informando quantidades e razões.
- **Incluir todos os estados:** escolha administrativa explícita, preservando o estado individual. Nunca converter transferida/cancelada em activa.
- Sessão não activa: predefinição histórica. Sessão activa: predefinição operacional. O modo, o ano e as contagens são impressos.

## Isolamento e permissões
Manter os mesmos guards de emissão existentes: não alterar RLS, papéis, esquema fiscal, financeiro ou regras de matrícula. A política comum de inclusão só actua sobre dados já restritos ao tenant e à sessão no backend.
As PRs abertas do Command Center (#236–#238) introduzem política própria de exportação auditada no Command Center, com CC-013 por decidir. **Não copiar essa política nem reactivar a rota nova nesta PR**. Convergência por revisão antes do merge; nenhuma alteração aos ficheiros da PR #238.

## Evidência sintética
Fixture com duas matrículas concluídas inactivas que o filtro anterior devolvia vazias, além de estados transferida/trancada/cancelada/pendente. Cobertura unitária de inclusão e reconciliação de totais. Não utilizar dados reais de alunos.

## Próximas PRs
Acção directa com autorização por escola/polo; PDF com número de processo, margens e paginação verificadas; lote idempotente e CSV seguro. Nenhuma migration de dados nesta PR.
