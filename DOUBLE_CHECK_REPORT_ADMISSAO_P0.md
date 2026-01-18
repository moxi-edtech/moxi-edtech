# Double Check Report: Admissão Unificada (P0)

## 5.1 Tabela de Rotas

### Rotas Novas
| Rota | Status | Observação |
| :--- | :--- | :--- |
| `/api/secretaria/admissoes/radar` | ✅ **CANONICAL** | Funcional. Usa SQL direto para leitura. Idempotente (GET). |
| `/api/secretaria/admissoes/draft` | ✅ **CANONICAL** | Funcional. Usa RPC `admissao_upsert_draft`. Idempotente. |
| `/api/secretaria/admissoes/vagas` | ✅ **CANONICAL** | Funcional. Usa SQL direto sobre a view `vw_turmas_para_matricula`. Idempotente (GET). |
| `/api/secretaria/admissoes/convert` | ✅ **CANONICAL** | Funcional. Usa RPC `admissao_convert`. Idempotente via tabela `idempotency_keys`. |
| `/api/secretaria/admissoes/save_for_later` | ✅ **CANONICAL** | Funcional. Usa SQL direto. Não é estritamente idempotente (recria PDF e atualiza `expires_at`), mas o resultado funcional é consistente. |

### Rotas Antigas
| Rota | Status | Observação |
| :--- | :--- | :--- |
| `/api/secretaria/candidaturas` (GET) | ⚠️ **LEGACY_RISK** | Lista candidaturas fora do novo fluxo do Radar. Pode causar confusão. |
| `/api/secretaria/candidaturas/[id]` (GET, PATCH) | ⚠️ **LEGACY_RISK** | Permite a manipulação de uma candidatura individual fora do wizard, podendo levar a estados inconsistentes. |
| `/api/secretaria/candidaturas/[id]/confirmar` | ☠️ **LEGACY_RISK** | Rota de alto risco. Contém uma lógica de conversão paralela e conflitante com o novo RPC `admissao_convert`. Pode gerar duplicados e dados inconsistentes. |
| `/api/financeiro/candidaturas` (GET) | ⚠️ **LEGACY_RISK** | Apresenta uma visão financeira de candidaturas que não está sincronizada com o novo "Radar de Admissões". Risco operacional. |
| `/api/financeiro/candidaturas/rejeitar` | ✅ **LEGACY_OK** | Funcionalidade de rejeição que pode ser útil para casos de exceção. Não conflita diretamente com o fluxo de criação. |
| `/api/secretaria/matriculas/*` | ✅ **LEGACY_OK** | Rotas para listar e gerir matrículas existentes. Continuam a ser necessárias e não conflitam com o novo fluxo de *criação*. |
| `/api/secretaria/alunos/novo` | ⚠️ **LEGACY_RISK** | Representa um fluxo de criação de `candidaturas` paralelo ao wizard, o que pode fragmentar a experiência e a lógica de negócio. |

## 5.2 Riscos Identificados

- **Risco Funcional:**
  - **Lógica de Conversão Duplicada:** A existência da rota antiga `/api/secretaria/candidaturas/[id]/confirmar` é um risco significativo, pois implementa uma forma alternativa de converter candidaturas, contornando a nova lógica transacional e de idempotência do RPC `admissao_convert`.
  - **Wizard não carrega leads existentes:** O `AdmissaoWizardClient` não está preparado para carregar os dados de uma `candidatura` existente via parâmetro de URL (ex: ao clicar num lead "online" no radar).

- **Risco Operacional (secretaria confusa):**
  - A coexistência de UIs para o novo Radar e para a listagem/edição antiga de `candidaturas` (ainda que sem link direto no menu da secretaria) pode levar a confusão se os usuários tiverem acesso aos URLs antigos.
  - A rota `/api/secretaria/alunos/novo` representa um "cadastro rápido" que não está integrado ao novo pipeline, podendo levar a dois fluxos de trabalho distintos para a secretaria.

- **Risco de Duplicação:**
  - O principal risco vem da rota `/api/secretaria/candidaturas/[id]/confirmar`, que não partilha o mesmo mecanismo de idempotência do novo fluxo.

## 5.3 Confiança no P0

- **Score:** 75%
- **Justificativa:** A base do novo fluxo (Kanban, Wizard, RPCs) está implementada e é robusta. A autorização granular e a idempotência na rota principal de conversão foram estabelecidas. No entanto, a confiança não é de 100% devido aos riscos introduzidos pela não remoção/desativação das rotas antigas que conflitam diretamente com o novo fluxo canônico. A rota de confirmação legada é um ponto crítico de falha que pode minar a integridade do novo sistema. Adicionalmente, o fluxo "Digital" está incompleto pois o wizard não carrega o lead existente.
