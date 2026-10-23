# PR 3 — continuidade entre exploradores, pendências e exportação

Esta PR está empilhada sobre #237 → #236 → #234. Sem merge, sem deploy e sem execução de migration em produção.

## Implementado

- Ao navegar de Curso, Professor, Disciplina, Classe ou Turma para outra entidade e regressar, o painel contextual conserva a âncora de scroll por `tipo:id:ano`, sem guardar dados académicos/financeiros.
- A pendência de **excedente de lotação** só aparece se a capacidade está definida e a contagem activa a excede. Fonte: turma.capacidade_maxima e matrículas activas lidas no explorador; destino: módulo existente de turma. Não cria edição duplicada.
- Disciplina sem professor só é reportada com lista de disciplinas não truncada. Isto não substitui verificação de fontes docentes alternativas.
- CSV de alunos com nome, número e turma, neutralização de fórmulas, limite até 200 registos, rodapé com autor/data.
- Configuração server-side isolada por UUID de escola e perfil, desactivada na ausência de aprovação; `KLASSE_CC_ROSTER_EXPORT_POLICY_JSON` assume o formato `{"<escola_uuid>":{"enabled":true,"maxRows":50,"roles":["secretaria"]}}`.
- A exportação falha **antes de entregar CSV** se a escrita de auditoria for recusada. A auditoria guarda só actor, escola, tipo/entidade, hora, presença de filtro e número de linhas; não guarda consulta textual ou conteúdo.
- A saída CSV não inclui BI, contactos, moradas, responsáveis, notas ou quantias.

## Pergunta de negócio — decisão obrigatória do proprietário

> **Por escola, quais são exactamente os perfis autorizados a exportar listas de alunos, para que finalidade, com que limite de linhas e prazo de retenção da auditoria? Deve a autorização ser distinta para turmas, classes e ano histórico?**

Até resposta explícita: `enabled=false`, em todas as escolas. NÃO preencher a variável de activação.

## Pendências para homologação

- Autenticação funcional e auditoria persistida em Postgres fiel ao real (perfis, duas escolas, polos), todos com identidades de fixture.
- Garantir que a API devolve o ano e a turma correctos após transferência/cancelamento (nunca transformar matrícula aprovada em liquidada).
- Testar acessibilidade e navegação por teclado/scroll em browser real; capturas de 5 dimensões × 3 escalas por cenário.
- Validar que o banco suporta escrita de auditoria pelo utilizador autenticado; se o insert falhar, a operação deve continuar recusada, nunca adoptar service_role para contornar RLS.

Nenhuma alteração no contrato fiscal, motor financeiro, permissões ou RLS existentes.
