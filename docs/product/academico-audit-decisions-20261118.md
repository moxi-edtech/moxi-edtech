# Contratos de produto — Fluxo académico 18/11/2026

**Estado:** decisões provisórias até validação da Direção. Implementação empilhada em `audit/academico-p1` a `audit/academico-p8`. A alteração de políticas de segurança, motor financeiro ou de estados académicos não está autorizada.

## D1 · Ano letivo
A interface apresenta o intervalo completo `2026/2027`; a identidade dos vínculos é o `ano_letivo_id`. A representação numérica interna do ano mantém-se intacta. Não criar uma condição `ano = 2027` para dados de 2026/2027.

## D2 · Reabertura
A função de autorização existente é a política; não se substitui nem flexibiliza. Para dados sem avaliação explícita, reconciliar o ID da disciplina avaliada a partir da matriz curricular **apenas quando não existe ambiguidade**. O pedido guarda a disciplina curricular de origem para apresentação e a disciplina avaliada para autorização, sem permitir que o cliente escolha o ID autorizado. Emparelhamento por escola, docente, turma, disciplina, trimestre, ano e prazo. A SQL é idempotente e permanece gated.

Um vínculo de avaliação partilhada entre diferentes disciplinas fica em `UNRECONCILED`/revisão de Direção: a política actual não suporta autorizar uma disciplina isolada nesse cenário. Não conceder permissão por aproximação.

## D3 · Equivalências
Detectar nomes equivalentes e apresentar a decisão à Direção; nenhuma fusão ou exclusão automática, nenhum lançamento alterado. O histórico permanece intacto e cada decisão tem autor, data, escola e escopo. Análise de sinonímia não deve unir automaticamente disciplinas curriculares distintas de classes distintas.

## D4 · Horário
Horário é publicado por turma, numa versão oficial. A criação e publicação não dependem de todas as atribuições docentes. Professor e sala não indicados aparecem explicitamente. Atribuições não equivalem a aulas agendadas.

## D5 · Calendário
O trimestre corrente é resolvido pelas datas do calendário oficial no fuso `Africa/Luanda`. Não abrir pautas em massa. O fecho manual, o calendário, a restrição de ano histórico e os overrides legítimos continuam vigentes.

## D6 · Portal do Aluno
`Minhas notas` deve mostrar apenas dados autorizados pelas regras de publicação da escola, sem cobrança pela consulta. `Boletim oficial` e outros documentos pagos mantêm o controlo de pagamento. Uma avaliação incompleta nunca é nota final.

## D7 · Permissões
Professor solicita apenas nas disciplinas atribuídas, consulta apenas os próprios pedidos e não decide. Admin/Direção, admin financeiro e Secretaria/admin secretaria decidem mediante autorização já existente. Aluno não decide. A visibilidade da UI não substitui autorização no Postgres e API.

## D8 · Revogação, validade e feedback
O acesso concedido expira no prazo e pode ser revogado, com auditoria. A decisão deve ser visível sem recarregar o ecrã e desbloquear apenas o escopo aprovado. Não inventar estados novos sem decisão formal.

## Observações de integração
- Não editar as PRs antigas do Command Center; reutilizar a leitura canónica dos exploradores.
- Nenhuma migration deste conjunto será aplicada automaticamente em produção.
- Todos os testes e capturas devem usar dados sintéticos, sem nome de escola, aluno, docente ou registo real.
- **Gates de revisão:** Postgres descartável com políticas RLS reais, Playwright autenticado com contas de teste, CI integral, capturas multi-viewport, prova transaccional do lançamento real e validação de desempenho.
- Divergências de nomenclatura e a política de publicação das notas continuam pendentes de ratificação da Direção.
