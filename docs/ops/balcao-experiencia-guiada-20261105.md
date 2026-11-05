# Balcão — experiência guiada de resolução académica

Data: 2026-11-05. Base: `545515797`. Branch: `codex/balcao-resolucao-excecional`.

## Percurso entregue

O atendimento conserva o aluno, a matrícula, a disciplina escolhida e o pagamento. «Resolver operação académica aqui» apresenta a próxima etapa e os dados disponíveis, sem obrigar o operador a procurar outra página.

- **Exames:** sequência abrir sessão → lançar componentes → validar componentes → encerrar/publicar. A sessão, a disciplina e o próximo componente/resultado são selecionados a partir do contexto; o operador informa a nota e confirma cada decisão. Tipo e datas partem do regime e da data atual de Angola. A fundamentação é preservada entre etapas e continua editável. Uma sessão existente é retomada no ponto pendente.
- **Sessão partilhada:** os participantes que impedem a publicação aparecem identificados. «Resolver [participante]» abre o formulário correspondente no próprio painel, já na etapa pendente. O aluno em atendimento permanece visível, os formulários recolhidos conservam os seus valores e os rascunhos continuam protegidos. O operador pode completar o participante e publicar a sessão sem mudar de ficha.
- **Correção de notas:** a exceção de 24 horas mantém o atalho «Corrigir notas agora», com disciplina e trimestre. A autorização continua a ser uma preparação; o resultado deve ser corrigido no formulário canónico e reavaliado. Não se reabre automaticamente uma matrícula ou ano com fecho legal.
- **EJA:** apresenta as avaliações e os totais de frequência por trimestre. Conduz à evidência em falta, ao período por conferir ou a um resultado insuficiente que exige revisão documentada. Permite registar/retificar o resumo oficial de frequência neste painel, com aulas previstas, presenças, documento/ata e fundamento. Contagens existentes são reaproveitadas; dados em falta ficam em branco. A frequência insuficiente continua a bloquear, mesmo depois de guardada.
- **Documentos:** publicação e abertura do PDF no mesmo atendimento; o documento abre em nova aba. A confirmação informa que a publicação abrange toda a turma e preserva a versão anterior.
- **Após guardar:** reavaliação automática, mensagem com o estado real e preservação do pagamento. Uma falha apenas na reavaliação oferece «Verificar rematrícula sem repetir a operação». Uma resposta perdida conserva a chave e o pedido original mesmo após atualizar o contexto, evitando duplicação.

As operações sem aplicação ao regime são retiradas da seleção. A mensagem antiga de encaminhamento obrigatório para a direção foi substituída pela resolução na própria ficha. Enquanto guarda, os campos ficam bloqueados e o foco acompanha a nova etapa ou regressa ao atendimento ao recolher um participante.

## Frequência EJA e auditoria

Migration `20271105003000_balcao_guided_resolution_attendance.sql`, criada inicialmente pelo CLI e ordenada depois das duas migrations pendentes do Balcão. Cria evidências oficiais imutáveis por matrícula/período, com documento, motivo, ator, versão anterior e data. Não reescreve os registos de aula ou resumos fechados; o resolvedor EJA lê a evidência mais recente ou o resumo original quando não houve retificação.

A operação exige papel autorizado, matrícula e ano ativos, trimestre da mesma escola/ano, período já terminado, contagens inteiras válidas e versão contextual ainda atual. O registo, os totais anteriores/novos, o efeito académico e a auditoria são gravados na mesma transação. Uma falha da auditoria desfaz a evidência. Outra escola e um aluno apenas vinculado à escola não obtêm acesso às evidências de terceiros. O resolvedor de serviço existente foi preservado.

O novo lançamento de componente usa a mesma operação transacional e os triggers canónicos de exame: nota máxima, vínculo entre aluno/matrícula/turma/ano/componente, imutabilidade e fecho de sessão continuam no banco. A indicação da próxima etapa é navegação; a autorização e elegibilidade permanecem decisões do servidor.

