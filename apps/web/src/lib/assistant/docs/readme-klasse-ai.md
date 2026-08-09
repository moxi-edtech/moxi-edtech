# KLASSE IA — Copiloto Operacional

> Estado documentado: implementação de julho de 2026.

O KLASSE IA é o copiloto operacional do KLASSE. A sua função é ajudar a escola a entender o que está acontecendo, decidir o próximo passo e transformar dados operacionais em ações seguras.

O produto não é um agente autônomo. Dados, autorização e execução são controlados pelo backend; o modelo de linguagem é usado apenas quando necessário para explicar, resumir ou redigir.

## 1. Promessa de produto

O KLASSE IA oferece quatro capacidades:

1. **Diagnosticar** — consultar sinais reais da escola em fontes canônicas.
2. **Explicar** — traduzir indicadores em linguagem executiva.
3. **Recomendar** — sugerir próximos passos concretos com evidência.
4. **Preparar ação** — disponibilizar navegação, exportações ou rascunhos sujeitos a revisão humana.

Narrativa comercial suportada pela implementação atual:

> O KLASSE IA cruza dados administrativos, financeiros e acadêmicos para ajudar a direção a identificar riscos, priorizar ações e orientar equipas com mais clareza.

Não são promessas suportadas:

- autonomia total;
- alteração direta de dados por conversa;
- envio automático de WhatsApp;
- lançamento de notas ou pagamentos por prompt;
- recomendações sem fonte ou evidência.

## 2. Arquitetura

Fluxo principal:

```text
Pergunta do usuário
→ autenticação e resolução da escola
→ classificação determinística de intenção
→ registry fechado de ferramentas
→ validação de permissão por ferramenta
→ consulta a view/MV canônica
→ InsightAnswer estruturado
→ resposta editorial e ações registradas
→ persistência opcional em ai_insights
→ revisão ou aprovação humana
```

Princípios:

- o modelo não acessa o banco;
- o modelo não gera SQL;
- cada ferramenta possui intenção e permissão explícitas;
- todas as queries incluem contexto de escola;
- cálculo pré-processado é preferido a cálculo ao vivo;
- falha de uma fonte no briefing não derruba as outras;
- ações críticas permanecem como rascunho ou exigem aprovação.

Arquivos centrais:

```text
apps/web/src/lib/assistant/data-copilot/
├── types.ts
├── answer-composer.ts
├── tool-registry.ts
├── finance-debt-by-class.ts
└── tools/
    ├── finance-risk-summary.ts
    ├── admissions-pending.ts
    ├── academic-grade-gaps.ts
    ├── academic-low-attendance.ts
    └── school-daily-briefing.ts
```

O endpoint conversacional continua sendo `POST /api/admin/ai/assistant`, orquestrado por `klasse-brain.ts`.

## 3. Modos do assistente

### Help mode

Explica como usar o KLASSE, indica rotas oficiais e consulta a base de conhecimento. Fast Paths locais não consomem créditos de geração.

### Data mode

Executa ferramentas fechadas, consulta dados reais e devolve diagnóstico estruturado. O widget identifica este modo como **Análise de dados reais**.

### Action mode

Prepara navegação, exportação ou rascunho. A ação possui risco, permissão e requisito de aprovação definidos no registry Actions V2.

## 4. Contrato de resposta executiva

Todas as ferramentas do Data Copilot devolvem:

```ts
type InsightAnswer = {
  diagnosis: string;
  impact: string;
  recommendation: string;
  evidence: Array<{ label: string; value: string }>;
  actions: AssistantActionV2[];
};
```

O `answer-composer.ts` transforma esse contrato em:

```text
Diagnóstico
→ Impacto
→ Próximo passo recomendado
→ Evidências
→ Ações disponíveis
```

As respostas também incluem `operatingMode: "data"` e o objeto `insight`, permitindo que clientes renderizem cards em vez de interpretar texto livre.

## 5. Ferramentas implementadas

### Financeiro

#### `finance-debt-by-class`

- Intenção: inadimplência de uma turma ou classe.
- Fontes: `turmas` e `vw_radar_inadimplencia`.
- Evidências: alunos em atraso, turma e valor acumulado.
- Ações: abrir radar, exportar lista, preparar WhatsApp e criar plano de cobrança.
- Rascunhos e ações de alto risco exigem revisão humana.

