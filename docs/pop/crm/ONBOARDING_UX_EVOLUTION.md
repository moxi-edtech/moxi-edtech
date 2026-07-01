# KLASSE - Evolucao UX do Onboarding Escolar

Data: 2026-07-01
Atualizado em: 2026-07-01
Escopo: Portal publico de onboarding, onboarding operacional, setup escolar, readiness operacional e handoff para operacao
Status: Por revisar

## 1. Objetivo

Reduzir a friccao do onboarding da escola desde o primeiro contacto ate ao go-live operacional, sem confundir conversao comercial, onboarding operacional, provisionamento, setup interno e prontidao real de operacao.

O objetivo da evolucao UX nao e apenas "embelezar telas". O objetivo real e:

- diminuir retrabalho da escola
- reduzir dependencia de WhatsApp informal
- tornar cada proximo passo obvio
- evitar abandono entre provisionamento e setup
- transformar readiness operacional em experiencia guiada

## 1.1 Norte do Produto

A experiencia ideal do onboarding KLASSE deve fazer a escola sentir que existe uma unica jornada continua, mesmo que tecnicamente o fluxo tenha multiplas camadas internas.

A escola nao deve precisar entender:

- diferenca entre `onboarding_requests.status`
- diferenca entre `implantation_status`
- diferenca entre `onboarding_finalizado`
- diferenca entre `operational_readiness`

Ela deve apenas entender:

- onde esta
- o que falta
- quem precisa agir
- o que desbloqueia o proximo passo

## 1.2 Semantica real que a UX deve respeitar

O fluxo real no produto hoje e:

`lead ganho -> pedido de onboarding -> 7 etapas operacionais -> provisionamento -> setup escolar -> readiness operacional -> go-live`

Marcos tecnicos reais:

- `pendente` = pedido de onboarding criado
- `em_configuracao` = onboarding em curso / marcador administrativo
- `activo` = escola provisionada
- `escolas.onboarding_finalizado = true` = wizard interno concluido
- `operational_readiness.summary.operational_ok = true` = escola operacional

Regra de UX:

- a interface nao deve tratar `activo` como "escola pronta"
- a interface nao deve tratar `onboarding_finalizado` como "go-live"
- a interface so deve comunicar "ativa", "pronta" ou "operacional" quando o readiness estiver realmente completo

## 2. Diagnostico de Friccao

### 2.1 Friccao 1 - Jornada quebrada em duas experiencias

Hoje a escola entra num portal publico de acompanhamento e, depois do provisionamento, precisa migrar mentalmente para outro fluxo de setup no portal escolar.

Impacto:

- sensacao de reinicio do processo
- perda de contexto
- aumento de dependencia de suporte humano
- abandono entre provisionamento e configuracao final

### 2.2 Friccao 2 - Estados tecnicos pouco intuitivos

O sistema internamente distingue onboarding, implantacao, setup e readiness. A escola e o parceiro, porem, recebem sinais que ainda podem parecer ambiguos.

Impacto:

- operador promete "escola ativa" cedo demais
- diretor acredita que o processo terminou quando ainda faltam turmas, precos, horarios ou professores
- dificuldade para cobrar a pendencia certa da pessoa certa

### 2.3 Friccao 3 - Setup pede decisoes detalhadas cedo demais

O wizard escolar exige configuracoes importantes logo nas primeiras interacoes:

- calendario e bloqueio de notas
- regras de avaliacao
- estrutura de turmas
- configuracao financeira

Impacto:

- medo de errar
- atraso para avancar
- necessidade de pedir ajuda para confirmar escolhas basicas

### 2.4 Friccao 4 - Importacao de dados pune o erro

No upload de planilhas, a experiencia atual tende a rejeitar e empurrar o utilizador de volta para o Excel.

Impacto:

- retrabalho
- stress com CSV
- quebra do fluxo
- migracao para suporte por mensagens externas

