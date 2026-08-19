# KLASSE — Sprint ponta a ponta do Decreto Executivo 04/2026

**Documento:** Regulamento da Avaliação das Aprendizagens (RAA)
**Fonte:** [Decreto Executivo n.º 04/2026, de 5 de Março](references/Decreto-Executivo-04-2026-RAA.pdf)
**Estado:** Sprints 0–1 aplicadas e validadas; Sprints 2–5 parcialmente implementadas; Sprints 6–7 pendentes
**Product Design (UI/UX):** [PRODUCT_DESIGN_RAA_DECRETO_EXECUTIVO_04_2026.md](/Users/gundja/moxi-edtech/docs/PRODUCT_DESIGN_RAA_DECRETO_EXECUTIVO_04_2026.md)
**Princípio:** o resolvedor académico é a única fonte da verdade. Autores, Admin, Portal do Professor, Portal do Aluno e Cobrança consomem o resolvedor e não reimplementam as regras.

## Assunção da frente — 2026-08-15

Esta frente passa a ser acompanhada como uma entrega ponta a ponta do KLASSE, sob responsabilidade de execução do agente. O próximo marco não é iniciar novas telas: é fechar a fundação académica e provar que todos os consumidores usam o mesmo regime resolvido.

### Ordem de execução

1. Validar e ativar a Sprint 0 em base de desenvolvimento/homologação.
2. Confirmar o contrato para 12.ª classe, Módulo 3 e 2.º ano EJA com dados representativos.
3. Criar a Sprint 1 com migrations, RLS, funções puras e casos de teste.
4. Só depois ligar elegibilidade, fórmulas, pautas e portais ao domínio central.

### Critério de não-regressão

Nenhuma implementação nova desta frente pode introduzir uma decisão local sobre classe de exame, fórmula, elegibilidade, melhoria ou progressão. Qualquer exceção deve ser persistida, auditável e exposta pelo resolvedor.

## Sprint 0 — Fundação: resolvedor académico

**Estado:** aplicada e validada no Supabase em 2026-08-15.

### Entregas

- Migration `supabase/migrations/20260815140000_academic_regime_resolver.sql`.
- Função Postgres `resolve_regime_academico(turma_id)`.
- Wrapper TS `apps/web/src/lib/academico/regime-academico.ts`.
- Campos normalizados em `turmas`: `nivel_ensino`, `ano_numero` e `modulo_numero`.
- Cobertura das cinco classes de exame:
  - 6.ª classe;
  - 9.ª classe;
  - 12.ª classe;
  - Módulo 3 da EJA;
  - 2.º ano da EJA.
- Fórmulas de MFD com pesos `0,6/0,4` e `0,5/0,5`.
- Contrato SQL executável com um caso por classe/nível.
- `is_turma_classe_exame` mantida apenas como adaptador de compatibilidade.
- Cobrança e rematrícula ligadas ao resolvedor.

### Contrato retornado

```ts
{
  eh_classe_exame: boolean,
  codigo_regime: string,
  nivel_ensino: string,
  classe_num: number | null,
  ano_numero: number | null,
  modulo_numero: number | null,
  tipo_exame_nacional: string | null,
  escala: "quantitativa_primario" | "quantitativa_secundario" | "qualitativa",
  formula_mfd: Record<string, unknown>,
  exames_aplicaveis: string[]
}
```

### Validação concluída

- Contrato homologado contra dados reais da escola Klasse e casos representativos de 12.ª classe, Módulo 3 e 2.º ano EJA.
- O typecheck de `apps/web` foi validado após os contratos e a superfície do Portal do Professor; a higiene de whitespace em ficheiros preexistentes permanece fora desta fatia.
- O formulário ainda conserva `is_classe_exame` como override legado; a sua auditoria/remoção fica para a Sprint 7.

## Sprint 1 — Modelo de dados de exames [APLICADA — 2026-08-15]

Migration `supabase/migrations/20260815150000_raa_exam_sessions_model.sql` aplicada e validada no Supabase. As quatro tabelas estão com RLS activo e os triggers de consistência foram criados. Os contratos API iniciais de sessões, resultados e melhoria foram implementados. O Portal do Professor já possui uma superfície contextual para consultar sessões da turma e lançar resultados por componente; os fluxos do Portal do Aluno estão parcialmente implementados na Sprint 5.

