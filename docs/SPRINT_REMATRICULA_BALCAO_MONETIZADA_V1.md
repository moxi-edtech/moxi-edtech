# KLASSE — Sprint Rematrícula no Balcão Monetizada V1

Estado: **IMPLEMENTADO — fluxo operacional, reconciliação e hardening concluídos; E2E autenticado pendente**
Data: **2026-08-11**
Escola piloto: **Escola do Curtume**  
Dependência: `SPRINT_ACADEMIC_YEAR_CONTEXT_V1.md`

## Atualização de implementação — 2026-08-06

Concluído neste ciclo:

- endpoint unitário `POST /api/secretaria/balcao/rematriculas`;
- endpoint de elegibilidade/status do aluno;
- validação central `WRITE` do ano académico;
- validação de matrícula, turma, escola e dívidas;
- bloqueio de preço não configurado;
- idempotência funcional para pedidos pendentes/concluídos;
- pagamento através do motor do balcão;
- actualização da turma da matrícula do ano seleccionado;
- reconciliação explícita quando o pagamento é confirmado e a operação académica falha;
- emissão/reutilização do comprovante;
- auditoria da operação;
- card e modal acessíveis integrados no `BalcaoAtendimento`;
- rematrícula apresentada no catálogo de operações do mesmo balcão.

Validação: TypeScript e `git diff --check` passaram. A base remota foi validada com PostgreSQL.

## Atualização de implementação — 2026-08-10

Concluído neste ciclo:

- fila de reconciliação em `/secretaria/rematricula/reconciliacao`;
- API `GET /api/secretaria/balcao/rematriculas/reconciliation-queue`;
- ação de conclusão de reconciliação no endpoint de rematrícula;
- acesso operacional para `admin`, `admin_financeiro`, `financeiro`, `secretaria` e perfis equivalentes;
- atalhos de reconciliação expostos nos menus de Admin, Financeiro, Operações e Secretaria;
- proteção contra cobrança duplicada em pedidos legados e pedidos pagos pendentes;
- ordenação de mensalidades por competência completa (`ano_referencia + mes_referencia`), evitando Janeiro/2027 antes de Setembro/2026;
- balcão com selector de ano letivo, troca de aluno sem fechar o atendimento e pré-preenchimento do total em pagamentos em dinheiro;
- migration de histórico transitado aplicada, com tabelas, RLS, índices e RPC de gravação;
- documentação do ano letivo como intervalo académico, e não como ano civil.
- bloqueio obrigatório de saldo aberto no Balcão, na rematrícula em massa via RPC e na API alternativa;
- pagamento parcial de mensalidades antigas, sem liberação antecipada da rematrícula;
- enriquecimento dos bloqueios em massa com valor da dívida e quantidade de mensalidades;
- saída graciosa “Regularizar no balcão” e retorno à confirmação com o aluno em contexto;
- indicação “Contexto retomado” após a regularização;
- histórico visual dos pagamentos parciais realizados na sessão.

Validação: PostgreSQL confirmou as tabelas `historico_transitado_anos` e `historico_transitado_notas`, RLS, índices e RPC `upsert_historico_transitado`.

Pendências de produção:

- teste E2E com pagamento real/sandbox;
- confirmação da regra final de alteração de turma na rematrícula;
- validação de concorrência com dois atendentes para o mesmo aluno;
- confirmação das rotas finais de Emolumentos, dívidas e conciliação.
- teste E2E autenticado por perfil (`admin`, `admin_financeiro`, `financeiro`, `secretaria`);
- substituir o campo inteiro `ano_letivo` do histórico transitado por referência explícita a `anos_letivos.id` e apresentar `2025/2026`, `2026/2027`, etc.

## 1. Decisão de produto

O facto de um aluno já estar matriculado no ano letivo corrente não deve transformar a rematrícula num simples botão administrativo sem receita.

O KLASSE deverá oferecer à secretaria um serviço operacional de rematrícula no balcão:

```text
Pesquisar aluno
→ confirmar ano de destino
→ validar elegibilidade
→ escolher turma/condições
→ cobrar serviço de rematrícula
→ criar ou confirmar matrícula do novo ano
→ emitir comprovante
```

A operação deve ser unitária, idempotente, auditável e segura para pagamentos. A matrícula do ano anterior nunca deve ser sobrescrita.

## 2. Problema actual

No Curtume, os alunos já aparecem matriculados no ano letivo actual. Isso resolve a operação académica, mas não cria um momento comercial explícito para:

- cobrar a taxa/serviço de rematrícula;
- confirmar a intenção da família para o ano seguinte;
- garantir a vaga/turma de destino;
- emitir comprovante oficial da nova matrícula;
- deixar evidência financeira e administrativa da operação.

As rotas existentes de rematrícula foram desenhadas principalmente para promoção/rematrícula em massa. O balcão precisa de um fluxo individual com pagamento imediato e comprovante.

## 3. O que já existe

### Componentes reutilizáveis

- Pesquisa e dossier do aluno no `BalcaoAtendimento`.
- Pagamentos no balcão em `/api/secretaria/balcao/pagamentos`.
- Contexto académico por `ano_letivo_id`.
- Rematrícula em massa em `/api/secretaria/rematricula`.
- Confirmação em massa em `/api/secretaria/rematricula/confirmar`.
- Geração opcional de mensalidades por sessão.
- Catálogo de serviço `DOC_COMPROVANTE_MATRICULA`.
- Emissão idempotente via `emitirComprovanteMatricula`.
- Auditoria com `recordAuditServer`.

### Limitações identificadas

- Não existe uma operação unitária “rematricular e pagar” no balcão.
- O pagamento do balcão não confirma, por si só, uma matrícula de destino.
- A emissão de comprovante existente depende de uma matrícula já efectivada.
- O fluxo em massa não é adequado para atendimento individual, cobrança imediata e reimpressão.
- A taxa/preço da rematrícula ainda não está definida como regra de produto.

## 4. Objectivo V1

Permitir que uma secretária conclua uma rematrícula individual no balcão, para um ano de destino válido:

1. localizar o aluno;
2. ver a matrícula actual e o ano de destino;
3. validar se a rematrícula é permitida;
4. apresentar o valor do serviço;
5. receber o pagamento;
6. criar uma única matrícula no ano de destino;
7. gerar o comprovante oficial;
8. devolver pagamento, matrícula e documento num resultado único.

## 5. Fora do escopo V1

- Pagamento recorrente ou parcelamento da taxa de rematrícula.
- Portal do encarregado/aluno.
- Rematrícula em massa.
- Alteração da matrícula antiga.
- Transferência de aluno entre escolas.
- Negociação automática de dívidas antigas; o operador pode, contudo, registar pagamentos parciais.
- Definição automática de turma sem regra aprovada pela escola.
- Emissão de documentos diferentes do comprovante de matrícula.

### Saída graciosa para dívida

Quando houver saldo aberto, a operação não termina num bloqueio seco. O sistema deve:

1. apresentar o aluno, a quantidade de mensalidades e o saldo total;
2. oferecer “Regularizar no balcão” sem perder o contexto da rematrícula;
3. permitir pagamento parcial, começando pela mensalidade mais antiga;
4. manter o aluno pendente até o saldo ser zero;
5. mostrar o histórico dos pagamentos feitos na sessão;
6. oferecer “Continuar” para voltar à confirmação da rematrícula.

## 6. Decisões confirmadas

As decisões de negócio recebidas para o Curtume são:

- a rematrícula é aberta para o ano actual `2026/2027`;
- o preço é configurado pela escola em Emolumentos;
- as regras de elegibilidade são configuradas pela escola;
- dívidas devem ser totalmente regularizadas antes da rematrícula; pagamentos parciais são permitidos, mas não liberam a operação;
- a turma é obrigatória;
- a taxa de rematrícula é separada da primeira mensalidade.

## 7. Conceito de ano

O fluxo trabalha com dois anos explícitos:

- `origem_ano_letivo_id`: ano em que o aluno está actualmente matriculado;
- `destino_ano_letivo_id`: ano para o qual a rematrícula será criada.

