# Sprint — Publicação académica operacional

**Data:** 2026-08-14  
**Duração assumida:** 5 dias úteis  
**Escopo:** curso → currículo → turmas → professores → horário → portais

**Estado atual:** P0 concluído · Sprint 2 em homologação

**Nota atual:** 8/10 em fricção, navegação e preservação de contexto

### Atualização — linguagem única entre portais (2026-08-17)

Concluído no commit `db2fb9586` o alinhamento visual compartilhado entre Secretaria, Admin e Operações:

- cards, espaçamento, bordas e estados seguem a mesma gramática KLASSE;
- ações rápidas, avisos e feedback usam os mesmos padrões de apresentação;
- estados académicos e financeiros usam cores semânticas consistentes;
- diferenças de portal ficaram restritas a permissões, destinos e módulos próprios.

Este item reduz a fricção cognitiva, mas não encerra a homologação ponta a ponta de rotas, 404, mobile ou sessão expirada.

## Sprint 2 — Graciosidade, fricção e contexto

**Objetivo do sprint:** elevar o fluxo de publicação académica de **7,5/10 para 9/10** em fricção, quantidade de cliques, navegação e preservação de contexto.

### Resultado de produto

O responsável pela escola deve conseguir preparar e publicar uma oferta académica seguindo uma sequência única:

```text
Escola → Ano letivo → Cursos → Turmas → Professores → Horários → Revisão → Publicação
```

Em qualquer etapa, o sistema deve mostrar permanentemente:

```text
Escola / Ano letivo / Etapa atual / Pendências / Próxima ação
```

### Metas mensuráveis

| Meta | Critério |
|---|---|
| Navegação | Nenhuma etapa crítica perde escola, ano, curso, turma ou disciplina |
| Cliques | Publicação válida concluída em até 8 ações principais, sem contar preenchimento |
| Fricção | Cada bloqueio apresenta motivo, impacto e próximo passo |
| Recuperação | Refresh, erro de validação ou retry não apaga rascunho nem duplica dados |
| Publicação | Sempre existe revisão explícita antes da publicação oficial |
| Portais | Rotas principais de professor, aluno e escola sem 404 |

### Backlog do Sprint 2

| ID | Prioridade | Entrega | Critério de aceitação |
|---|---|---|---|
| UX-01 | P0 | Barra persistente de contexto | Escola, ano letivo, curso/turma e etapa aparecem durante todo o fluxo |
| UX-02 | P0 | Checklist acionável de prontidão | Cada pendência tem link direto para a correção e indicação de impacto |
| UX-03 | P0 | Tela única de revisão | Mostra turmas, disciplinas, professores, conflitos e bloqueios antes de publicar |
| UX-04 | P0 | Publicação idempotente | Duplo clique/retry não duplica versão, horário, vínculos ou auditoria |
| UX-05 | P1 | Navegação com retorno preservado | Voltar mantém filtros, turma, disciplina, ano e scroll quando aplicável |
| UX-06 | P1 | Rascunho recuperável | Refresh, erro de validação e sessão renovada preservam dados preenchidos |
| UX-07 | P1 | Redução de passos | Ações relacionadas ficam acessíveis a partir do checklist e da revisão |
| UX-08 | P1 | Mensagens de estado | Estados “rascunho”, “pronto”, “bloqueado”, “publicando” e “publicado” são distintos |
| UX-09 | P1 | Validação de portais | Professor, aluno, secretaria e administração usam rotas válidas no contexto da escola |
| UX-10 | P2 | Homologação mobile | Fluxo completo funciona sem hover, tabelas ilegíveis ou botões inacessíveis |
| UX-11 | P1 | Linguagem visual única entre portais | Secretaria, Admin e Operações usam cards, estados, ações e feedback com a mesma gramática |

### Plano de execução

#### Dia 1 — Mapa de contexto e navegação

- Identificar todos os contextos obrigatórios por etapa.
- Definir um componente único de breadcrumb/context bar.
- Garantir que links e retornos preservam query params relevantes.
- Remover caminhos que fazem o utilizador recomeçar a configuração.

**Saída:** mapa de rotas e contrato de contexto aprovado.

#### Dia 2 — Prontidão acionável

- Transformar o painel de prontidão num fluxo de correção.
- Agrupar pendências por bloqueantes, avisos e concluídas.
- Mostrar impacto por turma, disciplina e professor.
- Adicionar “corrigir agora” e “voltar à revisão”.

**Saída:** nenhuma pendência sem ação associada.

#### Dia 3 — Revisão e publicação segura

- Criar revisão final antes da publicação.
- Mostrar conflitos, professores ausentes, cargas divergentes e horários incompletos.
- Separar claramente proposta, rascunho, publicação em curso e publicação concluída.
- Garantir idempotência e confirmação real do resultado.

**Saída:** publicação válida em um fluxo contínuo, sem publicação implícita.

#### Dia 4 — Recuperação e preservação

- Preservar rascunhos durante refresh, retry e erro de validação.
- Evitar perda de filtros e seleções ao voltar de uma tela.
- Confirmar que uma operação repetida não cria duplicação.
- Criar estados vazios com próximo passo.

**Saída:** o utilizador pode interromper e retomar sem reconstruir o contexto.

#### Dia 5 — Homologação ponta a ponta

- Testar escola, secretaria, admin, professor e aluno.
- Testar desktop e mobile.
- Validar troca de ano letivo, turma e disciplina.
- Verificar links, permissões, RLS, 404, sessão expirada e perda de conexão.
- Registar evidências e atualizar a nota do fluxo.