### 2.5 Friccao 5 - Readiness operacional ainda nao virou experiencia

O backend ja consegue medir se a escola esta operacional, mas isso ainda nao esta plenamente traduzido numa jornada orientada por blockers acionaveis.

Impacto:

- setup concluido sem clareza de prontidao
- dificuldade para priorizar faltas reais
- pouco senso de progresso para o cliente

## 3. Principios de UX para a Evolucao

- Uma jornada, multiplos estados internos.
- Menos campos manuais, mais presets e preenchimento assistido.
- Menos erros bloqueantes, mais correcao guiada.
- Cada ecrã deve responder: o que falta agora.
- Cada pendencia deve mostrar dono: escola, parceiro ou KLASSE.
- Cada fase deve terminar com um marco claro e verificavel.
- O produto deve preferir linguagem operacional a linguagem tecnica.

## 4. Checklist Macro de Experiencia

### Continuidade da Jornada

- [ ] Mesmo link/ambiente acompanha a escola do onboarding ao setup.
- [ ] Handoff entre provisionamento e setup sem ruptura de contexto.
- [x] Timeline unica por fase e proximo passo.

### Clareza de Estado

- [x] Status visivel com semantica humana.
- [x] Indicacao clara do responsavel por cada pendencia.
- [ ] Diferenca explicita entre provisionada, configurada e operacional.

### Setup Assistido

- [x] Modelos e regras preconfigurados quando possivel.
- [x] Preenchimento em lote para dados repetitivos.
- [ ] Preview do impacto das configuracoes antes de gerar artefactos.

### Importacao Sem Trauma

- [x] Aceitar Excel nativo.
- [ ] Validar sem rejeitar o ficheiro inteiro por poucos erros.
- [ ] Permitir correcao inline de dados invalidos.

### Readiness Operacional

- [ ] Mostrar blockers reais de academia, financeiro, equipe, horarios e portais.
- [ ] Ordenar blockers por gravidade e dependencia.
- [ ] Comunicar "pronta para operar" apenas no go-live real.

## 5. Metricas de Sucesso

As metricas abaixo devem ser observadas apos a implementacao:

- reduzir tempo medio entre provisionamento e `onboarding_finalizado`
- reduzir tempo medio entre `onboarding_finalizado` e `operational_ok`
- reduzir numero de uploads repetidos por escola
- reduzir numero de interacoes externas para desbloqueio basico
- aumentar percentual de escolas que concluem setup sem ajuda sincrona
- reduzir blockers reincidentes por categoria

## 6. Roadmap por Sprint

## Sprint UX-1 - Semantica, Continuidade e Proximo Passo

### Meta

Transformar o onboarding numa jornada continua e compreensivel, com estados humanos e um proximo passo explicito em cada fase.

### Backlog

- [x] Unificar a narrativa entre portal de acompanhamento e setup escolar.
- [x] Revisar todos os textos de status com foco em linguagem operacional.
- [x] Exibir em cada fase um card fixo "O que falta agora".
- [x] Exibir em cada pendencia o dono da acao: escola, parceiro ou KLASSE.
- [ ] Introduzir marcos visuais distintos para:
  - [ ] pedido criado
  - [ ] onboarding em curso
  - [ ] escola provisionada
  - [ ] setup escolar em curso
  - [ ] setup concluido
  - [ ] operacional
- [ ] Criar regra de transicao visual entre provisionamento e setup sem ruptura de contexto.

### Entrega

- A escola entende onde esta sem precisar de explicacao externa.
- O parceiro consegue acompanhar e comunicar o estado certo sem ambiguidade.
- O produto deixa de usar "ativa" como sinonimo de provisionada.

### Criterios de Aceite

- [x] Nenhum ecrã orientado para escola usa `activo` como equivalente a "pronta para operar".
- [x] Cada pagina de onboarding mostra exatamente um proximo passo principal.
- [x] Cada pendencia relevante mostra responsavel e consequencia.
- [ ] A escola provisionada recebe orientacao clara para iniciar o setup interno sem depender de explicacao manual.