Regra obrigatória:

```text
destino_ano_letivo_id > origem_ano_letivo_id
```

O destino deve ser uma sessão pertencente à escola e acessível ao utilizador. A matrícula de origem é histórica e permanece intacta.

Para o piloto do Curtume, a operação confirmada é:

```text
ano da matrícula confirmada: 2026/2027
tipo da operação: remonetização/confirmacão da matrícula existente
```

Não será criada uma segunda matrícula no mesmo ano. A operação actualiza a turma da matrícula existente, quando necessário, e regista o serviço pago.

## 8. Fluxo operacional detalhado

### Etapa A — Pesquisa

No Balcão de Atendimento, a secretaria pesquisa por:

- nome;
- número de processo;
- BI/documento;
- telefone do encarregado.

O resultado deve mostrar claramente:

- aluno;
- matrícula actual;
- ano actual;
- turma actual;
- situação financeira;
- estado de rematrícula para o destino;
- botão “Rematricular no ano …”.

### Etapa B — Pré-validação

O sistema valida no servidor:

- utilizador autenticado;
- escola resolvida no servidor;
- permissão de secretaria/financeiro;
- origem pertencente à escola;
- destino pertencente à escola;
- destino posterior à origem;
- aluno pertencente à matrícula de origem;
- ausência de matrícula activa duplicada no destino;
- janela/regra de rematrícula, se activada;
- preço configurado para o serviço;
- restrições financeiras definidas pela escola.

Nenhum valor calculado apenas no frontend é confiável.

### Etapa C — Escolha académica

A secretaria poderá:

- escolher turma de destino;
- usar turma sugerida pelo sistema;
- deixar a turma pendente, se a política permitir.

V1 recomendado: exigir turma de destino para criar a matrícula efectiva. A opção “sem turma” deve gerar apenas uma intenção/pedido, e não uma matrícula activa.

### Etapa D — Cobrança

O sistema apresenta:

- nome do serviço: “Taxa de rematrícula 2027/2028”;
- valor configurado;
- método de pagamento;
- referência/comprovativo quando aplicável;
- resumo do aluno e do ano de destino.

O pagamento deve usar a rota financeira do balcão, com:

```json
{
  "aluno_id": "uuid",
  "ano_letivo_id": "uuid",
  "valor": 0,
  "metodo": "cash|tpa|transfer|mcx|kwik",
  "meta": {
    "origem": "rematricula_balcao",
    "destino_ano_letivo_id": "uuid",
    "servico_codigo": "REMATRICULA"
  }
}
```

O pagamento de rematrícula não deve ser confundido com uma mensalidade. Deve possuir referência explícita ao serviço e ao ano de destino.

### Etapa E — Confirmação transaccional

Depois de pagamento confirmado, o servidor confirma a matrícula existente no ano `2026/2027` e actualiza a turma seleccionada.

Resultado esperado:

- uma matrícula activa no ano actual;
- nenhuma alteração destrutiva na origem;
- nenhuma duplicação em repetição do pedido;
- serviço de rematrícula pago;
- comprovante emitível/reutilizável.

Se a criação da matrícula falhar depois do pagamento, o sistema deve criar uma pendência operacional reconciliável. Nunca deve responder “sucesso completo” com apenas o pagamento gravado.

### Etapa F — Comprovante

Emitir comprovante oficial usando o `matricula_id` de destino.

O resultado deve conter:

```json
{
  "ok": true,
  "rematricula": {
    "matricula_id": "uuid",
    "ano_letivo_id": "uuid",
    "status": "ativo"
  },
  "pagamento": {
    "id": "uuid",
    "status": "pago"
  },
  "comprovante": {
    "doc_id": "uuid",
    "public_id": "string",
    "print_url": "/secretaria/documentos/.../comprovante-matricula/print"
  }
}
```

## 9. Contrato de API implementado

Criar uma operação dedicada, preferencialmente:

```text
POST /api/secretaria/balcao/rematriculas
```

Payload mínimo:

```json
{
  "aluno_id": "uuid",
  "matricula_id": "uuid",
  "ano_letivo_id": "uuid",
  "destino_turma_id": "uuid",
  "metodo": "cash",
  "reference": null,
  "evidence_url": null,
  "gateway_ref": null,
  "idempotency_key": "header"
}
```

A operação resolve o tenant e o ano no servidor. `ano_letivo_id` é obrigatório e não existe fallback silencioso.

Erros mínimos:

| Código | Situação |
|---|---|
| `ACADEMIC_YEAR_REQUIRED` | ano não informado |
| `ACADEMIC_YEAR_NOT_FOUND` | destino inexistente/outro tenant |
| `ACADEMIC_YEAR_CLOSED` | destino fechado |
| `REMATRICULA_ALREADY_EXISTS` | matrícula activa já existente no destino |
| `REMATRICULA_SOURCE_INVALID` | origem não pertence ao aluno/escola |
| `CROSS_YEAR_ENTITY_MISMATCH` | turma, matrícula ou período de outro ano |
| `REMATRICULA_PRICE_NOT_CONFIGURED` | serviço sem preço |
| `PAYMENT_REQUIRED` | pagamento não confirmado |
| `REMATRICULA_RECONCILIATION_REQUIRED` | pagamento confirmado, matrícula pendente |

## 10. Idempotência e consistência

A chave de idempotência deve cobrir:

```text
escola + aluno + destino_ano_letivo + serviço
```

Repetir a operação após sucesso deve devolver os mesmos IDs de matrícula, pagamento e comprovante.

Não permitido:

- criar duas matrículas activas no destino;
- cobrar duas vezes a mesma taxa por duplo clique;
- emitir dois comprovantes diferentes para a mesma rematrícula sem motivo;
- actualizar a matrícula da origem para “transferido” como parte normal da rematrícula.

## 11. Preço e monetização

O serviço é configurável pela escola em Emolumentos. Foi criado o código `SERV_REMATRICULA`, com valor inicial `0`; a operação bloqueia enquanto a escola não configurar um valor positivo.

Campos mínimos do catálogo/preçário:

- código: `REMATRICULA`;
- nome apresentado;
- valor;
- moeda;
- ano de destino;
- activo/inactivo;
- permite isenção;
- exige comprovativo;
- data de validade.

Decisões que precisam de confirmação da escola:

1. valor da taxa de rematrícula;
2. se o pagamento é obrigatório antes de criar a matrícula;
3. se alunos com dívida podem rematricular;
4. se a taxa é abatida na primeira mensalidade;
5. se existe preço diferente por ciclo/oferta;
6. se o comprovante é incluído no preço ou cobrado separadamente.

## 12. UI/UX do balcão

### Estado normal

O dossier deve apresentar um card destacado:

```text
Rematrícula 2027/2028
Aluno matriculado em 2026/2027
Taxa: [valor]
Turma de destino: [seleccionar]
[Iniciar rematrícula]
```

### Estados obrigatórios

- já rematriculado: mostrar matrícula, pagamento e comprovante;
- pagamento pendente: permitir retomar sem cobrar novamente;
- pagamento confirmado/matrícula pendente: mostrar pendência de reconciliação;
- ano destino fechado: bloquear com explicação;
- turma destino cheia: mostrar capacidade e alternativas;
- dívida existente: mostrar política da escola, não bloquear silenciosamente;
- comprovante emitido: botão “Imprimir” e “Reabrir comprovante”.

### Acessibilidade

- estado textual, não apenas cor;
- mensagens de erro junto ao campo afectado;
- confirmação explícita antes de cobrar;
- resumo final antes da submissão;
- foco no resultado ou erro após a operação;
- botão desactivado durante processamento;
- prevenção de duplo clique;
- suporte a impressora e nova aba.

## 13. Segurança e auditoria

Toda operação deve registar:

- `actor_id`;
- `escola_id`;
- `aluno_id`;
- `origem_ano_letivo_id`;
- `destino_ano_letivo_id`;
- `origem_matricula_id`;
- `destino_matricula_id`;
- `pagamento_id`;
- `documento_id`;
- `action`;
- `request_id`/idempotency key;
- data/hora.

