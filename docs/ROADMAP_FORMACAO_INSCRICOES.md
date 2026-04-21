# KLASSE Formação · Roadmap de Inscrições e Matrículas
Data: 11/04/2026  
Owner: Engenharia Plataforma (Formação)

## Status de Execução (Auditado e Atualizado em 11/04/2026)
- ✅ **Fase 0 (Completa)**: Tabela `formacao_inscricoes`, RLS e função `formacao_create_inscricao` operacionais com suporte a snapshots de perfil.
- ✅ **Fase 1 - Via A (Balcão)**: API `POST /api/formacao/secretaria/inscricoes` funcional. Suporta criação de usuário, perfil e cobrança B2C.
- ✅ **Fase 2 - Via B (Upload B2B)**: API `POST /api/formacao/secretaria/inscricoes/upload-b2b` funcional com deduplicação avançada e fatura em lote.
- ✅ **Fase 3 - Via C (Self-Service)**: Inscrição via link público operacional com proteção de BI.
- ✅ **Fase 4 - Operação & Dashboards (Completa)**: 
    - Dashboard Admin (`/admin/dashboard`) com métricas reais de cursos, cohorts e inscritos.
    - Dashboard Financeira (`/financeiro/dashboard`) com faturamento real e inadimplência.
- ✅ **Fase 5 - Automação (Completa)**:
    - **Envio de Credenciais**: Integração com Resend para disparar e-mails automáticos com senhas provisórias.
    - **Comprovativos em PDF**: Geração de Comprovativo de Inscrição via `@react-pdf/renderer` com download na UI.

## Pendências Reais (Sem chutes)
1. **Processamento Assíncrono**: Converter `upload-b2b` para Job/Queue (Edge Functions) para suportar lotes > 500 linhas.
2. **Migração de Rotas**: Mover as últimas páginas de Formação que ainda residem em `apps/web`.
3. **Certificados de Conclusão**: Implementar a geração de certificados para alunos que concluírem o curso (Fase futura).

## Objetivo
Implementar 3 vias de entrada de formandos com operação real, segurança de deduplicação e comportamento por modalidade:
- Via A: Balcão (secretaria)
- Via B: Upload B2B (empresa)
- Via C: Self-service (link público)

## Princípios (Auditados)
- **Matrícula Formal**: Entidade `formacao_inscricoes` é o SSOT (Single Source of Truth).
- **Unicidade**: BI normalizado é a chave de deduplicação no banco.
- **Isolamento**: Perfil vinculado ao `escola_id` para evitar acesso cruzado entre centros.


## Escopo Funcional
1. Curso criado  
2. Cohort criada (datas e vagas)  
3. Valor da cohort definido  
4. Formador atribuído à cohort  
5. Primeira cobrança preparada (opcional)

## Fase 0 · Base de Dados e Contratos
### Entregáveis
- Nova tabela `formacao_inscricoes` com colunas mínimas:
  - `id`, `escola_id`, `cohort_id`, `formando_user_id`, `origem` (`balcao|b2b|self_service`), `status`, `created_at`, `created_by`
- Índices e constraints:
  - `UNIQUE (escola_id, cohort_id, formando_user_id)` em `formacao_inscricoes`
  - `UNIQUE (bi_numero_normalizado)` em perfil de formando (ou `UNIQUE (pais_documento, bi_numero_normalizado)` se adotado)
- Função transacional SQL para matrícula com lock de lotação:
  - valida deduplicação
  - valida lotação para presencial
  - cria inscrição
  - retorna motivo de erro tipado

### Critério de aceite
- Migrações aplicam sem erro.
- Constraint de BI impede duplicidade.
- Inserção duplicada por `cohort+formando` falha com erro controlado.

## Fase 1 · Via A (Balcão) — Prioridade Máxima
### Entregáveis
- Página secretaria: `formulario de inscrição balcão` (Nome, BI, Email, Telefone, Curso/Cohort).
- API: `POST /api/formacao/secretaria/inscricoes`
  - cria/resolve usuário no Auth
  - cria matrícula em `formacao_inscricoes`
  - opcionalmente gera cobrança inicial
- Regras de modalidade:
  - Presencial: bloquear quando `vagas_ocupadas >= vagas_limite`
  - Online: não bloquear por lotação física
- Output:
  - Presencial: comprovativo de inscrição (PDF em fase posterior)
  - Online: acesso inicial para portal do formando (após regra de pagamento)

### Critério de aceite
- Secretaria consegue inscrever 1 formando ponta a ponta.
- Duplicidade de BI mostra mensagem de reaproveitamento/associação.
- Presencial bloqueia ao lotar.

## Fase 2 · Via B (Upload B2B)
### Entregáveis
- Upload CSV/XLSX para lista de formandos de empresa.
- Job assíncrono:
  - deduplica por BI/email
  - cria/associa usuários
  - cria inscrições em lote
  - gera 1 fatura B2B agregada
  - envia boas-vindas para novos usuários
- Relatório final do lote: total, criados, reaproveitados, falhas.

### Critério de aceite
- Processar lote de 20+ formandos sem duplicidade.
- Fatura B2B única gerada com total correto.
- Erros por linha com motivo.

## Fase 3 · Via C (Self-Service)
### Entregáveis
- Página pública: `/inscricao/[cohortSlug]`
- Cadastro com BI/email/telefone
- Criação de usuário + matrícula automática
- Redirecionamento para login/portal com contexto da turma

### Critério de aceite
- Aluno externo consegue autoinscrição em turma aberta.
- Lotação presencial respeitada.
- Não cria usuário duplicado para BI existente.

## Fase 4 · Operação Académica/Financeira Integrada
### Entregáveis
- Onboarding operacional consome `formacao_inscricoes` (não inferir só de fatura)
- Dashboard admin com:
  - inscritos por cohort
  - ocupação presencial
  - inscritos online
- Ligação matrícula → cobrança:
  - status de inscrição e status financeiro coexistem

### Critério de aceite
- Métricas acadêmicas e financeiras consistentes.
- Sem dependência implícita de faturas para contar inscritos.

## Segurança e Qualidade (transversal)
- Idempotência em APIs críticas (`request_id`).
- Anti-enumeração em respostas de autenticação/cadastro.
- Auditoria mínima:
  - `enrollment_created`
  - `enrollment_reused_existing_student`
  - `enrollment_denied_capacity`
  - `b2b_import_completed`
- Typecheck limpo:
  - `pnpm -C apps/formacao exec tsc --noEmit`

## Riscos e Mitigações
- Risco: conflito entre BI real e dados incompletos antigos.
  - Mitigação: normalização de documento + rotina de saneamento.
- Risco: corrida de lotação em alta concorrência.
  - Mitigação: função SQL transacional com lock na cohort.
- Risco: acoplamento matrícula/cobrança.
  - Mitigação: separar tabela de inscrição da tabela financeira.

## Ordem de Implementação Recomendada
1. Fase 0 (schema + constraints + função SQL)
2. Fase 1 (Balcão)
3. Fase 2 (Upload B2B)
4. Fase 3 (Self-service)
5. Fase 4 (telemetria e consolidação)

## Definition of Done (Go-Live)
- Via A funcional em produção.
- Unicidade de BI ativa.
- Lotação presencial bloqueando corretamente.
- Pelo menos 1 fluxo B2B de lote validado.
- Self-service funcional para 1 cohort piloto.
- Dashboard e onboarding refletindo inscrição formal.
