# KLASSE Calendar Intelligence V0.1 — verificação de prontidão

Data da verificação: 2026-08-04

Escopo: código e migrations presentes no repositório; não confirma o estado da base remota.

## Veredito executivo

**Estamos na direção certa, mas ainda não estamos a entregar o sprint descrito.** O repositório já contém uma fundação de calendário multi-tenant, templates por subsistema, dados 2026/2027, uma vista de “estado de hoje” e alguns usos operacionais. Isso valida a arquitetura geral.

O estado atual é melhor descrito como **calendário operacional com contexto temporal inicial**, não como uma `Calendar Intelligence Layer`. Faltam o workflow de revisão da fonte, o contrato central `/api/academic-context/today`, regras versionadas que combinem calendário e dados reais, tarefas/alertas por perfil, hierarquia de sobreposições e sinais de risco.

**Decisão recomendada:** não ampliar o chatbot nem criar novos widgets antes de estabilizar o modelo temporal e o contrato da API. O caminho crítico é fonte confiável → resolução de calendário efetivo → contexto atual determinístico → regras auditáveis → apresentação por perfil.

## Evidência do que já existe

| Capacidade desejada | Evidência no repositório | Estado |
|---|---|---|
| Eventos escolares multi-tenant | `calendario_eventos` relaciona escola e ano letivo, valida intervalos e tem RLS por tenant | Parcial |
| Perfis por subsistema | Templates aceitam `PRE_ESCOLAR`, `REGULAR_ADULTOS`, `TECNICO_PROFISSIONAL` e `SECUNDARIO_PEDAGOGICO` | Implementado no catálogo |
| Calendário oficial versionado | Template guarda autoridade, referência, URL, versão e estado editorial | Parcial |
| Importação 2026/2027 | Existem seeds separados para regular/adultos e para os outros três subsistemas | Implementado em migrations futuras |
| Aplicação do calendário à escola | API autenticada resolve o tenant, cria ano letivo inativo e copia períodos/eventos | Implementado |
| “Compreender hoje” | `vw_escola_estado_hoje` calcula período, pausa/feriado, evento e fase operacional | Protótipo |
| API de contexto | Existe `GET /api/escola/[id]/admin/estado-hoje`, com `force-dynamic` e resolução de tenant | Protótipo interno |
| Próximos eventos do aluno | Existe API de eventos académicos na home do aluno | Parcial |
| Calendário unificado | Existe `vw_eventos_escola_unificados` para eventos gerais e académicos | Parcial |
| Regra operacional temporal | Há bloqueio de frequência em feriados/pausas e guarda de rematrícula em exames | Parcial e acoplado |

## Mapeamento dos 10 entregáveis propostos

| # | Entregável V0.1 | Estado | Gap para “done” |
|---:|---|---|---|
| 1 | Taxonomia oficial de eventos | **Parcial** | O enum cresceu, mas ainda não cobre avaliação contínua, recurso, publicação de resultados, certificados/diplomas, formação/férias de professores e outros conceitos sem recorrer a `EVENTO_ESCOLA`. |
| 2 | Perfis por subsistema | **Parcial** | Os quatro subsistemas existem no catálogo; falta associar explicitamente o subsistema à escola e resolver de forma determinística qual perfil é aplicável. |
| 3 | Tabelas de calendário e eventos | **Parcial** | Existem templates, itens e eventos por escola. Faltam audiência, escopos, flags pedagógicas, proveniência por item, confiança/revisão e relação de override. |
| 4 | Importação inicial 2026/2027 | **Parcial** | Seeds existem, mas estão datados em 2027 e alguns eventos específicos continuam agregados ou ausentes. Não há evidência neste repositório de aplicação na base remota. |
| 5 | Processo de revisão humana | **Não implementado** | `estado` está no template, não em cada evento extraído; não existe fila, aprovação por revisor, motivo, timestamp ou trilho de auditoria por item. |
| 6 | API de contexto atual | **Protótipo** | A rota atual é administrativa, devolve `{ ok, estado }` e não implementa o contrato `academicYear`, `term`, `phase`, `upcomingEvents`, `requiredActions` e `riskSignals`. |
| 7 | Motor inicial de alertas | **Não implementado** | Há triggers/guards pontuais, mas não há regras declarativas, offsets, execução idempotente, deduplicação, severidade, destinatários ou estado da tarefa. |
| 8 | Widget “Hoje na escola” | **Não demonstrado** | A API interna existe, mas não foi encontrado um widget transversal consumindo o contexto por perfil. |
| 9 | Próximos eventos por perfil | **Parcial** | O aluno possui feed; não há resolução equivalente e uniforme para diretor, professor, secretaria e encarregado. |
| 10 | Base para Data Copilot | **Não implementado** | Não existe contrato/tool estável que limite o Copilot a contexto aprovado, tenant, permissões e evidências da fonte. |

