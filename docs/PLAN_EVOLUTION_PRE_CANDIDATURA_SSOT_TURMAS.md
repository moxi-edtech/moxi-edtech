# Plano de Evolução — Pré-candidatura sem Acoplamento Prematuro à Turma

data: 2026-06-11
status: proposta
escopo: candidatura online K12, secretaria, funil de admissão, turmas SSOT

## 1. Contexto

O KLASSE trata `public.turmas` como fonte canônica da identidade acadêmica operacional. Uma turma carrega `curso_id`, `classe_id`, `ano_letivo`, `turno`, `capacidade_maxima`, `turma_codigo`, sala e vínculos pedagógicos. A finalização de matrícula também usa `p_turma_id` como entrada canônica e copia da turma os dados acadêmicos oficiais para a candidatura e matrícula.

Por isso, `turma_preferencial_id` não deve ser usado em pré-candidatura quando ainda não há ano letivo/turma oficial preparada. Pré-candidatura deve representar intenção, não vínculo acadêmico.

## 2. Problema a Resolver

Se a pré-candidatura apontar cedo para `turma_preferencial_id`, surgem riscos operacionais:

- vincular interesse comercial a uma turma que ainda pode não existir;
- criar incoerência entre `candidaturas.ano_letivo` e `turmas.ano_letivo`;
- consumir ou sugerir capacidade antes da abertura oficial do ano;
- misturar lead/intenção com reserva de vaga;
- forçar a secretaria a corrigir dados quando as turmas reais forem criadas ou clonadas.

Já houve incidente semelhante com candidatura apontando para turma de outro ano letivo. O bloqueio foi correto, mas mostra que a relação candidatura/turma precisa continuar estrita.

## 3. Princípios

1. Turma é SSOT acadêmico.
2. Pré-candidatura não reserva vaga.
3. Pré-candidatura não tem `turma_preferencial_id`.
4. Pré-candidatura não entra em aprovação, pagamento ou matrícula.
5. Promoção para candidatura oficial deve ser uma operação explícita da secretaria.
6. A candidatura só passa a ter ano/turma oficial quando uma turma real for escolhida.
7. Todo vínculo oficial deve continuar passando pela RPC canônica de admissão/matrícula.

## 4. Modelo Conceitual Proposto

### 4.1 Pré-candidatura

Representa intenção de matrícula futura.

Campos canônicos:

- `status = 'pre_candidatura'`
- `ano_letivo = null`
- `turma_preferencial_id = null`
- `dados_candidato.pre_candidatura = true`
- `dados_candidato.modo_portal_admissoes = 'pre_candidatura_proximo_ano'`

Campos de intenção:

```json
{
  "interesse": {
    "curso_id": "uuid-ou-null",
    "curso_nome": "texto opcional",
    "classe_id": "uuid-ou-null",
    "classe_nome": "texto opcional",
    "turno": "M|T|N|null",
    "ano_alvo_label": "Próximo ano letivo"
  }
}
```

Observação: se `curso_id` e `classe_id` forem catálogos estáveis da escola, podem ser usados como intenção. Eles não devem ser interpretados como vínculo acadêmico oficial até a promoção.

### 4.2 Candidatura Oficial

Representa entrada formal no funil operacional.

Campos obrigatórios após promoção:

- `status IN ('submetida', 'pendente')`
- `ano_letivo IS NOT NULL`
- `turma_preferencial_id IS NOT NULL`
- `curso_id`, `classe_id`, `turno` sincronizados a partir de `public.turmas`

Fluxo canônico após promoção:

`submetida/pendente -> aguardando_pagamento -> aguardando_compensacao -> matriculado`

## 5. Decisão Arquitetural

Criar uma transição explícita:

`pre_candidatura -> candidatura oficial`

Nome sugerido:

`public.admissao_promover_pre_candidatura(...)`

Assinatura proposta:

```sql
public.admissao_promover_pre_candidatura(
  p_escola_id uuid,
  p_candidatura_id uuid,
  p_turma_id uuid,
  p_observacao text default null,
  p_idempotency_key text default null
) returns jsonb
```

Responsabilidades da RPC:

- validar escola e permissões via rota;
- bloquear se status atual não for `pre_candidatura`;
- buscar `public.turmas` com `FOR UPDATE`;
- validar que turma pertence à escola;
- validar que turma tem `curso_id` e `ano_letivo`;
- copiar `curso_id`, `classe_id`, `ano_letivo`, `turno` e `turma_preferencial_id`;
- mudar status para `submetida` ou `pendente`;
- registrar `candidaturas_status_log`;
- registrar audit log;
- preservar `dados_candidato.interesse` como histórico;
- gravar metadata `promovida_de_pre_candidatura = true`;
- ser idempotente.

## 6. Etapas de Implementação

### Fase 1 — Blindagem do Estado Atual

Objetivo: garantir que pré-candidatura não escapa para funil oficial.

Tarefas:

- Manter bloqueio em `/api/secretaria/admissoes/approve`.
- Manter bloqueio em `/api/secretaria/admissoes/convert`.
- Garantir que formulário público envie `turma_preferencial_id = null` quando `modo_portal_admissoes = pre_candidatura_proximo_ano`.
- Garantir que API pública ignore turma em pré-candidatura, mesmo se payload malicioso enviar UUID.
- Garantir que radar e inbox exibam pré-candidaturas em fila própria.

Critério de aceite:

- uma pré-candidatura não pode ser aprovada;
- uma pré-candidatura não pode ser convertida;
- uma pré-candidatura não ocupa vaga;
- uma pré-candidatura aparece em filtro próprio da secretaria.

### Fase 2 — Formalizar Campos de Intenção

Objetivo: separar campos oficiais de campos comerciais/operacionais de interesse.

Tarefas:

- Ajustar `AdmissionForm` para usar linguagem de interesse, não turma.
- Gravar intenção em `dados_candidato.interesse`.
- Revisar se `curso_id` continuará obrigatório em pré-candidatura.
- Se `curso_id` for mantido, documentar que em `pre_candidatura` ele representa nível de interesse, não vínculo acadêmico final.
- Se necessário, adicionar campos top-level futuros somente depois de estabilizar o modelo.

Critério de aceite:

- UI não chama “turma preferencial” no fluxo de pré-candidatura;
- payload e banco não gravam `turma_preferencial_id`;
- a secretaria consegue filtrar/ler interesse sem abrir tela de matrícula.

### Fase 3 — Promoção Operacional

Objetivo: permitir que a secretaria transforme pré-candidaturas em candidaturas oficiais quando o ano/turmas estiverem preparados.

Tarefas:

- Criar RPC `admissao_promover_pre_candidatura`.
- Criar rota `POST /api/secretaria/admissoes/[id]/promover`.
- Exigir `Idempotency-Key`.
- Exigir role de secretaria/admin na escola.
- Reusar `/api/secretaria/admissoes/vagas` para selecionar turma real.
- Adicionar botão no Inbox: `Promover para candidatura`.
- Abrir modal/sheet com seleção de turma oficial.
- Mostrar diferença entre intenção original e turma escolhida.

Status destino sugerido:

- `submetida` se documentos não forem obrigatórios ou já estiverem completos;
- `pendente` se a escola exige documentos e faltam itens obrigatórios.

Critério de aceite:

- a promoção copia dados da turma real;
- a candidatura passa a ter `ano_letivo` e `turma_preferencial_id`;
- a candidatura entra no funil oficial;
- logs e auditoria mostram quem promoveu e para qual turma.

### Fase 4 — Operação em Massa

Objetivo: evitar gargalo quando houver muitas pré-candidaturas.

Tarefas:

- Adicionar filtro por curso/classe/turno de interesse.
- Adicionar ação em lote “pré-selecionar turma”.
- Permitir promoção em lote com revisão antes de confirmar.
- Bloquear lote se turma ficar sem capacidade, exceto fluxo de lista de espera.
- Gerar relatório de pré-candidaturas não promovidas.

Critério de aceite:

- secretaria consegue processar volume alto sem abrir uma a uma;
- sistema deixa claro quais foram promovidas, bloqueadas ou pendentes.

## 7. Regras de Dados

### Constraints

Manter:

```sql
status IN ('rascunho', 'pre_candidatura')
OR (curso_id IS NOT NULL AND ano_letivo IS NOT NULL)
```

Adicionar, se ainda não existir:

```sql
CHECK (
  status <> 'pre_candidatura'
  OR turma_preferencial_id IS NULL
)
```

Avaliar constraint futura:

```sql
CHECK (
  status <> 'pre_candidatura'
  OR ano_letivo IS NULL
)
```

Essa constraint só deve ser adicionada depois de auditar dados existentes.

### Índices

Pré-candidatura com `ano_letivo IS NULL` precisa de índices próprios de deduplicação, porque unique index com coluna `NULL` não bloqueia duplicados no Postgres.

Índices esperados:

- documento normalizado por escola/curso;
- contato do responsável + nome normalizado por escola/curso;
- telefone do candidato + nome normalizado por escola/curso.

## 8. UI/UX Operacional

### Portal Público

Texto deve deixar claro:

- “pré-candidatura” não é matrícula;
- não há reserva de vaga;
- a escola entrará em contato quando o período oficial abrir;
- dados de interesse podem ser ajustados pela secretaria.

Evitar termos:

- “turma preferencial”;
- “vaga reservada”;
- “pagamento”;
- “matrícula iniciada”.

### Secretaria

Fila dedicada:

- `Pré-candidaturas`

Detalhe deve mostrar:

- dados do candidato;
- responsável;
- interesse declarado;
- data de entrada;
- protocolo;
- ação `Promover para candidatura`.

Ao promover:

- escolher ano/turma real;
- mostrar curso/classe/turno vindos da turma;
- alertar se diferem do interesse original;
- pedir observação opcional.

## 9. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Pré-candidatura virar matrícula por atalho | Bloqueios em approve/convert + RPC de promoção |
| Duplicados com `ano_letivo IS NULL` | Índices parciais específicos |
| Gargalo de promoção manual | Fase 4 com operação em lote |
| Confusão entre curso oficial e interesse | `dados_candidato.interesse` + copy claro na UI |
| Turma escolhida sem preço | Reusar validação de vagas/orçamento antes de promoção ou antes de aprovação |
| Capacidade consumida cedo | Pré-candidatura não entra na ocupação/reserva |

## 10. Validação Técnica

Testes mínimos:

- Criar pré-candidatura pública sem turma e sem ano letivo.
- Tentar aprovar pré-candidatura: deve retornar 400.
- Tentar converter pré-candidatura: deve retornar 400.
- Criar duplicado por documento: deve retornar protocolo/erro amigável.
- Promover pré-candidatura com turma válida: deve virar candidatura oficial.
- Promover com turma de outra escola: deve falhar.
- Promover com turma sem `ano_letivo`: deve falhar.
- Promover duas vezes com mesma idempotency key: deve retornar mesmo resultado.

Validação de banco:

- constraint permite `pre_candidatura` sem `ano_letivo`;
- constraint bloqueia `pre_candidatura` com `turma_preferencial_id`;
- índices parciais existem;
- logs são gravados em `candidaturas_status_log`.

## 11. Rollout

1. Aplicar constraints e índices em produção.
2. Ativar modo `pre_candidatura_proximo_ano` apenas em uma escola piloto.
3. Monitorar volume, duplicados e tempo de atendimento.
4. Liberar UI de promoção individual.
5. Só depois implementar promoção em lote.

## 12. Pendências de Decisão

1. `curso_id` deve continuar obrigatório em pré-candidatura ou deve virar apenas `dados_candidato.interesse.curso_id`?
2. Classe de interesse deve usar `classe_id` ou texto livre?
3. Status após promoção deve ser sempre `submetida` ou depender de documentos obrigatórios?
4. Pré-candidatura deve expirar automaticamente após abertura do ano?
5. A secretaria precisa de campanha/WhatsApp em lote para chamar pré-candidatos?

## 13. Recomendação

Consolidar o modelo com esta regra:

> Pré-candidatura guarda intenção. Candidatura oficial guarda vínculo acadêmico. Turma só entra quando a escola escolhe uma turma real do ano letivo real.

Essa separação preserva `turmas` como SSOT e reduz trabalho operacional futuro, especialmente na virada de ano letivo.