### Dependencias

- Payloads de onboarding com estado consolidado.
- Uso consistente de `onboarding_finalizado` e `operational_readiness`.

### Fora de Escopo

- Refactor estrutural profundo do produto.
- Automatizacao de importacao de dados.

## Sprint UX-2 - Wizard Assistido e Menos Digitacao

### Meta

Reduzir carga cognitiva no setup escolar com presets, autocompletar operacional e configuracao em lote.

### Backlog

- [x] Carregar modelos reais de avaliacao dentro do wizard.
- [x] Apresentar modelo recomendado por contexto da escola.
- [x] Preencher automaticamente travamento de notas a partir do fim do periodo.
- [x] Permitir "aplicar a todos os periodos" para datas e regras equivalentes.
- [x] Permitir "aplicar a todas as classes" para estruturas repetitivas.
- [x] Mostrar preview do impacto antes de gerar:
  - [x] periodos
  - [x] turmas
  - [x] nomenclatura
  - [x] mensalidades
- [x] Quebrar o passo final em resumo verificavel antes da geracao.

### Entrega

- O wizard deixa de parecer uma ficha tecnica para virar um assistente.
- A escola toma menos decisoes finas no inicio e confirma mais do que digita.

### Criterios de Aceite

- [x] O passo de regras nao exibe estado vazio quando ha modelos disponiveis no sistema.
- [x] O utilizador consegue concluir sessao e regras sem preencher manualmente todos os detalhes finos.
- [x] Configuracoes em lote reduzem inputs repetitivos nas turmas e no financeiro.
- [x] O resumo final deixa claro o que sera criado ou activado.

### Dependencias

- API de modelos de avaliacao acessivel ao wizard.
- Regras de defaults bem definidas por produto/operacao.

### Fora de Escopo

- Motor novo de curriculo.
- Redesenho completo das regras pedagogicas.

## Sprint UX-3 - Importacao Tolerante a Erro

### Meta

Tornar a carga de alunos, professores e tabelas financeiras resiliente a erros comuns de ficheiro e formato.

### Backlog

- [x] Aceitar `.xlsx` alem de `.csv`.
- [x] Detectar cabecalhos equivalentes e sugerir mapeamento.
- [x] Criar tela de staging para visualizar erros antes da rejeicao final.
- [x] Permitir correcao inline de linhas invalidas.
- [x] Validar por linha, nao apenas por ficheiro inteiro.
- [ ] Exibir resumo de importacao:
  - [ ] validos
  - [ ] corrigiveis
  - [ ] bloqueantes
  - [ ] ignorados
- [ ] Incluir exemplos prontos de ficheiros por tipo de carga.

### Entrega

- A escola resolve pequenos erros dentro do produto.
- O onboarding deixa de depender de exportacoes repetidas do Excel.

### Criterios de Aceite

- [x] Um ficheiro com poucos erros nao precisa ser totalmente rejeitado.
- [x] O utilizador consegue corrigir pelo menos os erros simples no browser.
- [x] O sistema explica a falha por coluna, linha e motivo.
- [x] O fluxo final de submissao preserva rastreabilidade das correcoes.

### Dependencias

- Parser cliente para Excel.
- Estrategia de staging local ou temporario.

### Fora de Escopo

- ETL enterprise completo.
- Integracoes externas de SIS neste ciclo.

## Sprint UX-4 - Readiness Operacional Guiado

### Meta

Transformar readiness operacional num painel acionavel de go-live, com blockers claros e progresso real ate a escola operar.

### Backlog

- [x] Traduzir os grupos de readiness em experiencia visual:
  - [x] academico
  - [x] financeiro
  - [x] equipe
  - [x] horarios
  - [x] portais