## Bloqueadores técnicos antes do sprint

### 1. Ordem das migrations impede uma instalação limpa

`20260510000009_engine_temporal_cockpit.sql` consulta `public.calendario_eventos`, mas a tabela só é criada por `20270509000000_calendario_eventos_med_686_25.sql`. Num `supabase db reset` cronológico, a vista e a função temporal são avaliadas antes da existência da tabela.

Isto precisa ser corrigido com uma migration nova que reordene/recrie os artefactos de forma segura ou, se estas migrations ainda não foram partilhadas/aplicadas em nenhum ambiente, com consolidação explícita do histórico. **Não editar silenciosamente migrations já aplicadas sem confirmar o ledger remoto.**

### 2. Seeds futuros não provam disponibilidade operacional

As alterações do modelo e os seeds 2026/2027 usam timestamps `20270803...`, posteriores à data desta verificação. Portanto, a presença no Git não prova que perfis ou eventos estejam disponíveis no ambiente piloto. O sprint deve exigir evidência de migration aplicada e contagens por perfil no ambiente alvo.

### 3. Fonte “publicada” está a contornar a revisão humana

Os seeds inserem templates diretamente com `estado = 'PUBLICADO'`. Isso contradiz o risco identificado no PDF: conteúdo extraído com ambiguidades deveria nascer como `EXTRAIDO`/`EM_REVISAO` por item e só tornar-se operacional após aprovação humana. O estado do documento inteiro não resolve inconsistências em linhas individuais.

### 4. O contexto atual não é determinístico o suficiente

A vista usa `LIMIT 1` sem `ORDER BY` para escolher o evento de hoje e também reduz a fase a `EXAMES` ou `REGULAR`. Eventos sobrepostos podem produzir resultados diferentes e uma pausa, matrícula ou conselho não se torna uma fase de primeira classe. Definir precedência explícita é requisito de domínio, não detalhe de UI.

### 5. Aplicar template perde proveniência

A API copia itens para `calendario_eventos`, mas o evento resultante não mantém `template_id`/`source_item_id`, versão da fonte nem estado de revisão. Depois da cópia, não é possível responder com segurança: “esta data veio de qual versão e foi alterada localmente por quem?”. Também não há modelo explícito de exceção que preserve o oficial.

### 6. Ainda não existe “calendário + dados + regras + contexto”

Os bloqueios atuais são condicionais isoladas no banco. O exemplo estratégico — exames próximos + notas incompletas + professores pendentes + frequência em risco — exige snapshots/consultas agregadas, regras versionadas, execução idempotente e saídas auditáveis. Fazer isso diretamente em cada dashboard criaria divergência e custo de escala.

## Arquitetura mínima recomendada

Não é necessário renomear imediatamente as tabelas existentes para inglês. É mais seguro evoluir o modelo atual, preservando compatibilidade.

### Núcleo regulatório

- `calendario_templates`: documento/perfil versionado, autoridade, subsistema, vigência e estado editorial.
- `calendario_template_items`: evento oficial com tipo, audiência, níveis/grades/cursos, flags pedagógicas, página/trecho da fonte e estado de revisão individual.
- `calendario_item_reviews`: decisão humana imutável (`APPROVED`, `REJECTED`, `NEEDS_CLARIFICATION`), revisor, instante e observação.

### Calendário efetivo

