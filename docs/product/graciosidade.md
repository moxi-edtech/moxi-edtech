# Graciosidade no KLASSE

**Status:** padrão canônico de produto e engenharia  
**Data:** 2026-10-01  
**Escopo:** todos os fluxos KLASSE — secretaria, académico, financeiro, administração, professor, aluno e operações.

## Definição

No KLASSE, um fluxo é **gracioso** quando o utilizador consegue entender o estado atual, saber o próximo passo e concluir a tarefa sem surpresas, perda de dados ou dependência desnecessária de suporte.

Graciosidade não é apenas uma interface bonita. É a combinação de:

> **clareza + contexto + ação segura + feedback + recuperação**

Definição curta:

> **Graciosidade no KLASSE é transformar cada estado do sistema em uma orientação clara, segura e recuperável para a próxima ação correta.**

Este documento é a referência canônica. Sprints e documentos anteriores que usam o termo "graciosidade" devem ser interpretados à luz deste padrão.

---

## 1. Princípios obrigatórios

### 1.1 O sistema sempre explica o estado

O utilizador precisa saber se algo está:

- disponível;
- em edição;
- a guardar;
- guardado;
- pendente de aprovação;
- aprovado;
- rejeitado;
- bloqueado;
- expirado;
- com erro;
- offline.

Nunca deixar apenas um botão desabilitado sem explicação.

Quando houver estado intermediário, a interface deve distingui-lo claramente do estado final.

Exemplo:

```text
Comprovativo enviado
→ Em verificação
→ Pagamento confirmado
```

Nunca:

```text
Comprovativo enviado
→ Pagamento confirmado
```

se a confirmação real ainda não ocorreu.

---

### 1.2 Cada bloqueio apresenta o próximo passo

Um bloqueio sem ação é uma falha de produto.

Exemplos:

```text
Trimestre fechado
→ Solicitar reabertura à escola
```

```text
Pagamento pendente
→ Enviar comprovativo
→ Falar com a secretaria
```

```text
Documento inválido
→ Explicar o formato aceito
→ Permitir novo envio
```

O padrão mínimo para estados bloqueados é:

```text
motivo
+ impacto
+ próxima ação disponível
```

---

### 1.3 O sistema preserva o trabalho

Sempre que tecnicamente e legalmente seguro, o KLASSE deve preservar dados preenchidos, seleções, contexto e progresso em caso de:

- timeout;
- refresh;
- perda de conexão;
- erro de validação;
- sessão expirada;
- duplo clique;
- falha temporária do backend.

Preservação de trabalho não significa salvar indiscriminadamente dados sensíveis no browser.

Para informação sensível ou multiutilizador, preferir rascunho server-side com escopo explícito:

```text
tenant_id
user_id
flow
entity_id
schema_version
expires_at
payload
```

Persistência local deve ser limitada a dados apropriados, possuir expiração e nunca atravessar silenciosamente utilizadores, escolas ou sessões.

---

### 1.4 Toda ação importante dá feedback

Depois de uma ação, o sistema precisa comunicar:

- o que foi salvo;
- o que não foi salvo;
- o que está pendente;
- quem precisa agir;
- quando aplicável, quando a ação estará concluída;
- o próximo passo.

"Salvar agora" não pode terminar sem confirmação explícita de sucesso, pendência ou erro.

Feedback visual otimista nunca deve substituir confirmação real do domínio.

---

### 1.5 Retry é seguro

Tentar novamente não pode:

- duplicar matrícula;
- duplicar candidatura;
- duplicar pagamento;
- criar duas solicitações;
- redefinir credenciais;
- sobrescrever uma ação já concluída;
- gerar dois documentos oficiais equivalentes sem intenção explícita.

Toda operação relevante deve ser idempotente.

Padrão preferido para operações críticas:

```text
idempotency_key
+ constraint/índice único no Postgres
+ tratamento explícito de replay
```

A proteção precisa existir no backend. Desabilitar botão no frontend não é garantia de idempotência.

---