- [x] Mostrar blockers priorizados por impacto operacional.
- [ ] Mostrar dependencias entre blockers.
- [x] Criar reta final de go-live com checklist orientado.
- [x] Explicitar diferenca entre:
  - [x] setup concluido
  - [x] pronto para validar
  - [x] operacional
- [ ] Criar visoes diferentes por papel:
  - [ ] diretor
  - [ ] secretaria
  - [ ] parceiro
  - [ ] KLASSE

### Entrega

- A escola percebe claramente por que ainda nao pode operar.
- O parceiro deixa de fazer follow-up generico.
- O produto cria um momento claro de "pronta para operar".

### Criterios de Aceite

- [x] Cada blocker aparece com titulo, detalhe, area e acao esperada.
- [x] A tela de readiness nao mistura blockers criticos com itens cosmeticos.
- [x] O selo de escola operacional aparece apenas quando `operational_ok = true`.
- [x] O parceiro consegue usar o mesmo painel para orientar o cliente sem ambiguidade.

### Dependencias

- Payload de `get_school_operational_readiness`.
- Consolidacao visual dos blockers em UI.

### Fora de Escopo

- Automacao total do go-live.
- Fechamento de lacunas operacionais profundas fora do onboarding.

## Sprint UX-5 - Suporte Contextual e Menos WhatsApp Informal

### Meta

Levar ajuda para dentro do fluxo e diminuir dependencia de mensagens soltas fora da plataforma.

### Backlog

- [x] Exibir consultor responsavel no onboarding.
- [x] Exibir canal rapido de ajuda por etapa.
- [x] Anexar ajuda contextual com POPs por tipo de pendencia.
- [x] Permitir abertura de duvida dentro da etapa actual.
- [x] Registrar historico de interacoes de ajuda no contexto do onboarding.
- [ ] Identificar quando a escola esta bloqueada ha demasiado tempo numa etapa.

### Entrega

- A escola sabe com quem falar sem abandonar o fluxo.
- O parceiro recebe pedidos mais claros e rastreaveis.

### Criterios de Aceite

- [x] Cada etapa critica oferece ajuda contextual.
- [x] O contacto do responsavel esta visivel sem depender de busca externa.
- [x] O pedido de ajuda fica vinculado ao contexto da pendencia.
- [x] O fluxo principal continua utilizavel mesmo quando a escola pede suporte.

### Dependencias

- Dados do responsavel no payload do onboarding.
- Ligacao entre onboarding e suporte/tarefas.

### Fora de Escopo

- Central omnichannel completa.
- Chat em tempo real neste ciclo.

## 7. Ordem Recomendada de Implementacao

Prioridade recomendada:

1. Sprint UX-1
2. Sprint UX-2
3. Sprint UX-3
4. Sprint UX-4
5. Sprint UX-5

Justificativa:

- primeiro corrigimos semantica e continuidade
- depois reduzimos digitacao e carga cognitiva
- depois eliminamos a principal dor de importacao
- em seguida tornamos readiness uma experiencia guiada
- por fim trazemos suporte contextual para dentro do fluxo

## 7.1 Implementado em 2026-07-01

