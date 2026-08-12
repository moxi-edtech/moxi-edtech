# Sprint — Fechar lacunas entre visão e produto KLASSE

**Data:** 2026-08-12  
**Objectivo:** alinhar o que o KLASSE comunica comercialmente com o que está implementado, validado e disponível para uma escola privada angolana.

## Regra principal

Nenhuma funcionalidade deve ser apresentada como concluída apenas porque existe um componente, uma migration ou uma página no repositório. Para ser comunicada como capacidade do produto, deve possuir:

1. fluxo funcional de ponta a ponta;
2. permissões correctas por perfil;
3. dados reais da escola e do ano letivo;
4. estado de erro recuperável;
5. teste de aceitação documentado;
6. validação visual ou operacional no portal correspondente.

## Mapa das lacunas

| Tema comercial | Estado real | Evidência actual | Lacuna principal | Classificação comercial |
|---|---|---|---|---|
| Escola conectada | Parcial | Admissões, financeiro, professor, calendário e activity feed existem | Comunicação entre portais ainda usa canais paralelos | Não vender como integração total |
| Tendências administrativas | Parcial/forte | Matrículas, mensalidades, pagamentos, auditoria, balcão e calendário MED | Falta inbox unificada e realtime consistente | Implementado parcialmente |
| Tendências pedagógicas | Parcial | Notas, frequência, pautas, períodos, materiais e backend de actividades | Falta fechar a experiência visual e a correcção/feedback operacional | Implementado parcialmente |
| Tendências educacionais | Inicial/parcial | Portais, materiais e backend de actividades publicáveis | Aprendizagem híbrida, competências digitais e colaboração docente ainda não estão fechadas | Roadmap controlado |
| IA na educação | Parcial | Radares, cockpit e assistente contextual | Ainda falta camada NotebookLM pedagógica com fontes, geração de actividades e revisão formal | Não vender como IA completa |
| Desafio angolano | Parcial | Kz, calendário MED, mensalidades, matrícula e perfis locais | Offline, conectividade, mobile e AGT precisam de validação específica | Implementado parcialmente |
| Checklist 2026/2027 | Conteúdo | Existem documentos e planos operacionais | Falta checklist executável com progresso, responsáveis e evidências | Conteúdo/roadmap |
| Resposta KLASSE | Mista | Algumas capacidades existem | O texto mistura produto actual, visão e promessa | Reescrever antes de publicar |
| Diagnóstico/demonstração | Comercial | Pode ser oferecido | Deve demonstrar apenas fluxos validados | Permitido com roteiro controlado |

## Afirmações que devem ser corrigidas imediatamente

Até validação adicional, não usar como afirmações de produto concluído:

- “um único canal entre direcção, professores e encarregados”;
- “acompanhamento em tempo real de cada aluno”;
- “aprendizagem adaptativa”;
- “IA pedagógica contextual completa”;
- “quizzes e simulados com correcção automática”;
- “funciona com internet instável/offline”;
- “conformidade AGT” sem indicar exactamente o módulo e o nível de validação;
- “cada tendência corresponde a uma funcionalidade concreta”.

## Sprint proposto — 10 dias úteis

### Dia 1 — Contrato de produto e inventário verificável

- Criar matriz `claim → funcionalidade → rota → API → tabela → teste`.
- Classificar cada afirmação como `VALIDADO`, `PARCIAL`, `ROADMAP` ou `NÃO IMPLEMENTADO`.
- Congelar a versão comercial do guia até a matriz ser revista.

**Saída:** matriz de claims aprovada por produto e engenharia.

### Dias 2–3 — Comunicação operacional unificada

- Unificar o destino das comunicações para `admin_financeiro`.
- Corrigir a separação entre `notifications` e `notificacoes`.
- Activar `admin_activity_events` no Supabase Realtime.
- Garantir fallback por polling e reconciliação após reconexão.
- Entregar no portal financeiro:
  - notas lançadas;
  - pautas fechadas;
  - pagamentos;
  - admissões;
  - documentos.

**Critério de aceite:** uma nota lançada no portal do professor aparece no portal `admin_financeiro` com escola, turma, ano letivo, hora e acção contextual.

### Dias 4–5 — Fila proativa e accionável

- Adicionar contador de novidades não lidas persistente.
- Adicionar prioridade e tipo de evento.
- Definir estados `novo`, `visto`, `em tratamento`, `resolvido`.
- Criar acções por evento:
  - `Ver pauta`;
  - `Ver turma`;
  - `Ver aluno`;
  - `Abrir dívida`;
  - `Rever matrícula`;
  - `Configurar preço`.
- Evitar que a interface chame toda actividade de “pendência”.

**Critério de aceite:** cada evento importante possui próximo passo ou é explicitamente informativo.

### Dias 6–7 — Pedagógico mínimo comprovável

- Fechar o fluxo professor → notas → pauta → admin financeiro/direcção.
- Definir quais dados o financeiro pode ver sem expor notas indevidas.
- Criar pendência clara para:
  - notas incompletas;
  - pauta não fechada;
  - turma sem avaliação configurada.
- Validar o contexto do ano letivo em todas as consultas.

