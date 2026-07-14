# Plano — KLASSE IA Actions v2

## Objetivo

Evoluir o KLASSE IA de assistente de ajuda contextual para copiloto operacional controlado.

O assistente deve continuar explicando o sistema, mas quando detectar uma intenção operacional deve devolver uma resposta com ações seguras para a interface renderizar.

Exemplo:

- Pergunta: `Quem está em atraso na turma 10ª A?`
- Resposta: `Há 12 alunos em atraso, totalizando 480.000 AOA.`
- Ações:
  - `Abrir Radar Financeiro`
  - `Exportar lista`
  - `Gerar rascunho WhatsApp`
  - `Salvar plano na Central de Ações IA`

## Princípios

1. O modelo não acessa banco de dados diretamente.
2. O modelo não gera SQL.
3. O backend resolve `schoolId`, papel, permissões, intenção e entidades.
4. Toda action vem de registry fechado.
5. Ações críticas viram rascunho ou exigem aprovação humana.
6. A resposta deve conter dados reais apenas quando vierem de ferramenta autorizada.
7. Ambiguidade pede esclarecimento, não execução.

## Estado Atual

O KLASSE IA já possui:

- `AiChatWidget`
- endpoint `POST /api/admin/ai/assistant`
- Fast Path local
- RAG em `knowledge-base-data.json`
- `AiWidgetContext`
- `ai_school_settings`
- `ai_usage_logs`
- Central de Ações IA
- permissões por perfil
- ações com risco e aprovação

O que ainda falta:

- payload estruturado `actions[]` em todas as respostas operacionais
- registry executável de ferramentas fechadas
- contexto vivo de tela com dados resumidos
- memória operacional por escola/usuário
- respostas com esclarecimento quando entidade for ambígua

## Contrato de Resposta

O endpoint do assistente deve evoluir para retornar:

```ts
type AssistantActionV2 = {
  id: string;
  kind:
    | "open_screen"
    | "open_drawer"
    | "prepare_draft"
    | "export"
    | "copy_text"
    | "save_ai_action"
    | "request_clarification";
  label: string;
  description?: string;
  href?: string;
  payload?: Record<string, unknown>;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
  permission: string;
};

type AssistantResponseV2 = {
  ok: boolean;
  mode: "fast_path" | "rag" | "data_query" | "action" | "fallback";
  answer: string;
  actions?: AssistantActionV2[];
  links?: Array<{ label: string; href: string }>;
  suggestions?: Array<{ key: string; title: string }>;
  clarification?: {
    question: string;
    options: Array<{ label: string; value: string }>;
  };
};
```

## Registry de Actions

Cada action deve ser registrada com:

- `id`
- `kind`
- `module`
- `roles`
- `permission`
- `riskLevel`
- `requiresApproval`
- `executor`
- `auditEvent`

Actions iniciais recomendadas:

| Action | Risco | Execução |
|---|---:|---|
| `open_student_profile` | low | abre ficha rápida/drawer |
| `open_finance_radar` | low | navega/abre tela |
| `open_quick_payment` | medium | abre modal de pagamento |
| `export_debtors_list` | medium | chama endpoint de exportação autorizado |
| `prepare_whatsapp_draft` | high | cria rascunho, não envia |
| `save_billing_plan` | high | salva em `ai_actions` |
| `open_class_detail` | low | abre turma |
| `open_documents_hub` | low | abre documentos oficiais |

## Matriz de Risco

### Low

Pode executar sem aprovação adicional:

- abrir tela
- abrir drawer
- copiar texto
- explicar regra
- mostrar caminho oficial

### Medium

Exige intenção explícita do usuário:

- exportar lista
- preparar pagamento
- abrir modal com dados operacionais
- gerar documento de pré-visualização

### High

Exige aprovação humana ou Central de Ações IA:

- enviar WhatsApp
- gerar cobrança em lote
- criar plano financeiro
- publicar comunicado
- qualquer ação com efeito externo

## Contexto Vivo de Tela

O `AiWidgetContext` deve evoluir para incluir resumos seguros:

```ts
type AiScreenDataSummary = {
  entityId?: string;
  entityLabel?: string;
  counters?: Record<string, number>;
  statuses?: string[];
  selectedIds?: string[];
  staleAt?: string;
};
```

Exemplos:

- Tela de turma: alunos ativos, alunos em atraso, pendências de notas, documentos pendentes.
- Tela financeira: inadimplentes, valor em atraso, cobranças recentes.
- Tela secretaria: atendimentos em aberto, documentos pendentes, matrículas por status.

O resumo deve ser montado pelo frontend/backend do KLASSE, não inferido pelo modelo.

## Fluxo Operacional

1. Usuário pergunta no widget.
2. `assistant/route.ts` resolve escola, usuário e papel.
3. Classificador decide:
   - ajuda/navegação
   - consulta operacional
   - geração de rascunho
   - ação contextual
4. Entity resolver identifica aluno, turma, período ou cobrança.
5. Tool authorizer valida permissão.
6. Tool executor consulta fonte canônica.
7. Answer composer monta resposta e `actions[]`.
8. Frontend renderiza botões.
9. Action de risco alto vira rascunho em `ai_actions` ou pede aprovação.

## Roadmap

### Fase 1 — Contrato e UI

- Adicionar `actions[]` ao payload do assistente.
- Renderizar botões no `AiChatWidget`.
- Mapear `open_screen`, `open_drawer`, `copy_text`.
- Garantir auditoria de cliques em actions.

### Fase 2 — Data Copilot

- Integrar com `docs/SPRINT_EXECUTIVO_KLASSE_DATA_COPILOT_V1.md`.
- Criar ferramentas fechadas para:
  - inadimplência por turma
  - resumo financeiro
  - pendências de secretaria
  - saúde acadêmica da turma

### Fase 3 — Rascunhos Operacionais

- `prepare_whatsapp_draft`
- `save_billing_plan`
- `save_notice_draft`
- revisão/aprovação pela Central de Ações IA

### Fase 4 — Memória Operacional

- Preferências por escola.
- Tom de comunicação padrão.
- Regras recorrentes de cobrança.
- Histórico de actions usadas pelo perfil.

## Não Fazer

- Não permitir SQL livre.
- Não executar ações destrutivas.
- Não enviar WhatsApp diretamente pelo chat.
- Não lançar pagamento real por texto.
- Não alterar notas por prompt.
- Não inventar telas, permissões, valores ou status.

## Critério de Pronto

O KLASSE IA Actions v2 estará pronto quando:

- toda action exibida tiver registry, permissão, risco e auditoria
- actions high-risk exigirem aprovação
- respostas de dados vierem apenas de ferramentas autorizadas
- o frontend renderizar botões de action com estado claro
- o fallback for seguro quando houver ambiguidade ou falta de dados