Tentativas bloqueadas devem registar:

- ano ausente;
- ano cruzado;
- matrícula duplicada;
- preço inexistente;
- turma cheia;
- pagamento falhado;
- reconciliação necessária.

## 14. Fases de implementação

### P0 — Contrato e backend

- [ ] Confirmar ano destino do Curtume.
- [ ] Criar preço/código do serviço de rematrícula.
- [x] Criar `POST /api/secretaria/balcao/rematriculas`.
- [ ] Integrar resolver académico `WRITE`.
- [ ] Validar origem, destino, aluno e turma.
- [ ] Implementar idempotência.
- [x] Integrar pagamento do balcão.
- [x] Integrar confirmação e actualização da turma da matrícula existente.
- [x] Integrar emissão/reutilização do comprovante.
- [x] Criar seed de `SERV_REMATRICULA` com valor inicial configurável.
- [ ] Criar reconciliação para pagamento sem matrícula.

### P1 — Experiência da secretaria

- [ ] Card de rematrícula no dossier do balcão.
- [ ] Selector de turma de destino.
- [ ] Resumo de preço e confirmação de cobrança.
- [ ] Estados de pagamento/matrícula/comprovante.
- [ ] Impressão imediata e reabertura do comprovante.
- [ ] Preservar `ano_letivo_id` entre balcão, pagamento e documento.

### P2 — Operação e escala

- [ ] Relatório de rematrículas pagas, pendentes e reconciliadas.
- [ ] Lista de alunos elegíveis e ainda não rematriculados.
- [ ] Exportação para contabilidade.
- [ ] Reembolso/cancelamento com aprovação.
- [ ] Rematrícula em massa baseada no mesmo serviço unitário.
- [ ] Portal do aluno usando o mesmo ledger.

## 15. Testes obrigatórios

1. Aluno actual rematriculado para o ano seguinte com pagamento e comprovante.
2. Repetição da mesma requisição não duplica cobrança nem matrícula.
3. Ano destino ausente bloqueia com `ACADEMIC_YEAR_REQUIRED`.
4. Ano destino de outra escola não revela existência e bloqueia.
5. Turma destino de outro ano devolve `CROSS_YEAR_ENTITY_MISMATCH`.
6. Aluno já rematriculado devolve resultado idempotente.
7. Pagamento falhado não cria matrícula.
8. Pagamento confirmado e criação falhada gera reconciliação.
9. Comprovante existente é reutilizado.
10. Duas abas não misturam anos ou alunos.
11. Ano fechado bloqueia escrita e UI.
12. Dívida existente segue a política configurada da escola.
13. Turma cheia bloqueia ou exige escolha alternativa.
14. Auditoria contém origem, destino, pagamento e documento.

## 16. Definition of Done

O sprint só fica concluído quando:

- a secretaria pesquisa o aluno no balcão;
- o sistema diferencia matrícula actual de rematrícula futura;
- o ano destino é explícito e validado;
- o valor do serviço é configurado e apresentado;
- o pagamento é registado uma única vez;
- a matrícula do novo ano é criada uma única vez;
- a matrícula antiga permanece preservada;
- o comprovante é emitido ou reutilizado;
- falhas pós-pagamento entram em reconciliação;
- UI e API bloqueiam anos inválidos/encerrados;
- auditoria liga actor, aluno, anos, pagamento e documento;
- testes críticos passam no Curtume com dados reais apenas em ambiente aprovado.

## 17. Alinhamentos ainda necessários

Ainda falta confirmar apenas:

1. quais regras adicionais a escola quer configurar além do bloqueio por dívida;
2. se a rematrícula pode alterar a turma actual ou deve exigir que a turma seleccionada seja a mesma;
3. se a operação deve gerar uma referência comercial visível no recibo fiscal;
4. política de estorno/cancelamento após pagamento.

O preço e as regras de elegibilidade permanecem configuráveis; não foram codificados como valores fixos.