Criar:

- `exame_sessoes`: tipo, ano lectivo, turma/classe, datas e estado;
- `exame_componentes`: escrito, oral e prático;
- `exame_resultados`: nota por aluno, disciplina e componente;
- `melhoria_nota_pedidos`: pedido, nota anterior, nota obtida e resultado derivado.

Regras obrigatórias:

- Exame combinado somente como escrita + oral ou oral + prática.
- Recurso e extraordinário substituem a nota anterior.
- Melhoria usa a maior nota.
- Limite de melhoria: até 3 disciplinas/CC no Primário e até 5 no Secundário.
- Melhoria de nota é uma variante de uma sessão de recurso, não uma época autónoma.

## Sprint 2 — Elegibilidade e progressão [FAIL / EM CORREÇÃO — 2026-08-15]

Foi criada a base pura `apps/web/src/lib/academico/raa-eligibility.ts`, com testes unitários para os estados canónicos de aprovação, recurso, reprovação, reprovação por faltas, inscrição condicional e prazo de reapreciação de 48 horas. A migration `20260815170000_raa_result_status_ssot.sql` foi aprovada, aplicada e validada, expondo `resolve_estado_resultado(matricula_id, disciplina_id)` com `positivo`, `cor`, escala e corte; enquanto a MFD de exame não estiver calculada, o contrato devolve `pendente_formula`. A rota de elegibilidade e o Portal do Professor já enviam a disciplina contextual para esse contrato. Foi adicionada a camada pura `apps/web/src/lib/academico/raa-progression.ts`, que transforma os estados disciplinares canónicos numa decisão global de transição, inscrição condicional, recurso, retenção por aproveitamento, faltas, indisciplina, pendência ou conclusão. O helper server-side `raa-progression-server.ts` passou a ser usado pela rota `GET /api/academico/raa/progressao` e pela pré-seleção do balcão em `turmas-simples`, removendo a decisão local antiga de “reprovado vs. promoção”. Se faltar disciplina, estado canónico ou política, o fluxo fica pendente/503 de forma explícita.

Integração transacional aplicada nas RPCs `promover_aluno_pos_pagamento` (com e sem turma explícita), `finalizar_rematricula_balcao` e `rematricula_em_massa`: cada operação consulta o contrato SQL RAA dentro da transação, inclui a decisão no retorno/auditoria e bloqueia estados pendentes ou incompatíveis. O cutover em massa passa a avaliar cada matrícula individualmente.

### Auditoria jurídica de 2026-08-15

O resolvedor genérico acima não era suficiente para o Decreto Executivo 04/2026. Foi criada a camada pura `apps/web/src/lib/academico/raa-decreto-eligibility.ts` e ligada ao caminho real de leitura da progressão em `raa-progression-server.ts`. Ela cobre, com testes derivados dos arts. 23.º, 26.º, 33.º e 34.º:

- regras de transição da 7.ª/8.ª, 10.ª/11.ª e 1.º ano EJA;
- faixas e quantidades de negativas da 6.ª, 9.ª, 12.ª, Módulo 3 e 2.º ano EJA;
- combinações proibidas com Língua Portuguesa, Matemática e disciplinas específicas;
- frequência EJA de 2/3 e limiares de faltas 3/4/5 quando os factos por disciplina estiverem disponíveis;
- bloqueio de efetivação da matrícula condicional e dados incompletos;
- distinção entre Módulo 3 qualitativo e Módulo 3 numérico de recurso.

Estado atual: a API pública de elegibilidade aplica diretamente o resolvedor jurídico; o servidor carrega faltas injustificadas por disciplina/trimestre através dos vínculos de `turma_disciplinas`; e a reapreciação inicia a janela de 48 horas a partir da publicação persistida da pauta, não da criação do pedido. A Sprint 2 permanece **PARTIAL/FAIL** por ainda depender da configuração pedagógica e de validação E2E completa na Escola KLASSE; os três findings de integração RAA-001, RAA-002 e RAA-003 foram corrigidos.

Atualização pós-aplicação: a migration `20260816010000_raa_decreto_sql_ssot.sql` foi aplicada na Escola KLASSE e o wrapper transacional jurídico passou a preceder o fallback genérico. A migration `20260816011000_raa_decreto_pending_without_policy.sql` também foi aplicada: cinco matrículas reais foram testadas e todas retornaram `pendente` com o próximo passo “Configurar a política de progressão e concluir as notas finais da matrícula.”, sem erro 500. A escola ainda precisa configurar a política e concluir os resultados académicos antes de uma decisão de promoção poder ser produzida.