#### `finance-risk-summary`

- Intenção: resumo ou risco financeiro geral.
- Fonte: `vw_financeiro_inadimplencia_top`.
- Evidências: devedores, valor nos 50 maiores casos e maior atraso.
- Limite de evidência: 50 registros.

### Secretaria e admissões

#### `admissions-pending`

- Intenção: candidaturas pendentes, estado ou risco da campanha.
- Fonte: `vw_admissoes_counts_por_status`.
- Evidências: submetidas, em análise, expiração em 24 horas e matrículas em sete dias.
- Ação: abrir a Central de Admissões.

### Acadêmico

#### `academic-grade-gaps`

- Intenção: notas, pautas ou lançamentos incompletos.
- Fonte: `vw_professor_pendencias`, wrapper de MV.
- Evidências: lançamentos incompletos, turmas afetadas e notas pendentes.
- Ação: abrir a área de notas.

#### `academic-low-attendance`

- Intenção: baixa frequência, faltas ou risco de presença.
- Fonte: `vw_frequencia_resumo_aluno`.
- Regra inicial: frequência inferior a 75%.
- Evidências: alunos abaixo do limite, turmas e menor frequência.
- Ação: abrir o acompanhamento de frequência.

### Direção

#### `school-daily-briefing`

Responde a perguntas como:

> O que merece minha atenção hoje?

O briefing executa em paralelo as ferramentas permitidas para o perfil:

- risco financeiro;
- admissões pendentes;
- lacunas de notas;
- baixa frequência.

Os três sinais com maior indicador principal são apresentados como prioridades. As ações são deduplicadas e uma falha isolada não impede o restante do briefing.

#### `academic-calendar-operations`

Consulta `anos_letivos`, `periodos_letivos` e `calendario_eventos` do ano activo para
identificar a fase temporal, o período actual e o próximo marco do calendário MED.
Quando o briefing é gerado no cockpit, este marco também é persistido em `ai_insights`
como alerta operacional independente, com ciclo `new → seen → in_progress → resolved`.
As acções apenas abrem as telas oficiais de calendário e notas; conselho e pauta
continuam dependentes da validação humana e dos fluxos académicos oficiais.

## 6. Permissões

Permissões específicas:

| Permissão | Uso |
|---|---|
| `assistant.view` | visualizar e usar o assistente |
| `assistant.help` | ajuda e navegação |
| `assistant.finance` | ferramentas e ações financeiras |
| `assistant.secretaria` | diagnósticos de secretaria e admissões |
| `assistant.academico` | diagnósticos de notas e frequência |
| `assistant.summary` | briefing e resumos executivos |
| `assistant.ai_actions` | Central de Ações IA |
| `assistant.whatsapp_draft` | rascunhos financeiros para WhatsApp |

Alunos, professores, encarregados e perfis equivalentes permanecem explicitamente bloqueados nesta versão administrativa.

## 7. Actions V2 e aprovação humana

Cada ação registrada possui:

- identificador estável;
- tipo de ação;
- módulo;
- papéis permitidos;
- permissão;
- nível de risco;
- indicação de aprovação;
- destino ou payload fechado.

Níveis:

- **low** — navegação e leitura;
- **medium** — exportação ou preparação operacional explícita;
- **high** — comunicação, cobrança ou ação com efeito externo; exige revisão.

A IA não executa silenciosamente. Ações de risco alto são encaminhadas para a Central de Ações IA.

## 8. Insights persistentes

A tabela `public.ai_insights` transforma respostas efêmeras em memória operacional auditável.

Campos principais:

- escola e usuário gerador;
- ferramenta e fingerprint;
- título, severidade e módulo;
- explicação e evidência estruturada;
- recomendação e ação sugerida;
- status e timestamps de workflow;
- datas de primeira e última detecção.

Estados:

```text
new → seen → in_progress → resolved
                  └──────→ ignored
```

O fingerprint `(school_id, fingerprint)` evita duplicação do mesmo insight. O briefing usa fingerprint diário.

Segurança do schema:

- RLS habilitado;
- acesso condicionado ao vínculo em `escola_users`;
- `anon` sem privilégios;
- `authenticated` com `SELECT`, `INSERT` e `UPDATE`;
- DELETE reservado ao `service_role`;
- índices para escola, status, módulo, severidade e insights abertos.

Migrations:

- `20270718123000_create_ai_insights.sql`;
- `20270718123500_harden_ai_insights_grants.sql`.

## 9. API de insights

### `GET /api/admin/ai/insights`

Lista histórico da escola com filtros opcionais:

- status;
- módulo;
- severidade;
- limite entre 1 e 50.

### `POST /api/admin/ai/insights`

Gera o briefing diário e faz upsert idempotente em `ai_insights`.

### `PATCH /api/admin/ai/insights/[id]`

Transições permitidas:

- `seen`;
- `in_progress`;
- `resolved`;
- `ignored`.

Todos os endpoints são `force-dynamic`, usam `revalidate = 0`, autenticam o usuário e executam `resolveEscolaIdForUser`. Endpoints humanos não usam service role.

## 10. Cockpit do KLASSE IA

Rota:

```text
/escola/[id]/admin/ai
```

A antiga redireção direta para a Central de Ações foi substituída por uma home própria com:

- chamada “O que merece atenção hoje?”;
- geração e atualização do briefing;
- insights novos, em execução e resolvidos;
- ações aguardando aprovação;
- cards semânticos por severidade;
- evidências e recomendação;
- workflow visto, iniciar, resolver e ignorar;
- acesso à Central de Ações IA.

Componente: `KlasseAiCockpitClient.tsx`.

## 11. Widget

O `AiChatWidget.tsx` mantém ajuda e conversa contextual, mas respostas de dados agora usam apresentação editorial própria:

- etiqueta **Análise de dados reais**;
- badge **Copiloto**;
- bloco de diagnóstico;
- bloco semântico de impacto;
- próximo passo recomendado;
- cards de evidência;
- botões de ação com cor de risco;
- indicação **Requer revisão** para ações sujeitas a aprovação.

Mensagens antigas ou de ajuda continuam com fallback compatível.

## 12. Proteção de dados

- Ferramentas usam dados agregados sempre que possível.
- O briefing não envia dados operacionais para o provedor de linguagem.
- A ferramenta de frequência não retorna nomes de alunos.
- Evidências são limitadas e não incluem listas integrais.
- O contexto enviado ao modelo remove PII desnecessária.
- Rascunhos de WhatsApp usam placeholders antes da aprovação.

## 13. Cache e atualização de dados

Dados operacionais e financeiros usam `no-store`/`force-dynamic` conforme o contrato KLASSE.

As MVs críticas possuem índice único, função de refresh concorrente e cron. Os jobs de pagamentos e Formação foram reconciliados e distribuídos em horários diferentes para reduzir picos de I/O.

## 14. Créditos e logs

- Configuração por escola em `ai_school_settings`.
- Uso registrado em `ai_usage_logs`.
- Reserva de cota por RPC `claim_ai_usage_slot`.
- Fast Paths e ferramentas determinísticas não precisam chamar o provedor de linguagem.
- Geração textual continua sujeita a quota, timeout e logs do provedor.

## 15. Operação e validação

Antes de liberar mudanças do KLASSE IA:

1. executar `pnpm -C apps/web typecheck`;
2. executar `git diff --check`;
3. verificar `resolveEscolaIdForUser` em endpoints humanos;
4. verificar `force-dynamic`, `revalidate = 0` e limites máximos;
5. confirmar RLS e grants das tabelas persistentes;
6. confirmar fontes canônicas e filtros `escola_id`;
7. validar que ações de alto risco continuam sujeitas a aprovação.

## 16. Limitações e próximos passos

Implementado, mas ainda evolutivo:

- o briefing é gerado manualmente pelo cockpit ou por solicitação no widget;
- geração proativa agendada de insights ainda não está habilitada;
- a priorização usa o indicador principal de cada ferramenta, não um modelo avançado de risco;
- consumo detalhado de IA ainda não possui card dedicado no cockpit;
- oportunidades e previsão financeira podem ganhar ferramentas específicas;
- testes E2E autenticados do cockpit devem integrar a pipeline regular.

Essas limitações não autorizam autonomia adicional. A regra permanece:

> O backend decide dados e ações; a IA explica e escreve; uma pessoa aprova efeitos externos.

## 17. Backlog priorizado

Este backlog registra as pendências conhecidas após a implementação do Data Copilot, briefing diário, `ai_insights`, cockpit e cards estruturados do widget.

### P0 — Gate antes da campanha

Itens bloqueantes para demonstrações comerciais com dados reais:

- [ ] Criar testes E2E autenticados para o fluxo completo:
  - pergunta no widget;
  - execução de ferramenta;
  - composição do briefing;
  - persistência em `ai_insights`;
  - transição de estado;
  - abertura de ação sugerida.
- [ ] Validar visualmente cockpit e widget em desktop e mobile.
- [ ] Testar RLS com usuários pertencentes a escolas diferentes.
- [ ] Testar ausência de acesso para `anon`, aluno, professor e encarregado.
- [ ] Calcular severidade a partir dos dados; o briefing persistido ainda usa `high` como valor inicial fixo.
- [ ] Evoluir a priorização para considerar severidade, valor, antiguidade e contexto, não apenas o primeiro indicador numérico.
- [ ] Exibir estado parcial quando uma ou mais fontes do briefing falharem.
- [ ] Persistir insights individuais por módulo, além do briefing consolidado.
- [ ] Confirmar o fluxo autenticado no ambiente usado pela demonstração comercial.

Critério de conclusão do P0:

- isolamento entre escolas comprovado;
- zero ações externas automáticas;
- briefing gerado e persistido com sucesso;
- cards responsivos e sem erro de runtime;
- evidências correspondentes aos dados canônicos;
- workflow de insight funcional do início à resolução.

### P1 — Sustentar plenamente a campanha

#### Proatividade

- [ ] Gerar insights automaticamente no início do dia.
- [ ] Gerar insights antes do fechamento financeiro.
- [ ] Gerar insights durante campanhas de admissões.
- [ ] Gerar insights antes do fechamento de notas.
- [ ] Gerar insight imediato quando um limiar de risco alto for atingido.
- [ ] Garantir que proatividade apenas prepare e sinalize; nenhum envio ou efeito externo pode ser automático.

#### Novas ferramentas

- [ ] Top devedores.
- [ ] Previsão simples de entrada do mês.
- [ ] Pagamentos aguardando compensação.
- [ ] Turmas com maior risco financeiro.
- [ ] Documentos de admissão em falta.
- [ ] Admissões paradas há mais de X dias.
- [ ] Alunos sem acesso liberado.
- [ ] Disciplinas sem lançamento.
- [ ] Oportunidades da escola, além de riscos.

#### Cockpit e operação

- [ ] Adicionar card de consumo diário e mensal de IA.
- [ ] Mostrar limite do plano e disponibilidade do provedor.
- [ ] Adicionar filtros por módulo, severidade e status.
- [ ] Mostrar timeline das mudanças de cada insight.
- [ ] Permitir definir responsável e prazo.
- [ ] Permitir delegar insight sem executar a recomendação automaticamente.
- [ ] Transformar recomendação em tarefa ou plano auditável.
- [ ] Mostrar horário de atualização da fonte/MV.

### P1 — Experiência e identidade

- [ ] Abrir o widget com resumo contextual dos sinais do dia.
- [ ] Adicionar cards rápidos:
  - Ver risco financeiro;
  - Rever admissões pendentes;
  - Gerar resumo da direção;
  - Preparar comunicação.
- [ ] Criar presença visual própria ou mascote leve do KLASSE IA.
- [ ] Melhorar renderização de markdown nos campos estruturados.
- [ ] Criar estados visuais para fonte indisponível e dados desatualizados.
- [ ] Validar contraste, leitor de tela e navegação por teclado.
- [ ] Executar QA responsivo completo do cockpit e widget.

### P2 — Evolução

- [ ] Preferências operacionais por escola.
- [ ] Regras recorrentes de cobrança.
- [ ] Tom institucional configurável.
- [ ] Comparação com períodos anteriores.
- [ ] Tendências e previsão de risco.
- [ ] Feedback útil/não útil associado diretamente ao insight.
- [ ] Métricas de adoção:
  - insights vistos;
  - ações iniciadas;
  - resoluções;
  - tempo até resolução;
  - recomendações ignoradas.
