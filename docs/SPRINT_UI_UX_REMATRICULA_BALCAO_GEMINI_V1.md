# KLASSE — Sprint UI/UX Rematrícula Monetizada no Balcão V1

Estado: **IMPLEMENTADO — revisão e hardening concluídos; E2E visual pendente**  
Backend disponível: `POST /api/secretaria/balcao/rematriculas`  
Escola piloto: **Escola do Curtume**  
Ano operacional: **2026/2027**

## Resultado da implementação — 2026-08-06

- card de rematrícula integrado no dossier do Balcão;
- rematrícula também disponível no catálogo de operações escolares;
- modal wizard com selecção de turma, pagamento e sucesso;
- estados `READY`, `DEBT_BLOCKED`, `PRICE_NOT_CONFIGURED`, `ALREADY_COMPLETED`, `PAYMENT_IN_PROGRESS` e `RECONCILIATION_REQUIRED`;
- validação frontend de turma obrigatória;
- acções de dívidas, Emolumentos e reconciliação ligadas a destinos operacionais;
- acessibilidade base do modal implementada (`role=dialog`, foco, Escape condicionado e alertas).

Pendente: teste visual autenticado no Balcão do Curtume e confirmação dos destinos operacionais com a secretaria.

## 1. Objetivo

Criar no Balcão de Atendimento um fluxo simples para a secretaria:

```text
Pesquisar aluno
→ abrir dossier
→ escolher turma 2026/2027
→ verificar dívidas
→ confirmar taxa de rematrícula
→ receber pagamento
→ concluir rematrícula
→ imprimir comprovante
```

O aluno já possui matrícula no ano actual. A UI não deve sugerir “criar nova matrícula” nem apresentar o fluxo como admissão.

Nome recomendado na interface:

```text
Confirmar rematrícula 2026/2027
```

## 2. Restrições de produto

- A rematrícula refere-se ao ano actual `2026/2027`.
- A matrícula existente não deve ser duplicada.
- A taxa é configurada em Emolumentos pela escola.
- A taxa é independente da primeira mensalidade.
- Dívidas devem ser regularizadas antes da rematrícula.
- A turma é obrigatória.
- O pagamento deve ser confirmado antes da conclusão.
- O comprovante pertence à matrícula existente após confirmação.

## 3. Ponto de entrada

Integrar no dossier do aluno em:

```text
Balcão de Atendimento → aluno seleccionado → Operações académicas
```

Adicionar um card prioritário, próximo do resumo da matrícula e da situação financeira:

```text
┌──────────────────────────────────────────────┐
│ Rematrícula 2026/2027                         │
│ Matrícula actual encontrada                   │
│ Turma actual: 7ª A                            │
│ Estado: pronta para confirmação                │
│                                              │
│ [Confirmar rematrícula]                       │
└──────────────────────────────────────────────┘
```

Não criar uma página paralela fora do Balcão para o fluxo unitário.

## 4. Estados do card

### `READY`

Aluno tem matrícula activa, não tem dívida e existe turma elegível.

Texto:

```text
Rematrícula disponível
Confirme a permanência do aluno em 2026/2027.
```

CTA: `Confirmar rematrícula`.

### `DEBT_BLOCKED`

Existem mensalidades pendentes.

Texto:

```text
Rematrícula bloqueada
Regularize as dívidas do aluno antes de continuar.
```

Mostrar:

- total em dívida;
- número de mensalidades;
- botão `Ver dívidas`;
- botão `Ir para pagamento`, se o Balcão já suportar essa acção.

Não mostrar o botão de rematrícula como activo.

### `PRICE_NOT_CONFIGURED`

O serviço `SERV_REMATRICULA` está inactivo ou com valor zero.

Texto:

```text
Serviço não configurado
A escola ainda não definiu o emolumento de rematrícula.
```

CTA para utilizador autorizado: `Configurar emolumentos`.

### `ALREADY_COMPLETED`

Já existe rematrícula confirmada para o aluno em 2026/2027.

Mostrar:

- data da confirmação;
- valor pago;
- turma confirmada;
- botão `Ver comprovante`;
- botão `Imprimir comprovante`.

Não mostrar “Confirmar rematrícula” novamente.

### `PAYMENT_IN_PROGRESS`

Existe pedido de pagamento em andamento.

Texto:

```text
Pagamento em andamento
Retome o atendimento existente para evitar cobrança duplicada.
```

CTA: `Retomar pagamento`.

### `RECONCILIATION_REQUIRED`

O pagamento foi confirmado, mas a actualização académica falhou.

Texto:

```text
Pagamento confirmado — acção administrativa pendente
Não cobre novamente. A operação precisa de reconciliação.
```

CTA: `Abrir pendência`.

## 5. Modal de confirmação

Ao clicar em `Confirmar rematrícula`, abrir modal em etapas.

### Etapa 1 — Resumo académico

Título:

```text
Confirmar rematrícula 2026/2027
```

Mostrar:

- nome do aluno;
- número de processo;
- matrícula actual;
- turma actual;
- ano lectivo: `2026/2027`;
- turma destino obrigatória.

Selector de turma:

```text
Turma para 2026/2027 *
[ Seleccionar turma                         ▼ ]
```

Cada opção deve mostrar:

```text
7ª A · Manhã · 24/30 vagas
```

Turmas cheias devem aparecer desactivadas com o texto `Sem vagas`.

### Etapa 2 — Financeiro

Mostrar um resumo não editável do emolumento:

```text
Taxa de rematrícula        25.000 Kz
Primeira mensalidade       Não incluída
Total a pagar              25.000 Kz
```

Se o preço vier como zero ou não estiver configurado, bloquear a continuação.

Se existirem dívidas, não permitir chegar a esta etapa.

### Etapa 3 — Pagamento

Usar os mesmos métodos do Balcão:

- Dinheiro;
- TPA;
- Transferência;
- Multicaixa;
- KWIK.

Campos condicionais:

- TPA: referência obrigatória;
- Transferência: comprovativo obrigatório;
- Multicaixa/KWIK: referência ou gateway quando aplicável.

Antes do botão final, mostrar:

```text
Confirma que recebeu 25.000 Kz e deseja concluir a rematrícula?
```

Botão:

```text
Pagar e concluir rematrícula
```

Durante o pedido:

- desactivar todos os campos;
- mostrar spinner e texto `A processar pagamento e rematrícula…`;
- impedir duplo clique;
- não fechar o modal automaticamente.

## 6. Contrato frontend/backend

Endpoint:

```text
POST /api/secretaria/balcao/rematriculas
```

Headers:

```http
Content-Type: application/json
Idempotency-Key: <uuid>
```

Payload:

```ts
{
  aluno_id: string;
  matricula_id: string;
  ano_letivo_id: string;       // UUID da sessão 2026/2027
  destino_turma_id: string;
  metodo: "cash" | "tpa" | "transfer" | "mcx" | "kiwk";
  reference?: string | null;
  evidence_url?: string | null;
  gateway_ref?: string | null;
}
```

O frontend não deve enviar o valor. O backend lê o preço configurado em Emolumentos.

Sucesso:

```ts
{
  ok: true;
  pedido_id: string;
  rematricula: {
    matricula_id: string;
    ano_letivo_id: string;
    turma_id: string;
  };
  pagamento: { id: string };
  comprovante: {
    docId: string;
    publicId: string;
    printUrl: string;
  };
}
```

## 7. Tratamento de erros

Mapear os códigos para mensagens humanas:

| Código | Mensagem UI |
|---|---|
| `ACADEMIC_YEAR_REQUIRED` | Seleccione o ano lectivo da operação. |
| `ACADEMIC_YEAR_CLOSED` | Este ano lectivo não aceita alterações. |
| `REMATRICULA_SOURCE_INVALID` | A matrícula actual do aluno não foi encontrada. |
| `REMATRICULA_DEBT_REQUIRED` | Regularize as dívidas antes de rematricular. |
| `REMATRICULA_PRICE_NOT_CONFIGURED` | O emolumento ainda não foi configurado pela escola. |
| `PAYMENT_REQUIRED` | O pagamento não foi confirmado. |
| `PAYMENT_IN_PROGRESS` | Já existe um pagamento em andamento. |
| `REMATRICULA_RECONCILIATION_REQUIRED` | Pagamento confirmado; atendimento enviado para reconciliação. |
| `CROSS_YEAR_ENTITY_MISMATCH` | A turma seleccionada não pertence a 2026/2027. |
| `DOCUMENT_PENDING` | Rematrícula concluída; comprovante pendente de emissão. |

Nunca mostrar stack trace, mensagem SQL ou detalhes internos.

## 8. Resultado de sucesso

Substituir o modal por um estado de conclusão:

```text
✓ Rematrícula concluída

Aluno: João Manuel
Ano: 2026/2027
Turma: 7ª A · Manhã
Pagamento: 25.000 Kz · Dinheiro
Estado: Pago

[Imprimir comprovante] [Abrir comprovante] [Fechar]
```

O botão de impressão deve abrir `comprovante.printUrl` numa nova aba.

Depois de fechar:

- actualizar o dossier sem reload global;
- actualizar estado financeiro;
- mostrar card `ALREADY_COMPLETED`;
- preservar o aluno pesquisado.

## 9. Acessibilidade

- Modal com `role="dialog"` e `aria-modal="true"`.
- Título ligado ao modal com `aria-labelledby`.
- Foco inicial no primeiro campo interactivo.
- Foco devolvido ao botão que abriu o modal ao fechar.
- Erros com `role="alert"`.
- Loading anunciado com `aria-live="polite"`.
- Não usar somente cor para dívida, sucesso ou bloqueio.
- Contraste mínimo 4.5:1.
- Todos os campos devem ter label visível.
- Navegação completa por teclado.
- `Escape` fecha apenas antes da confirmação final.
- Após clicar em pagar, impedir encerramento acidental.

## 10. Regras de implementação

- Usar o `ano_letivo_id` da URL/contexto académico, nunca o ano do computador.
- Não usar cookie ou estado global para guardar o ano.
- Não calcular o preço no cliente.
- Não criar matrícula localmente no frontend.
- Não chamar directamente Supabase para concluir a rematrícula.
- Não reutilizar o fluxo de rematrícula em massa.
- Não fazer optimistic update antes da resposta do backend.
- Gerar um novo `Idempotency-Key` por tentativa real de pagamento.
- Em retry de rede, preservar a mesma chave se a operação não tiver resposta.

## 11. Testes de UI obrigatórios

1. Aluno sem dívida vê o card `READY`.
2. Aluno com dívida não consegue iniciar a rematrícula.
3. Serviço com preço zero mostra configuração pendente.
4. Turma cheia não pode ser seleccionada.
5. Método TPA exige referência.
6. Transferência exige comprovativo.
7. Duplo clique gera apenas uma requisição.
8. Sucesso mostra turma, pagamento e comprovante.
9. Reabertura do aluno mostra `ALREADY_COMPLETED`.
10. Retry com a mesma chave não cobra novamente.
11. Falha pós-pagamento mostra reconciliação e instrui a não cobrar novamente.
12. Navegação por teclado funciona em todo o modal.
13. Em ano histórico/fechado, o CTA fica bloqueado.
14. Duas abas com alunos diferentes não misturam o dossier.

## 12. Definition of Done UI/UX

- [ ] Card integrado no Balcão de Atendimento.
- [ ] Modal de três etapas implementado.
- [ ] Turmas com capacidade e estado visível.
- [ ] Preço carregado do backend, sem hardcode.
- [ ] Dívidas bloqueiam o CTA.
- [ ] Pagamento e rematrícula usam o endpoint dedicado.
- [ ] Loading, erro, retry e reconciliação implementados.
- [ ] Comprovante abre e imprime.
- [ ] Dossier actualiza sem perder o aluno pesquisado.
- [ ] Acessibilidade validada.
- [ ] Testes de UI críticos passam.