**Critério de aceite:** o sistema mostra a situação real da turma sem misturar anos letivos e sem expor dados fora do papel do utilizador.

### Sprint complementar — Aprendizagem contínua

O backend desta frente foi preparado e aplicado no PostgreSQL remoto nas migrações
`20270812160000_learning_activities_backend.sql` e
`20270812170000_learning_platform_contracts.sql`.
O próximo executor deve fechar a camada de experiência sem alterar o contrato:

- materiais pedagógicos com rascunho, publicação e arquivo;
- actividades do tipo quiz, exercício, tarefa e simulado;
- questões, prazo, tentativas e nota máxima;
- entrega do aluno com possibilidade de guardar e retomar;
- acompanhamento das entregas pelo professor;
- separação absoluta entre actividade e nota oficial;
- mensagens de erro com `next_action` executável.

**Estado:** backend aplicado; UI principal existente; validação ponta a ponta e os workers de IA/badges continuam pendentes.

Também foi aplicada a migração `20260812130000_guardian_learning_visibility.sql`.
O contexto do portal agora resolve alunos ligados ao encarregado e o diário do
professor valida a relação entre professor, turma e aluno antes de gravar.

**Critério de aceite:** professor cria e publica uma actividade para uma turma; aluno guarda, retoma e submete; professor acompanha a entrega; nenhuma etapa deixa o utilizador sem caminho de resolução.

### Dia 8 — IA contextual responsável

- Inventariar as funções de IA já existentes.
- Separar IA administrativa de IA pedagógica.
- Definir fontes de dados permitidas por perfil.
- Mostrar evidência da recomendação:
  - dados utilizados;
  - período analisado;
  - nível de confiança;
  - acção humana sugerida.
- Proibir alteração automática de nota, status ou decisão sensível.

**Critério de aceite:** nenhuma recomendação de IA aparece sem contexto, origem dos dados e indicação de revisão humana.

### Dia 9 — Realidade angolana e preparação do ano

- Testar Curtume e uma escola adicional com:
  - calendário MED;
  - cobrança em Kz;
  - matrícula antes do início do calendário;
  - mensalidade a começar no mês correcto;
  - conectividade degradada;
  - dispositivo móvel.
- Transformar o checklist 2026/2027 em checklist executável no admin:
  - responsável;
  - estado;
  - prazo;
  - evidência;
  - próximo passo.

**Critério de aceite:** o operador consegue preparar o ano letivo e identificar o que falta sem consultar vários documentos externos.

### Dia 10 — Validação comercial e publicação

- Executar smoke tests por perfil:
  - `admin_financeiro`;
  - secretaria;
  - professor;
  - admin.
- Actualizar o guia comercial com etiquetas de estado.
- Criar roteiro de demonstração baseado apenas em fluxos validados.
- Registar limitações conhecidas e roadmap.

**Saída:** versão comercial publicável sem promessas não comprovadas.

## Definição de pronto do sprint

O sprint só é considerado concluído quando:

- o evento de lançamento de nota chega ao `admin_financeiro` em tempo real;
- o fallback funciona quando o websocket falha;
- a fila mostra prioridade, contexto e próximo passo;
- notificações não lidas são persistidas por utilizador;
- os portais respeitam escola e ano letivo;
- IA é descrita com limites e revisão humana;
- o checklist do ano pode ser acompanhado operacionalmente;
- o documento comercial distingue claramente produto actual de roadmap;
- TypeScript, testes e smoke tests passam nos perfis envolvidos.

## Fora do escopo deste sprint

- Construir uma plataforma completa de aprendizagem adaptativa;
- Prometer funcionamento offline sem arquitectura de sincronização e teste real;
- Implementar conformidade AGT completa sem requisitos fiscais fechados;
- Automatizar decisões pedagógicas ou financeiras sensíveis;
- Transformar actividades em notas oficiais automaticamente;
- Apresentar o assistente actual como substituto de um NotebookLM pedagógico;
- Reescrever todos os portais apenas para uniformizar a aparência.

## Estado técnico após a aplicação das migrações

Aplicado e verificado no banco remoto:

- materiais, actividades, questões e entregas;
- fontes pedagógicas e pedidos de IA com revisão humana;
- fila de intervenções pedagógicas;
- catálogo e registo de conquistas;
- diário familiar;
- leitura RLS do diário e conquistas por encarregado vinculado;
- activity feed administrativo com prioridade, acção contextual e Realtime.

Ainda não deve ser comunicado como concluído:

- geração automática de actividades alinhadas ao MED;
- motor automático de badges;
- simulador oficial parametrizado pelo modelo de avaliação da escola;
- sincronização offline com resolução visual de conflitos;
- radar que cria intervenções automaticamente sem confirmação humana.

## Mensagem comercial provisória

Enquanto as lacunas não forem fechadas, a formulação segura é:

> O KLASSE já oferece uma base integrada para gestão administrativa, financeira,
> académica e operacional de escolas privadas angolanas. A comunicação realtime,
> os radares pedagógicos avançados, a inteligência artificial contextual e o
> checklist executável de preparação do ano letivo estão em evolução controlada.