## Provas executadas

- **148 testes** académicos e de regressão aprovados, incluindo retomada por componente, sessão futura, currículo inválido, componentes de outro participante, sequência EJA e fonte/versão obrigatórias.
- **Integração React → PostgreSQL aprovada:** confirma exceção e atalho de notas; abre exame escrito/oral, lança as duas notas, valida os componentes, deteta outro participante incompleto, resolve-o dentro da mesma ficha e publica; confirma mudança real da elegibilidade. Gera PDF real e confere auditoria. Depois regista avaliação EJA e a frequência dos três trimestres pelos formulários, sem inserir resumos por fora da interface; a elegibilidade só muda depois da conclusão dos dados.
- Na mesma integração, falha de reavaliação é recuperada sem nova escrita; uma resposta perdida depois de gravar frequência é repetida **após atualizar o contexto**, sem duplicar a evidência.
- **PostgreSQL 17 descartável:** `audit_effects.sql` e `guided_effects.sql` aprovados. Verificam idempotência, versão obsoleta, histórico preservado, contagens impossíveis, redução documentada da frequência que volta a bloquear, período futuro, falha deliberada da auditoria com rollback, isolamento de escola, restrição de aluno e resolvedor de serviço.
- **Tipos web aprovados. Lint dos cinco ficheiros de produção alterados aprovado com zero avisos.** Isto não elimina os avisos legados registados pela auditoria anterior noutros ficheiros.
- Workflow do GitHub atualizado para repetir as três migrations, as provas SQL, a integração e os testes de navegação. A execução remota do workflow ainda não foi feita.

## Limite de homologação

As provas usam dados sintéticos, eventos reais dos componentes React em DOM de teste e PostgreSQL real. Autenticação HTTP, transporte Supabase e Storage usam fixtures explícitas; o PDF tem conteúdo sintético. Não foi medida usabilidade com utilizadores reais, nem executada sessão de navegador autenticada no ambiente publicado. O lançamento completo de notas no formulário canónico continua uma validação hospedada pendente; foram verificados o atalho contextual e os guards/efeito académico separadamente.

Nenhum dado de cliente, banco remoto, merge ou deployment foi alterado. A experiência está implementada e verificada localmente; **AUT-006 continua pendente de homologação autenticada**, incluindo pagamento recebido → resolução → rematrícula concluída → recibo e correspondência entre commit e deployment. Ticket ativo: `AUT006-HOSTED` no registo de WARNs. Isto não é um PASS global do repositório.

## Repetição

Usar banco PostgreSQL local vazio, nome `balcao_*`, com `PGURL`:

```sh
psql "$PGURL" -X -v ON_ERROR_STOP=1 -f supabase/ops/tests/balcao_academic_resolution/audit_fixture.sql
psql "$PGURL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20271105002000_balcao_secretaria_actions_audit.sql
psql "$PGURL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20271105003000_balcao_guided_resolution_attendance.sql
psql "$PGURL" -X -v ON_ERROR_STOP=1 -f supabase/ops/tests/balcao_academic_resolution/audit_effects.sql
psql "$PGURL" -X -v ON_ERROR_STOP=1 -f supabase/ops/tests/balcao_academic_resolution/guided_effects.sql
```

Em `apps/web`, com as dependências instaladas e JSDOM 26.1.0 num diretório temporário:

```sh
TEST_JSDOM_MODULE=/caminho/node_modules/jsdom/lib/api.js node --test --import tsx tests/balcao-actions-ui-postgres.integration.ts
node --test --import tsx tests/unit/raa-*.spec.ts tests/unit/balcao-academic-*.spec.ts tests/unit/aut004-paid-academic-dual-axis.spec.ts tests/unit/aut004-aut012-operational-contract.spec.ts
```

Referência de implementação: [permissões e execução de funções Supabase](https://supabase.com/docs/guides/database/functions). A validação de acesso foi conferida em SQL local com os papéis da aplicação.