- Portal publico de onboarding com linguagem revista para onboarding, provisionamento e proximo responsavel.
- Card fixo de "o que falta agora" no portal publico com proxima pendencia da escola quando aplicavel.
- Wizard escolar com card de orientacao por passo para reduzir ambiguidade durante o setup.
- Wizard escolar agora carrega modelos reais de avaliacao e aplica fallback simplificado quando nenhum modelo e encontrado.
- Passo de regras passou a destacar o modelo recomendado.
- Passo de sessao passou a sugerir automaticamente `trava_notas_em` com base no fim de cada trimestre.
- Acao em lote para aplicar travas recomendadas a todos os periodos.
- Validador do portal publico passou a aceitar ficheiros Excel `.xlsx` e `.xls` alem de `.csv`.
- Mensagens de validacao de planilha ficaram mais orientadas a correcao e menos punitivas.
- Validador cliente e parser do backend atualizados para ignorar automaticamente as 3 linhas instrucionais dos templates oficiais do Kit Onboarding AELS.
- Suporte a normalização de cabeçalhos (remoção de asteriscos, acentos e espaços) e mapeamento automático de aliases (ex: `Nome*` -> `NOME_COMPLETO`, `Data de Nascimento*` -> `DATA_NASCIMENTO`, `BI*` -> `BI_NUMERO`).
- Adequação das regras de validação de professores no frontend para suportar o formato sem a coluna `DISCIPLINAS_CODIGOS` na aba principal, alinhando com a estrutura real da planilha oficial.
- Integração do Painel de Prontidão Operacional (Go-Live) na página pública de acompanhamento do Onboarding para escolas provisionadas (`activo`).
- Exibição de estatísticas e métricas de configuração (total de cursos, turmas, professores, períodos) na barra lateral direita como controle de progresso.
- Criação da tabela e políticas RLS de `onboarding_doubts` para registrar dúvidas e conversações de onboarding.
- Adição do componente de Chat de Dúvidas / Interaction Log na coluna esquerda do portal de acompanhamento.
- Inclusão do card de Consultor de Implantação Responsável, atalhos para canais rápidos de ajuda (WhatsApp/Email) e POPs contextuais inteligentes por etapa na barra lateral direita.
- Implementação da tela final de geração do setup (Passo 5) no `AcademicSetupWizard` contendo um preview detalhado de impacto (trimestres, trava-notas, avaliação e pesos, número total de turmas/classes e preços) e um resumo verificável antes da inserção no banco de dados.
- Suporte a configurações em lote para replicação de mensalidades e turmas por turno para todas as classes da matriz com um clique.
- Ajuste na biblioteca de POPs no CRM para carregar por padrão no formato de Lista (`viewMode = 'list'`).
- Integração do Painel de Validação Automática (Real-Time) no Drawer de detalhes da escola no portal do parceiro, exibindo bloqueadores críticos de banco de dados (como slots de horário vazios e quadros não publicados) e alertas recomendados de forma inteligente.
- Adição da verificação automatizada de alunos matriculados (`public.matriculas` count) na RPC `get_school_operational_readiness`, notificando se o banco ainda não possuir alunos importados.

## 7.2 Especificação Detalhada das Planilhas de Importação (Kit Onboarding AELS)

Com base na auditoria das planilhas oficiais encontradas em `/Users/gundja/Desktop/Projetos/KLASSE/Kit_Onboarding_AELS/Templates/`, a implementação da Fase 2 (Ingestão de Dados) deve respeitar a estrutura binária e o layout específico destes ficheiros:

### A) Planilha de Alunos (`KLASSE_Modelo_Importacao_Alunos_v1.xlsx`)
* **Aba Alvo:** `Importacao_Alunos` (Index `0`)
* **Estrutura de Linhas:**
  * Linha 1: Título e Versão (ignorar no parser)
  * Linha 2: Instruções operacionais (ignorar no parser)
  * Linha 3: Agrupamentos de Categoria (`DADOS OBRIGATÓRIOS`, `IDENTIFICAÇÃO`, etc.) (ignorar no parser)
  * **Linha 4 (Index 3): Linha de Cabeçalhos**
  * **Linha 5 (Index 4) em diante: Dados Reais**