### 1.6 O sistema não promete o que não fez

Exemplos proibidos:

- "enviado" quando apenas abriu o WhatsApp;
- "portal liberado" quando a ativação falhou;
- "pagamento confirmado" quando apenas foi enviado o comprovativo;
- "aula em andamento" apenas porque o horário começou;
- "documento emitido" enquanto o job ainda está processando.

A interface deve distinguir:

```text
intenção
→ processamento
→ confirmação persistida
```

A fonte de verdade deve estar no domínio/backend, não no estado local da UI.

---

### 1.7 O contexto acompanha o utilizador

Ao abrir ou continuar uma ação, devem ser preservados quando aplicáveis:

- escola;
- ano letivo;
- turma;
- disciplina;
- trimestre;
- aluno;
- ocorrência;
- perfil;
- origem da ação;
- filtros relevantes;
- entidade que iniciou o fluxo.

O utilizador não deve reconstruir o contexto manualmente ao navegar entre etapas relacionadas.

Padrão mental:

```text
Escola / Ano letivo / Entidade / Estado / Próxima ação
```

---

### 1.8 O fluxo respeita o papel de cada pessoa

O mesmo estado pode produzir ações diferentes conforme o papel.

Exemplos:

- **Professor:** solicitar reabertura, lançar nota, finalizar aula.
- **Secretaria:** revisar, aprovar, corrigir, emitir documento.
- **Admin escola:** decidir exceções e acompanhar indicadores.
- **Financeiro:** validar pagamentos, cobranças e pendências.
- **Aluno:** consultar, enviar pedido e acompanhar estado.

A UI pode adaptar as ações ao papel, mas **não é a camada de segurança**.

Regra arquitetural:

```text
RLS / backend = autoridade final de segurança
domínio = calcula capabilities e regras
UI = apresenta somente ações aplicáveis
```

Evitar espalhar lógica de autorização duplicada em múltiplas bibliotecas e condicionais React.

---

### 1.9 Mobile é uma experiência completa

No mobile:

- não pode haver filtros duplicados;
- botões precisam estar acessíveis;
- ações principais devem ficar visíveis;
- textos devem ser curtos;
- cards devem mostrar estado e próximo passo;
- tabelas devem virar cartões, listas ou outra apresentação adequada;
- nenhum fluxo pode depender de hover;
- nenhuma ação essencial pode depender de largura desktop;
- modais e drawers devem respeitar teclado, foco e viewport.

Mobile não é "desktop comprimido".

---

### 1.10 O fluxo termina com uma conclusão clara

Ao finalizar uma tarefa, o utilizador deve ver:

- resultado;
- identificador, número ou protocolo quando existir;
- próximos passos;
- pendências restantes;
- opção de voltar;
- opção de continuar para a tarefa seguinte quando fizer sentido.

Uma tela que simplesmente fecha ou redireciona sem explicar o resultado não conclui o fluxo de forma graciosa.

---

## 2. Contrato mental de qualquer fluxo

Todo fluxo relevante deve poder ser explicado como:

```text
contexto
→ estado atual
→ ação possível
→ processamento
→ resultado real
→ próximo passo
→ recuperação
```

Antes de implementar uma nova funcionalidade, a equipa deve conseguir responder cada etapa acima.

---

## 3. Exemplo: Balcão de Atendimento

O Balcão da Secretaria é uma referência central porque cruza aluno, matrícula, financeiro, documentos e operações administrativas.

Fluxo desejado:

```text
Aluno identificado
→ motivo do atendimento
→ situação atual apresentada
→ ações disponíveis
→ execução
→ confirmação real
→ protocolo / próximo passo
```

O funcionário não deveria precisar entender:

- nome de tabela;
- RPC;
- fila;
- RLS;
- status interno;
- regra técnica;
- integração subjacente.

A complexidade continua existindo, mas o KLASSE a traduz em orientação operacional.

Exemplo:

```text
Há uma propina pendente.
A declaração não pode ser emitida neste momento.

Próximas ações:
- Regularizar pagamento
- Solicitar exceção
- Voltar ao atendimento
```

---

## 4. Verdade do domínio antes da interface

A ordem de autoridade é:

```text
Postgres / domínio
        ↓
verdade persistente
        ↓
Server Action / API / RPC
        ↓
resultado estruturado
        ↓
estado de interação da UI
        ↓
feedback + próxima ação
```

Bibliotecas de frontend não podem decidir que uma operação de negócio terminou.

Exemplos:

- XState não confirma pagamento.
- TanStack Query não confirma pagamento.
- Zustand não confirma matrícula.
- estado React não confirma emissão fiscal.

Essas ferramentas podem representar o estado de interação. A confirmação pertence ao backend e ao dado persistido.

---

## 5. Contrato padrão de resultado

Operações relevantes devem convergir para um resultado estruturado equivalente a:

```ts
type KlasseActionResult<T> =
  | {
      ok: true
      status: 'completed'
      data: T
      message: string
      nextAction?: NextAction
      traceId: string
    }
  | {
      ok: true
      status: 'pending'
      message: string
      nextAction?: NextAction
      traceId: string
    }
  | {
      ok: false
      status: 'blocked'
      code: string
      message: string
      reason: string
      nextAction: NextAction
      traceId: string
    }
  | {
      ok: false
      status: 'error'
      code: string
      message: string
      retryable: boolean
      traceId: string
    }
```

O nome e a implementação final podem variar. O contrato semântico não.

Cada operação importante deve responder:

1. O que aconteceu?
2. Terminou ou continua?
3. Por que bloqueou?
4. O que o utilizador pode fazer agora?
5. Pode repetir com segurança?
6. Como a operação pode ser rastreada?

---

## 6. Estados explícitos no frontend

Para fluxos simples, preferir tipos discriminados antes de introduzir uma máquina de estados.

Exemplo:

```ts
type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; savedAt: string }
  | { status: 'error'; message: string; retryable: boolean }
```

Ferramentas como `ts-pattern` podem ajudar a exigir tratamento exaustivo dos estados.

Máquinas de estado como XState devem ser usadas apenas quando a complexidade real justificar:

- múltiplos estados intermediários;
- transições condicionais;
- recuperação;
- paralelismo;
- caminhos alternativos;
- eventos concorrentes;
- necessidade de testar o grafo de transições.

Não transformar operações CRUD simples em workflows artificiais.

---

## 7. Estratégia de bibliotecas

Graciosidade é um contrato de produto e domínio. Nenhuma biblioteca é obrigatória por definição.

Adoção deve ser baseada na necessidade observada durante auditoria de fluxo.

### Forte candidato

- **Zod:** contratos e validação.
- **react-hook-form:** formulários complexos.
- **ts-pattern:** tratamento exaustivo de estados.
- **Playwright:** testes ponta a ponta e falhas deliberadas.
- **MSW:** simulação controlada de 409, 422, 500, timeout e respostas intermediárias.

### Usar quando houver justificativa

- **next-safe-action:** commands tipados e middleware quando simplificar o padrão real do projeto.
- **TanStack Query:** dados interativos, cache de servidor e mutations que realmente se beneficiem dele.
- **XState:** workflows complexos, não ações simples.
- **Supabase Queues / pgmq:** processamento durável e assíncrono.
- **Inngest / Trigger.dev:** somente se houver necessidade que não esteja coberta pela infraestrutura existente.
- **Vaul / Radix / React Aria:** comportamento acessível e UX mobile quando aplicável.

### Exigem cuidado

- **CASL:** evitar duplicar autorização se RLS + domínio já forem suficientes.
- **Zustand persist / localForage:** não persistir dados sensíveis ou multi-tenant indiscriminadamente no browser.
- **supa_audit:** útil como auditoria genérica, mas não substitui eventos de domínio.
- **Serwist/PWA:** offline write exige estratégia própria de conflito, replay, segurança e sincronização.

Regra:

> Não adicionar dependência para resolver um problema que ainda não foi demonstrado no fluxo real.

---

## 8. Server Actions, queries e máquinas de estado

Evitar empilhar abstrações sem necessidade.

### Ação simples

```text
form
→ action
→ domínio
→ result
```

### Dados interativos/cache

```text
UI
→ TanStack Query
→ API/action
→ domínio
```

### Workflow complexo

```text
UI
→ state machine
→ commands/queries
→ domínio
```

Não usar automaticamente XState + TanStack Query + next-safe-action para toda operação.

---

## 9. Idempotência

Idempotência deve existir onde a repetição causar dano ou inconsistência.

Exemplos:

- matrícula;
- rematrícula;
- candidatura;
- pagamento;
- solicitação;
- emissão de documento;
- publicação;
- geração de credenciais;
- envio de comandos externos importantes.

Proteção preferida:

```text
idempotency_key
+ constraint única
+ transação
+ resposta estável para replay
```

O mesmo pedido repetido deve retornar o resultado anterior ou um estado semanticamente equivalente, sem repetir o efeito.

---

## 10. Processamento assíncrono

Operações assíncronas devem apresentar o estado real.

Exemplo de emissão:

```text
Documento solicitado
→ Em processamento
→ Documento disponível
```

Se ocorrer falha:

```text
Falha ao gerar
→ Tentar novamente
→ Falar com a secretaria
```

Nunca exibir "Documento gerado" antes de o artefacto existir e estar acessível.

Quando pgmq/queue for usado, considerar:

- idempotência;
- visibility timeout;
- número máximo de tentativas;
- dead-letter/recovery;
- correlação com a solicitação original;
- estado persistido observável pela UI.

---

## 11. Auditoria e rastreabilidade

Auditoria técnica genérica não substitui evento de negócio.

Para operações sensíveis, considerar eventos equivalentes a:

```text
event_type
tenant_id
actor_user_id
actor_role
entity_type
entity_id
action
previous_state
next_state
origin
correlation_id
idempotency_key
occurred_at
metadata
```

Exemplo de evento útil:

```text
Pagamento #PAG-392
validado por Maria
no Balcão da Secretaria
às 11:42
referente à propina de setembro
```

é mais útil operacionalmente do que apenas "linha atualizada".

---

## 12. Falhas obrigatórias a testar

Fluxos críticos devem ser testados deliberadamente contra:

- refresh durante preenchimento;
- refresh depois da submissão;
- duplo clique;
- duas abas;
- perda de conexão;
- rede lenta;
- timeout;
- 409;
- 422;
- 500;
- sessão expirada;
- utilizador sem permissão;
- escola/contexto incorreto;
- estado alterado por outro utilizador;
- retry depois de uma operação já concluída;
- mobile real ou viewport representativa.

O objetivo não é apenas "o happy path funciona".

---

## 13. Critério de aceitação

Um fluxo do KLASSE só pode ser considerado gracioso se responder **sim** a estas perguntas:

1. O utilizador sabe onde está?
2. Sabe o que está acontecendo?
3. Sabe o que pode fazer agora?
4. Entende por que algo está bloqueado?
5. Consegue tentar novamente com segurança?
6. O sistema preserva o trabalho?
7. O resultado exibido corresponde ao que realmente ocorreu?
8. O fluxo funciona no mobile?
9. A ação respeita o perfil e a escola?
10. Existe histórico ou rastreabilidade quando necessário?

Se qualquer resposta for "não", o fluxo ainda possui dívida de produto.

---

## 14. Gate de review

Ao revisar uma funcionalidade ou PR que altera um fluxo de utilizador, verificar:

- [ ] estados explícitos;
- [ ] bloqueios com motivo e próxima ação;
- [ ] feedback de sucesso, pendência e erro;
- [ ] nenhuma mensagem de sucesso antes da confirmação real;
- [ ] contexto preservado;
- [ ] retry seguro;
- [ ] idempotência no backend quando necessária;
- [ ] rascunho/preservação apropriados;
- [ ] isolamento por escola/tenant;
- [ ] ações coerentes com papel/capabilities;
- [ ] mobile utilizável;
- [ ] conclusão clara;
- [ ] rastreabilidade onde necessária;
- [ ] cenários de falha testados.

