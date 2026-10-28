# Boletim do Aluno — Grelha curricular e notas protegidas

## Problema

A vista anterior era uma longa lista de avaliações por período e, quando o acesso ao boletim estava bloqueado, escondia também as disciplinas. O aluno não reconhecia o seu boletim como uma grelha escolar nem conseguia antecipar a estrutura das avaliações.

## Proposta implementada

- **Grelha responsiva:** linhas de disciplinas reais e colunas de trimestre (1.º, 2.º e 3.º são placeholders editoriais; os demais períodos só aparecem quando o servidor devolve avaliações nesse período). Não se fabricam notas, médias, classificações anuais, estados de lançamento ou horários.
- **Acesso protegido:** a API `/api/aluno/disciplinas` devolve apenas a lista curricular autorizada por matrícula, escola, aluno e ano letivo. A API `/api/aluno/boletim` continua a devolver `disciplinas: []` quando `checkBoletimAccess` nega a liberação. Nenhuma pontuação é guardada nos placeholders, sequer de forma desfocada.
- **Exibir / Ocultar:** o utilizador pode ocultar as notas liberadas no próprio ecrã, sem mudar a autorização. Antes da liberação, o botão está indisponível e diz claramente porquê.
- **Detalhes por disciplina:** ao expandir, mostra a designação e o valor efetivo de cada avaliação. Se ainda não houver lançamento, indica ausência de avaliações, em vez de apresentar zero.
- **Imprimir / PDF:** disponível apenas quando o boletim é liberado; reutiliza `/api/aluno/boletim/pdf`, com o seu próprio `checkBoletimAccess`. A ação descarrega o PDF para imprimir, sem gerar um PDF de notas bloqueadas no cliente.
- **Reapreciação e melhoria:** ações contextuais no detalhe da disciplina, somente para histórico atual, com os modais Radix e lógica existentes.
- **Segurança ao mudar de matrícula:** o estado das notas usa `loadedScope === bulletinQuery && isLiberado`; a lista curricular usa `curriculumScope === bulletinQuery`. Requisições anteriores são abortadas e componentes não mostram notas do educando anterior.

## Nota de produto

A pré-visualização é uma representação de **campos protegidos**, não uma promessa de que há avaliações já lançadas. O texto de desbloqueio deriva do estado real do pedido ou da configuração da taxa, sem pressão artificial ou cobrança duplicada.

## Homologação

Executar testes de autorização, UI e snapshots responsivos com dados sintéticos para estados liberado, bloqueado, pagamento pendente, rejeitado e sem avaliações. Em produção, verificar em Safari/VoiceOver que a grelha não transborda horizontalmente a 360px, os controlos têm alvo mínimo de 44px e a impressão apenas é acessível após autenticação e pagamento efetivamente liberados.

Não altera tabelas Supabase, políticas RLS ou regras de pagamento. O merge e o deploy exigem CI e validação dos comportamentos de acesso.