- `calendario_eventos`: instância efetiva de escola, com referência opcional ao item oficial.
- `calendar_overrides`: exceção que complementa, substitui ou cancela um evento num escopo provincial/escola/turma/indivíduo sem apagar a origem.
- Resolver precedência por função/RPC única, com ordem explícita e resultado explicável.

### Regras e execução

- `calendar_rules`: tipo de evento, offset, condição versionada, audiência, severidade e ação.
- `calendar_rule_runs`: execução idempotente por `school + rule + event + evaluation_date`.
- `calendar_action_items`: tarefa/alerta materializado, destinatário, evidências, prazo, status e chave de deduplicação.
- Cálculos agregados pesados devem usar views/MVs com refresh concorrente; a API “today” apenas compõe resultados pré-calculados e dados pequenos.

### Contrato de leitura

Criar `GET /api/academic-context/today` com:

- autenticação e `resolveEscolaIdForUser` (nunca confiar apenas num `schoolId` do cliente);
- `dynamic = 'force-dynamic'` e sem cache, porque combina pendências operacionais;
- data de referência opcional apenas para utilizadores autorizados, timezone da escola e semântica clara de intervalos;
- resposta versionada (`schemaVersion`) e explicável (`generatedAt`, `asOfDate`, `sourceProfile`, `evidence`);
- filtragem por papel no servidor; o encarregado não pode receber pendências de outras turmas e o aluno não pode receber indicadores de professores;
- ordenação determinística, paginação/limite para eventos e chaves estáveis de risco/ação.

## Sequência proposta para o sprint

### P0 — tornar a fundação confiável

1. Validar o ledger remoto e corrigir a dependência cronológica das migrations.
2. Criar testes de reset/migration e invariantes de calendário (intervalos, sobreposição, perfil único vigente e RLS).
3. Expandir proveniência e revisão por item; importar tudo como não aprovado.
4. Fazer revisão humana dos quatro perfis 2026/2027, incluindo todas as ambiguidades do PDF.

### P1 — construir o contexto temporal

5. Implementar resolução do calendário efetivo e precedência de overrides.
6. Evoluir `vw_escola_estado_hoje` para uma função/RPC determinística com timezone e data de referência.
7. Publicar `/api/academic-context/today` com contrato versionado, tenant seguro e testes de autorização.

### P2 — produzir inteligência acionável

8. Implementar apenas três regras iniciais: prova próxima, notas incompletas antes de pauta e reconfirmação com documentos incompletos.
9. Materializar ações idempotentes e auditáveis; não enviar notificações diretamente durante a leitura da API.
10. Criar “Hoje na escola” por perfil e expor o mesmo contrato ao Data Copilot como ferramenta read-only.

## Critérios de aceite objetivos

- `supabase db reset` executa do zero sem dependências fora de ordem.
- Os quatro perfis 2026/2027 têm fonte e revisão por item; nenhum item ambíguo está operacional sem aprovação.
- Uma escola tem subsistema e timezone explícitos; o perfil efetivo é resolvido sem heurística textual.
- Overrides locais nunca apagam dados oficiais e sempre preservam autor, motivo e histórico.
- A mesma data e os mesmos dados geram a mesma resposta, com ordenação e precedência determinísticas.
- `/api/academic-context/today` passa testes de tenant cruzado e de visibilidade por papel.
- As três regras P2 não duplicam tarefas quando reexecutadas.
- Cada `requiredAction` e `riskSignal` aponta para evidências consultáveis, não para texto inventado por IA.
- O Copilot apenas explica fatos aprovados e respeita exatamente a autorização do utilizador.

## Conclusão

A visão está correta e o repositório já antecipou partes relevantes dela. A suposição que precisa ser rejeitada é que “ter templates + seeds + uma view de hoje” equivale a inteligência de calendário. Ainda não equivale.

O próximo sprint deve consolidar confiabilidade e contrato antes de crescer em superfície. Se fizermos isso, o calendário torna-se realmente uma camada do KLASSE Brain; se saltarmos diretamente para alertas e IA, teremos recomendações convincentes em cima de datas não rastreáveis, regras duplicadas e permissões difíceis de provar.