Atualização de auditoria: a migration `20260816013000_raa_reapreciacao_publication_source.sql` foi aprovada e aplicada, adicionando `reapreciacao_pedidos.resultado_publicado_em`. A rota `/api/academico/raa/reapreciacao` usa a publicação mais recente de `pautas_oficiais.generated_at`, rejeita o pedido com estado orientativo `RAA_RESULT_NOT_PUBLISHED` quando ainda não há resultado publicado e persiste a origem temporal no pedido. A consulta de `turma_disciplinas` passou a carregar o `id` do vínculo, permitindo buscar as aulas e faltas da disciplina correta. Typecheck, `git diff --check` e 26 testes jurídicos/progressão passaram.

Backlog bloqueante no backend/persistência:

- persistir inscrição condicional, disciplinas pendentes e prazo de regularização;
- substituir o SQL genérico por um resolvedor jurídico SSOT, usado pelas quatro RPCs transacionais;
- carregar notas finais, classificação de disciplina, carga horária semanal e faltas injustificadas por disciplina/trimestre no contrato SQL;
- fechar a regra de exame extraordinário anual e o bloqueio da matrícula seguinte;
- adicionar casos de integração persistente para 6.ª, 7.ª, 8.ª, 9.ª, 10.ª, 11.ª, 12.ª, EJA Módulo 3 e EJA 2.º ano.
- validar em integração persistente a rota pública, as faltas por disciplina/trimestre e a janela de reapreciação baseada na publicação;
- configurar a política pedagógica da Escola KLASSE e concluir as notas oficiais antes de liberar decisões transacionais de promoção.

Aplicação concluída após aprovação `RAA-SPRINT2-KLASSE-POLICY-20260815`: a Escola KLASSE agora possui `permitir_progressao_com_recurso=true` e `permitir_inscricao_condicional=false`. O smoke test em cinco matrículas reais retornou `decision=pendente` e `motivo=dados_pendentes` em todos os casos; não houve promoção indevida nem erro 500. A pendência restante é a conclusão das notas/factos académicos oficiais para cada matrícula.

A política mínima de escola foi aplicada e validada em `supabase/migrations/20260815220000_raa_progression_policy.sql`. A configuração graciosa foi adicionada ao painel unificado `/admin/configuracoes/avaliacao`: a secretaria/admin vê o estado atual, escolhe progressão com recurso e inscrição condicional, salva no mesmo contexto e recebe feedback de sucesso/erro. Como a Escola Klasse ainda não possui uma linha em `configuracoes_pedagogicas`, a primeira gravação nesse painel cria a política explicitamente; até lá, `GET /api/academico/raa/progressao` recusa decidir com `RAA_PROGRESSION_POLICY_NOT_CONFIGURED`. A migration aprovada `20260815230000_raa_progression_rpc_ssot.sql` criou o contrato SQL `resolve_raa_progression_for_matricula`, e as migrations subsequentes `20260815232000`, `20260815233000`, `20260815235000` e `20260816000000` ligaram as RPCs transacionais ao mesmo contrato.

Os casos puros de transição, inscrição condicional, recurso, retenção, terminalidade e dados incompletos estão cobertos em `apps/web/tests/unit/raa-progression.spec.ts`. Cada integração persistente deverá possuir também um caso de teste com aluno fictício e vínculo de escola/ano letivo.

## Sprint 3 — Fórmulas e pautas [PARCIAL — 2026-08-15]

Foi criada a base pura `apps/web/src/lib/academico/raa-formulas.ts`, com arredondamento único, MAC, MT, MFD de transição, MFD ponderada de exame, MFC e derivação de cor. A pauta anual, o adaptador de pautas e os documentos oficiais já usam o contrato `MAC + NPT`; o Portal do Professor deixou de apresentar ou gravar NPP. Foram adicionados 6 testes de fórmula; com a Sprint 2, a suíte RAA fica com 12 testes verdes. Valores históricos NPP continuam apenas como compatibilidade de leitura na API e não participam da fórmula oficial nova. A migration `20260815180000_raa_exam_mfd_ssot.sql` foi aprovada, aplicada e validada: sessão ausente permanece `pendente_formula`; a função já calcula a MFD quando a sessão e todos os componentes estiverem completos. A geração consolidada de mini-pautas e pautas a partir de views/relatórios ainda é backlog.