---

## 15. Método de melhoria dos fluxos existentes

Não começar instalando bibliotecas ou redesenhando telas isoladamente.

Para cada fluxo:

### 1. Reconstruir o fluxo atual

Mapear:

- ponto de entrada;
- contexto;
- estados;
- ações;
- mutations;
- RPCs/APIs;
- redirects;
- loaders;
- erros;
- estados terminais;
- comportamento mobile;
- permissões.

### 2. Avaliar contra os 10 critérios

Encontrar:

- botão desabilitado sem explicação;
- estado ambíguo;
- erro sem recuperação;
- perda de contexto;
- falso sucesso;
- ausência de idempotência;
- perda de trabalho;
- fluxo inacessível no mobile;
- autorização duplicada ou inconsistente.

### 3. Desenhar o fluxo desejado

Antes de alterar código, descrever:

```text
estado
→ ação
→ processamento
→ feedback
→ próxima ação
→ recuperação
```

### 4. Corrigir frontend e backend juntos quando necessário

Não mascarar deficiência de domínio com toast, loading ou mensagem bonita.

### 5. Testar falhas deliberadamente

Executar os cenários da seção 12.

### 6. Considerar concluído somente após o gate

Passar pelos 10 critérios e registrar evidência.

---

## 16. Ordem inicial de auditoria

A primeira rodada de Gracefulness Audit deve cobrir:

1. Balcão de Atendimento da Secretaria;
2. Emissão de documentos;
3. Pagamentos;
4. Lançamento de notas;
5. Atribuição de professores;
6. Horários;
7. Configurações.

Sugestão de inventário:

| Fluxo | Estado atual | Fricção | Risco | Lacunas de graciosidade | Próxima ação |
|---|---|---|---|---|---|
| Balcão | a auditar | a medir | a medir | a identificar | mapear |
| Documentos | a auditar | a medir | a medir | a identificar | mapear |
| Pagamentos | a auditar | a medir | a medir | a identificar | mapear |
| Notas | a auditar | a medir | a medir | a identificar | mapear |
| Professores | a auditar | a medir | a medir | a identificar | mapear |
| Horários | a auditar | a medir | a medir | a identificar | mapear |
| Configurações | a auditar | a medir | a medir | a identificar | mapear |

Não preencher avaliação por suposição. A auditoria deve usar o código e, quando necessário, comportamento real da aplicação.

---

## 17. Relação com documentos existentes

Este padrão consolida e amplia princípios já aplicados em documentos como:

- `docs/SPRINT_5_FLUXOS_GRACIOSOS_ADMISSAO_MATRICULA_REMATRICULA_2026-08-13.md`;
- `docs/SPRINT_PUBLICACAO_ACADEMICA.md`;
- `docs/design-tokens.md`.

Os documentos de sprint continuam registrando escopo e evidências históricas. Este arquivo define a regra transversal de produto.

---

## 18. Não objetivos

Este padrão não determina:

- uma biblioteca de state machine obrigatória;
- uma biblioteca única de forms;
- um framework de autorização no frontend;
- persistência local para todos os formulários;
- offline-first para todas as áreas;
- conversão de todo CRUD em workflow;
- substituição das regras de RLS;
- alteração automática de fluxos existentes sem auditoria.

A decisão técnica deve seguir o problema real observado.

---

## 19. Regra final

> O utilizador não deve precisar compreender a complexidade interna do KLASSE para concluir corretamente uma tarefa.

RLS, filas, RPCs, integrações, validações, estados fiscais, regras académicas e transações podem ser complexos internamente.

A experiência deve continuar clara:

```text
onde estou
→ o que está acontecendo
→ o que posso fazer
→ o que aconteceu
→ o que faço agora
```