* **Mapeamento Exato de Colunas (Header Row 4):**
  * `NOME_COMPLETO` -> Nome do aluno (Obrigatório)
  * `DATA_NASCIMENTO` -> Data de Nascimento (Obrigatório - Formatos: `DD/MM/AAAA` ou `AAAA-MM-DD`)
  * `GENERO` -> Sexo (Obrigatório - Aceitar `"M"` ou `"F"`)
  * `BI_NUMERO` -> Bilhete de Identidade (Mapeia para `bi_numero`, sanitizar removendo espaços)
  * `NUMERO_PROCESSO` -> Processo Acadêmico (Mapeia para `numero_processo`)
  * `NIF` -> NIF (Mapeia para `nif`)
  * `TELEFONE` -> Contacto do aluno (Mapeia para `telefone`)
  * `EMAIL` -> E-mail (Mapeia para `email`)
  * `NOME_ENCARREGADO` -> Nome do Encarregado (Mapeia para `encarregado_nome`)
  * `TELEFONE_ENCARREGADO` -> Contacto do Encarregado (Mapeia para `encarregado_telefone`)
  * `EMAIL_ENCARREGADO` -> E-mail do Encarregado (Mapeia para `encarregado_email`)
  * `TURMA_CODIGO` -> Código da Turma (Obrigatório - Mapeia para `turma_codigo`, deve bater com a nomenclatura do Step 3)

### B) Planilha de Professores e Atribuições (`06_professores_atribuicoes_template.xlsx`)
Esta planilha possui duas abas operacionais distintas que devem ser processadas de forma correlacionada:

#### Aba 1: Lista de Professores (`Lista_Professores` - Index `1`)
* **Estrutura de Linhas:**
  * Linha 1 a 3: Títulos, instruções e categorias (ignorar no parser)
  * **Linha 4 (Index 3): Linha de Cabeçalhos**
  * **Linha 5 (Index 4) em diante: Dados Reais**
* **Mapeamento de Colunas (Header Row 4):**
  * `Nome*` -> Mapeia para `NOME_COMPLETO` (Obrigatório, sanitizar asterisco)
  * `Email*` -> Mapeia para `EMAIL` (Obrigatório)
  * `Telefone*` -> Mapeia para `TELEFONE` (Obrigatório)
  * `Género*` -> Mapeia para `GENERO` (Obrigatório - `"M"` ou `"F"`)
  * `Data de Nascimento*` -> Mapeia para `DATA_NASCIMENTO` (Obrigatório)
  * `BI*` -> Mapeia para `BI_NUMERO` (Obrigatório)
  * `Habilitações*` -> Mapeia para `HABILITACOES` (Obrigatório)
  * `Área de Formação*` -> Mapeia para `AREA_FORMACAO`
  * `Vínculo Contratual*` -> Mapeia para `TIPO_VINCULO`
  * `Turnos Disponíveis` -> Mapeia para `TURNOS` (ex: `"M, T"`)
  * `Carga Horária Máxima` -> Mapeia para `CARGA_MAXIMA`

#### Aba 2: Mapa de Atribuições (`Mapa_Atribuicoes` - Index `3`)
Esta aba define a alocação de tempos docentes nas turmas configuradas.
* **Estrutura de Linhas:**
  * Linha 1 a 3: Instruções e exemplos (ignorar no parser)
  * **Linha 4 (Index 3): Linha de Cabeçalhos**
  * **Linha 5 (Index 4) em diante: Dados Reais**
* **Mapeamento de Colunas (Header Row 4):**
  * `Professor*` -> Nome do Professor (chave de relacionamento com a Aba 1)
  * `Turma*` -> Código da Turma
  * `Disciplina*` -> Nome/Código da Disciplina
  * `Carga Horária Semanal*` -> Carga horária
  * `Diretor de Turma* (Sim/Não)` -> Mapeia se é DT (`true`/`false`)

---

### 7.3 Diretrizes para os Parsers (Backend `utils.ts` e Frontend)