Backlog restante: gerar mini-pautas e pautas consolidadas a partir de views/relatórios do sistema. As funções puras, o arredondamento único e as cores derivadas do resultado já estão implementados.

## Sprint 4 — Portal do Professor [IMPLEMENTADA — 2026-08-15]

- Lançamento de MAC e NPT conforme o regime resolvido: concluído na superfície do Professor, com compatibilidade histórica de NPP apenas na API.
- Painel de risco de recurso/exame extraordinário: implementado em `GET /api/academico/raa/riscos` e exibido dentro do contexto turma+disciplina.
- A seleção de um aluno no painel abre a análise RAA contextual, preservando turma, disciplina e ano letivo.
- Eventos estruturados de indisciplina grave: modelo persistido na migration `20260815200000_raa_indisciplina_events.sql`, endpoint `GET/POST /api/academico/raa/indisciplina` e UI `/secretaria/raa/indisciplina` implementados; RLS, contexto do ano letivo e validação da matrícula ativos.
- Fluxo de reapreciação: API e UI contextual implementadas em `/api/academico/raa/reapreciacao`, com motivo, idempotência, protocolo e prazo de 48 horas. A migration `20260815190000_raa_reapreciacao_pedidos.sql` foi aplicada e validada com RLS e índices únicos.

Entregue neste corte:

- fila da secretaria implementada em `/secretaria/raa/reapreciacoes`, com filtros por estado e decisão contextual no mesmo pedido persistido;
- API de decisão em `/api/academico/raa/reapreciacao/decisao`, com prazo, motivo obrigatório, transições protegidas e autorização para `admin`, `admin_escola`, `staff_admin`, `admin_financeiro`, `diretor` e `secretaria`;
- impedir duplicação com idempotência;
- mostrar protocolo, prazo e estado no mesmo painel.

Integração concluída neste corte:

- Eventos disciplinares integrados no resolvedor RAA com o estado canónico `reprovado_por_indisciplina`, sem abrir reapreciação académica automaticamente.
- Fluxos de melhoria e reapreciação com janela de 48 horas implementados nos portais do Professor e do Aluno.

## Sprint 5 — Portal do Aluno e Encarregado [PARCIAL — 2026-08-15]

- Cartão de estado RAA no Portal do Aluno implementado em `/api/aluno/home/raa-status`, com motivo explícito para retenção por indisciplina grave.
- RDEC/RDEA/RDA e pauta consolidada.
- Auto-serviço de reapreciação no boletim do aluno implementado em `/api/aluno/raa/reapreciacao`, com modal contextual, protocolo, prazo e idempotência; `reprovado_por_indisciplina` é bloqueado com explicação.
- Auto-serviço de melhoria implementado em `/api/aluno/raa/melhoria`, com seleção contextual de sessão de recurso no boletim, nota resolvida pelo SSOT e preservação da maior nota.
- Estado de inscrição condicional e exame extraordinário pendente.

## Sprint 6 — Autores e provas [PENDENTE]

- Provas ligadas à sessão e ao componente autorizado.
- Metadados de disciplina, classe, ciclo e aprendizagens fundamentais.
- Aprovação/publicação com permissões distintas para provas trimestrais e exames nacionais.

## Sprint 7 — Admin e Cobrança [PENDENTE]

- Remover lógica duplicada de classe de exame da cobrança.
- Consumir `resolve_regime_academico` diretamente ou através de adaptador fino.
- Manter eventual override manual somente como exceção auditável.
- Dashboard de turmas por regime e motivo da classificação.

## Sequência e dependências

```text
Sprint 0 ──┬─→ Sprint 1 ──→ Sprint 2 ──→ Sprint 3
           │                              ├─→ Sprint 4
           │                              ├─→ Sprint 5
           │                              └─→ Sprint 6
           └─→ Sprint 7
```

## Critério global de aceite

Nenhuma superfície calcula isoladamente se uma turma é classe de exame, qual fórmula aplicar, se o aluno é elegível ou qual nota deve prevalecer. Todas essas decisões devem vir do domínio académico centralizado.