- [ ] Política de expiração, arquivamento e retenção de insights antigos.
- [ ] Jobs de manutenção e observabilidade do pipeline proativo.

### Gate de liberação comercial

A campanha pode demonstrar dados reais quando todos os itens P0 estiverem concluídos e houver evidência do teste autenticado no ambiente de demonstração.

Até esse gate, a formulação comercial deve permanecer:

> O KLASSE IA cruza dados administrativos, financeiros e acadêmicos para ajudar a direção a identificar riscos, priorizar ações e orientar equipas com mais clareza.

Após concluir proatividade, workflow operacional e QA do cockpit, pode ser usada a formulação:

> O KLASSE IA atua como copiloto operacional da escola, gerando insights, recomendações e rascunhos de ação sempre com aprovação humana.

## 18. WhatsApp — ponte inteligente entre escola e família

O WhatsApp é o braço de ação comunicacional do KLASSE IA. Ele não deve ser apresentado apenas como canal de envio, mas como a ponte segura entre um diagnóstico operacional e a comunicação necessária para resolver a situação.

### Promessa comercial

> O KLASSE IA transforma dados escolares em comunicações prontas para WhatsApp, sempre com revisão e aprovação da equipa.

Frase de campanha:

> O KLASSE IA não apenas mostra o problema. Ele prepara a comunicação certa para resolver.

Essa promessa significa:

```text
KLASSE IA identifica o sinal
→ seleciona o cenário e a ação permitida
→ prepara mensagem contextual
→ apresenta destinatários e motivo
→ escola revisa, edita e aprova
→ outbox envia dentro dos limites
→ sistema registra entrega, leitura, resposta ou falha
```

O WhatsApp não é automação cega. É comunicação assistida, contextual e auditável.

### Papel do KLASSE IA

O copiloto pode identificar:

- documentos pendentes;
- candidaturas sem resposta;
- mensalidades em atraso;
- avisos que precisam chegar a uma turma;
- encarregados que exigem follow-up;
- situações acadêmicas que justificam comunicação.

Depois pode preparar:

- mensagem adequada ao cenário;
- tom institucional;
- contexto mínimo necessário;
- chamada para ação;
- prazo;
- link ou instrução oficial.

A escola mantém a decisão final sobre destinatários, conteúdo e envio.

### Capacidades existentes

O produto já possui bases relevantes para essa promessa:

- Central WhatsApp;
- `communication_outbox`;
- `communication_templates`;
- permissões por papel;
- resolução de destinatário por referência autorizada;
- mascaramento e hash de telefone;
- templates com variáveis;
- inferência de risco e aprovação obrigatória;
- criação individual e em lote;
- confirmação da quantidade esperada no lote;
- limite de 50 destinatários por operação em lote;
- idempotency key por mensagem;
- worker de outbox;
- rate limits de comunicação;
- integração WAHA;
- webhook para atualização de envio, entrega e leitura;
- threads e inbox de respostas;
- rascunhos financeiros/WhatsApp a partir do KLASSE IA;
- Central de Ações IA para revisão humana.

Estados disponíveis no outbox:

```text
draft
→ review_required
→ approved
→ queued
→ sending
→ sent
→ delivered
→ read
```

Estados alternativos incluem `rejected`, `failed` e `cancelled`. Respostas recebidas são registradas em threads de comunicação, não como um estado simples do outbox.

### Experiência-alvo

Exemplo:

```text
KLASSE IA detecta:
“12 candidatos estão com BI pendente.”

Sugere:
“Preparar WhatsApp para os encarregados?”

Gera:
12 mensagens contextualizadas.

Secretaria:
revê destinatários, motivo e conteúdo; edita e aprova.

Sistema:
envia dentro dos limites, registra o histórico e acompanha retorno.
```

Cada revisão deve mostrar:

- destinatário;
- entidade relacionada, quando aplicável;
- motivo da seleção;
- fonte do dado;
- template ou texto gerado;
- variáveis utilizadas;
- nível de risco;
- necessidade de aprovação;
- estimativa de quantidade;
- resultado do envio.

### Casos comerciais prioritários