**Saída:** relatório de homologação com evidências e score final.

### Cenários obrigatórios de homologação

1. Publicar um curso novo sem professores vinculados.
2. Corrigir os vínculos e voltar à revisão sem perder o contexto.
3. Gerar proposta de horário e sair da tela.
4. Retomar o rascunho e publicar explicitamente.
5. Clicar duas vezes em publicar e repetir após timeout.
6. Abrir uma ação de turma no portal do professor.
7. Trocar de disciplina durante o horário ativo.
8. Abrir horário e actividades no portal do aluno dentro do contexto da escola.
9. Atualizar a página no meio do preenchimento.
10. Executar o fluxo no mobile.

### Definição de pronto

O Sprint 2 só pode ser encerrado quando:

- o utilizador sabe sempre onde está;
- cada bloqueio explica o motivo e o próximo passo;
- o fluxo não exige reconstruir escola, ano, turma ou disciplina;
- a publicação tem revisão e confirmação real;
- retry é seguro;
- rascunhos sobrevivem a refresh e erros recuperáveis;
- as ações críticas cabem num fluxo de até 8 cliques principais;
- os portais não apresentam 404 nas rotas homologadas;
- o score de fricção, navegação e contexto é igual ou superior a 9/10.

### Estado de execução

| Item | Estado | Evidência |
|---|---|---|
| UX-01 — Contexto persistente | ✅ Concluído | Barra mostra escola, ano, curso e etapa |
| UX-02 — Bloqueios acionáveis | ✅ Concluído | Pendências têm “Corrigir agora” |
| UX-03 — Revisão antes de publicar | ✅ Concluído | Modal mostra impacto e próximo estado |
| UX-04 — Retry idempotente | ✅ Concluído | `Idempotency-Key` reutilizada durante a tentativa |
| UX-05 — Modal contextual de bloqueio | ✅ Concluído | Correções simples não abandonam a revisão |
| UX-06 — Rascunho recuperável | ⏳ Pendente | Falta homologação de refresh, timeout e sessão |
| UX-09 — Portais sem 404 | ⏳ Pendente | Aliases criados; falta validação no browser/implantação |
| UX-10 — Mobile | ⏳ Pendente | Falta homologação em viewport/dispositivo real |
| UX-11 — Linguagem visual única | ✅ Concluído | Commit `db2fb9586`; TypeScript e `git diff --check` passaram |

### Bloqueios de homologação

- Typecheck global: ✅ passou após corrigir fechamentos duplicados no fim de `mensalidades/page.tsx`.
- ESLint direcionado: ✅ sem erros; permanecem 16 warnings de qualidade existentes, principalmente `any` e dependência de hook.
- Ainda falta validar o fluxo completo contra a implantação real, incluindo refresh, timeout, troca de disciplina e mobile.

### Regra de encerramento

Este sprint não deve ser marcado como concluído até que os bloqueios de homologação sejam resolvidos ou formalmente aceitos, e o score alcance pelo menos **9/10**.

## Objetivo

Fazer o fluxo de publicação académica funcionar sem 404, sem estados ocultos e com próximo passo claro para administração, secretaria, professores e alunos.

O sprint segue a regra de Graciosidade do KLASSE: cada estado deve explicar o que aconteceu, o que falta e qual ação pode ser executada em seguida.

## Diagnóstico inicial

Na Escola KLASSE foram identificados os seguintes pontos:

- O ano letivo ativo é 2025; 2026 existe, mas está inativo.
- 2026 possui turmas e disciplinas, mas não possui professores vinculados.
- 2026 não possui matrículas ativas nem horários publicados.
- A tela do quadro de horários não envia `ano_letivo_id`, embora a API o exija.
- A publicação do currículo pode preparar e publicar horários automaticamente.
- Pendências de carga horária são apresentadas como aviso, mas não impedem necessariamente a publicação.

## Critérios de conclusão

O sprint só termina quando:

1. O ano letivo operacional está definido.
2. O currículo pode ser publicado com impacto compreensível.
3. As turmas são geradas sem duplicação.
4. Os professores são vinculados às disciplinas corretas.
5. O quadro é salvo como rascunho e publicado corretamente.
6. Cargas, conflitos e professores ausentes são tratados antes da publicação.
7. Professor e aluno consomem o horário publicado correto.
8. As rotas principais dos portais não retornam 404.
9. As operações importantes têm auditoria e retry seguro.
10. O fluxo funciona em mobile.

## Prioridades

| Prioridade | Entrega |
|---|---|
| P0 | Corrigir `ano_letivo_id` no quadro |
| P0 | Resolver ano letivo ativo da Escola KLASSE |
| P0 | Atribuir professores às disciplinas |
| P0 | Garantir publicação correta do horário |
| P0 | ✅ Painel de prontidão concluído |
| P0 | ✅ Separar proposta e publicação concluído |
| P1 | ⏳ Validar portais e rotas |
| P2 | Melhorias visuais e otimizações |

## Fora do sprint

- Folha salarial completa.
- Integração bancária.
- Reformulação visual total.
- Migração histórica de todos os anos letivos.
- Novos módulos financeiros.

## Resultado esperado

Para cada curso e ano letivo, o sistema deve responder claramente:

> O curso está pronto? As turmas existem? Os professores estão vinculados? O horário está válido e publicado? Os portais conseguem operar?