Para evitar erros e simplificar a UX, o código do parser em [utils.ts](file:///Users/gundja/moxi-edtech/apps/web/src/app/api/migracao/utils.ts) e o validador no front-end devem seguir estas regras:
1. **Limpeza de Cabeçalhos (Sanitizer):** Remover espaços em branco, acentuação e o caractere asterisco `*` de todos os cabeçalhos lidos (ex: `"Género*"` deve ser normalizado para `"GENERO"` antes da validação).
2. **Pular Linhas de Cabeçalho (Offset):** Forçar o XLSX reader a iniciar a leitura das colunas na linha 4 (index 3) para ignorar os blocos de instruções do Kit Onboarding.
3. **Mapeamento Multi-Aba (Professores):** Ao fazer o processamento da planilha de professores, a API deve ler a aba `Lista_Professores` para criar os perfis dos docentes, e em seguida ler a aba `Mapa_Atribuicoes` para criar as relações de alocações na base de dados, unindo-as pelo campo `Nome/Professor`.

---

## 8. Sprints de Evolução Operacional — Mitigação de Gargalos [CONCLUÍDO]

Para levar a escola a 100% de prontidão operacional sem fricção extrema, definimos e implementamos duas frentes de auto-resolução de bloqueadores críticos diretamente nas telas de status do sistema:

### Sprint EVO-1: Auto-Associação e Alocação de Docentes em Lote [CONCLUÍDO]

#### Meta
Eliminar a tarefa manual de vincular professores um a um nas disciplinas de cada turma (evitando o bloqueador `TEACHER_ASSIGNMENT_INCONSISTENCY`).

#### Implementação
- **Migration SQL:** `20260701114200_create_auto_assign_teachers.sql` cria a função RPC `auto_assign_school_teachers_by_specialty(p_escola_id)`.
- **Lógica de Match:** O banco varre todas as atribuições vazias e tenta associar professores cujo nome coincida ou contenha o nome da disciplina, executando a associação atômica regulamentar.
- **UI Trigger:** Botão `⚡ Auto-Atribuir Professores` exposto no painel de bloqueadores da tela de Status do Sistema.

---

### Sprint EVO-2: Geração de Horários e Auto-Scheduler [CONCLUÍDO]

#### Meta
Resolver a obrigatoriedade de montar a grade horária semanal do zero (evitando o bloqueador `HORARIOS_PUBLISH_MISSING`).

#### Implementação
- **Algoritmo de Auto-Preenchimento:** Implementado no backend Next.js da rota de auto-resolução.
- **Distribuição e Encaixe:** Para cada turma sem horários, o sistema recupera os slots do turno respectivo (Matinal, Tarde, Noite) e encaixa de forma linear as disciplinas ativas da turma, vinculando o professor correspondente.
- **Geração e Publicação Direta:** Remove rascunhos anteriores, grava os novos slots em `quadro_horarios` e atualiza a versão para `publicada` automaticamente.
- **UI Trigger:** Botão `⚡ Auto-Gerar Horários` exposto no painel de bloqueadores da tela de Status do Sistema.

---

### Arquitetura Técnica do Auto-Resolve:
- **API Route:** `apps/web/src/app/api/escola/[id]/admin/setup/auto-resolve/route.ts` expõe a chamada POST `{ action: 'teachers' | 'horarios' }`.
- **Integração Visual:** Componente `SistemaStatusModal.tsx` e página `/admin/configuracoes/sistema` atualizados para consumir a API de auto-resolução, apresentando botões de ação contextuais aos bloqueadores de forma fluida.

---

## 9. Riscos se Nada For Feito

- escolas provisionadas continuam a travar no setup
- parceiro continua a usar linguagem incorreta sobre activacao
- onboarding continua a depender de ajuda humana para tarefas repetitivas
- importacao de dados continua a ser fonte de abandono
- readiness operacional continua invisivel para o cliente final

## 10. Definicao de Sucesso

Esta evolucao sera bem-sucedida quando:

- a escola conseguir atravessar onboarding e setup sem perder contexto
- o parceiro conseguir acompanhar o mesmo fluxo com linguagem correcta
- o sistema reduzir erros repetitivos de upload e configuracao
- o go-live passar a ser um marco real, observavel e compreensivel

O sucesso nao e concluir o wizard. O sucesso e levar a escola a operar com confianca.