- Gerar mensagens para encarregados com mensalidades em atraso.
- Avisar candidatos com documentos pendentes.
- Enviar lembrete de reunião para uma turma.
- Reescrever comunicado em tom mais claro.
- Preparar follow-up para quem não respondeu.
- Gerar campanha de matrícula para leads antigos.
- Criar mensagem individualizada pela situação do aluno.
- Avisar sobre risco de frequência ou pendência acadêmica, quando autorizado.

### Regras de segurança

- A IA nunca envia WhatsApp diretamente.
- A IA não escolhe destinatários fora de segmentações fechadas.
- Segmentação deve usar fontes canônicas e `escola_id`.
- Mensagens financeiras e de risco alto exigem aprovação.
- O usuário deve ver a quantidade de destinatários antes de aprovar.
- O telefone completo não deve aparecer em logs ou respostas da IA.
- Envios devem respeitar rate limit, janela operacional e política anti-spam.
- Templates precisam declarar papéis permitidos e risco.
- Conteúdo gerado não pode inventar valores, datas, prazos ou situação do aluno.
- Falhas devem permanecer auditáveis e nunca ser ocultadas por retry silencioso ilimitado.
- Opt-out, bloqueio e preferências de comunicação devem ser respeitados quando disponíveis.

### Backlog WhatsApp + KLASSE IA

#### P0 — Fechar a promessa comercial

- [ ] Validar E2E autenticado: insight → rascunho → edição → aprovação → outbox → webhook.
- [ ] Exibir claramente o motivo de seleção de cada destinatário.
- [ ] Associar rascunho ao `ai_insight` que o originou.
- [ ] Garantir edição antes da aprovação em todos os fluxos gerados pela IA.
- [ ] Validar histórico no aluno, encarregado ou candidatura.
- [ ] Testar status `sent`, `delivered`, `read`, resposta e `failed` com WAHA.
- [ ] Validar que usuário de outra escola não consulta, aprova ou envia a mensagem.
- [ ] Validar rate limit e bloqueio anti-spam em lote.
- [ ] Confirmar opt-out/bloqueio antes de montar destinatários.

#### P1 — Segmentações fechadas

- [ ] Turma.
- [ ] Status financeiro.
- [ ] Candidatura e estágio de admissão.
- [ ] Documentos pendentes.
- [ ] Baixa frequência.
- [ ] Lacunas acadêmicas.
- [ ] Falta de resposta ou follow-up vencido.
- [ ] Leads antigos para campanha de matrícula.

Cada segmentação precisa de:

- fonte canônica;
- permissão;
- limite máximo;
- preview de quantidade;
- motivo auditável;
- template compatível;
- política de exclusão e opt-out.

#### P1 — Templates estratégicos

- [ ] Cobrança amigável inicial.
- [ ] Cobrança vencida com prazo.
- [ ] Documento pendente de candidatura.
- [ ] Lembrete de reunião.
- [ ] Comunicado de turma.
- [ ] Follow-up sem resposta.
- [ ] Campanha de matrícula.
- [ ] Alerta de frequência.
- [ ] Pendência de notas ou fechamento, direcionada ao perfil autorizado.

#### P1 — Cockpit e métricas

- [ ] Caixa de rascunhos WhatsApp dentro do cockpit do KLASSE IA.
- [ ] Contagem por rascunho, aprovado, enviado, entregue, lido, respondido e falhou.
- [ ] Taxa de entrega, leitura e resposta por cenário.
- [ ] Tempo entre insight, aprovação e envio.
- [ ] Resultado associado ao insight original.
- [ ] Alertas de falha, desconexão WAHA e saturação de rate limit.

### Gate de campanha para WhatsApp

A campanha pode demonstrar o fluxo completo quando houver evidência E2E de que:

1. o KLASSE IA identifica o grupo por uma fonte canônica;
2. o usuário vê destinatários e motivo;
3. a mensagem pode ser editada;
4. o envio exige aprovação quando aplicável;
5. o outbox respeita limite e idempotência;
6. entrega, leitura, resposta e falha ficam auditáveis;
7. nenhuma escola acessa dados ou mensagens de outra.

Até esse gate, a demonstração deve terminar na preparação e revisão do rascunho, sem prometer automação autônoma.
