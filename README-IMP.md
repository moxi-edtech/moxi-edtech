# 📘 Moxi Nexa — Módulo de Importação, Matrículas em Massa e Documentos Académicos

![Status](https://img.shields.io/badge/status-em%20produção-green)
![Stack](https://img.shields.io/badge/stack-Next.js%20%7C%20Supabase%20%7C%20Postgres-0B7285)
![DB](https://img.shields.io/badge/db-PostgreSQL%20%2B%20RLS-336791)
![PDF](https://img.shields.io/badge/pdf-pdf--lib%20%2B%20qrcode-10B981)
![Scope](https://img.shields.io/badge/módulo-importação%20%2B%20matrículas%20%2B%20documentos-orange)

Este módulo implementa o **wizard completo de migração de alunos**, o **processo de matrícula em massa**, a **padronização institucional de PDFs** e os **endpoints de suporte a documentos oficiais**. A arquitetura agora inclui um **fluxo de configuração pós-importação** para validar estruturas acadêmicas criadas dinamicamente.

Toda a arquitetura foi projetada para:

- Minimizar intervenção manual com **criação automática de cursos e turmas**.
- Garantir consistência & auditabilidade através de um **workflow de aprovação**.
- Permitir escalabilidade (escolas pequenas → 10.000+ alunos).
- Suportar alunos **sem `profile_id`** (opcional).
- Gerar documentos institucionais com **QR Code + validação online**.
- Suportar turmas com **classe, turno, capacidade e ocupação**.
- Tratar contexto financeiro de migração: isenção opcional de matrícula e corte de mensalidades retroativas na importação e na aprovação de turmas rascunho.

---

## 🧩 Visão Geral da Arquitetura

```mermaid
flowchart TD
    subgraph FRONTEND ["Frontend (Next.js App Router)"]
      A1[Wizard /migracao/alunos] --> A2[Upload CSV]
      A2 --> A3[Mapeamento de Colunas]
      A3 --> A4[Pré-visualização]
      A4 --> A4b[Backfill Acadêmico]
      A4b --> A5[Importar Pessoas]
      A5 --> A5b[Configuração Pós-Importação]
      A5b --> A6[Revisão de Matrícula]
      A6 --> A7[Matricular por Turma]
    end

    subgraph API ["API Routes (Next.js)"]
      B1[/POST /api/migracao/upload/]
      B2[/POST /api/migracao/alunos/validar/]
      B2b[/GET/POST /api/migracao/:importId/academico/backfill]
      B3[/POST /api/migracao/alunos/importar/]
      B3b[/GET /api/migracao/:importId/matricula/preview]
      B3c[/GET /api/migracao/:importId/summary/]
      B3d[/PATCH /api/migracao/:importId/configure/]
      B6b[/POST /api/matriculas/massa/por-turma]
      B4[/GET  /api/migracao/:importId/erros/]
      B5[/GET  /api/migracao/historico/]
      B7[/GET  /api/secretaria/matriculas/:id/declaracao/]
      B8[/GET  /api/financeiro/candidaturas]
      B9[/POST /api/financeiro/candidaturas/rejeitar]
    end

    subgraph DB ["Supabase / Postgres"]
      C1[(import_migrations)]
      C2[(staging_alunos)]
      C3[(import_errors)]
      C4[(alunos)]
      C5[(matriculas)]
      C6[(turmas)]
      C7[(cursos)]
      C8[[RPC importar_alunos]]
      C8b[[RPC get_import_summary]]
      C8c[[RPC update_import_configuration]]
      C9[[RPC matricular_em_massa_por_turma]]
      C10[[FN generate_matricula_number (trigger)]]
      C11[[FN confirmar_matricula (RPC)]]
    end

    subgraph DOCS ["PDF Engine"]
      D1[[createInstitutionalPdf]]
      D2[[createQrImage & buildSignatureLine]]
      D3[(PDF Declaração de Matrícula)]
    end

    %% Fluxo de Importação
    A2 --> B1 --> C1
    A3 --> B2 --> C2 & C3
    A4b --> B2b --> C6 & C7
    A5 --> B3 --> C8 --> C4 & C3 & C1

    %% Novo Fluxo de Configuração
    A5b --> B3c --> C8b
    A5b --> B3d --> C8c --> C6 & C7

    %% Matrícula em Massa por Turma
    A6 --> B3b --> C2
    A7 --> B6b --> C9 --> C5 --> C10 --> C11

    %% Erros e Histórico
    A4 --> B4 --> C3
    A1 --> B5 --> C1

    %% Declaração de Matrícula (PDF)
    A7 --> B7 --> C5 & C4 & C6 & C7 --> D1 --> D2 --> D3
```

⸻

📂 Sumário
	1.	Arquitetura Geral
	2.	Fluxo Completo de Importação
	3.	Estrutura SQL
	4.	Funções Principais
	5.	Matrícula em Massa (com Revisão por Turma)
	6.	Template Institucional de PDFs
	7.	API Endpoints
	8.	Modelo de Planilha Oficial (CSV)
	9.	Backlog Implementado
	10.	Próximas Etapas

⸻

1. Arquitetura Geral

O módulo é composto por 5 pilares:

✔ 1. Área de staging

Recebe os dados brutos do CSV e prepara para validação e matching.

✔ 2. Importação de alunos com "Lazy Creation"

Cria/atualiza alunos e, se necessário, cria automaticamente:
	•	**Cursos como `pendente`**: se o `curso_codigo` não existe, é criado e aguarda aprovação de um admin.
	•	**Turmas como `rascunho`**: se o `turma_codigo` não existe, é criada e aguarda configuração.
	•	Loga erros em `import_errors`.

✔ 3. Configuração Pós-Importação

Uma nova etapa no wizard permite que o `secretario` configure as turmas em rascunho (associando a classes, definindo turno, etc.) e que o `admin` aprove os cursos pendentes, garantindo um fluxo de trabalho completo.

✔ 4. Matrícula em Massa

Agrupa alunos por turma e efetua a matrícula em lotes, de forma idempotente e segura.

✔ 5. Padronização institucional de PDFs

Documentos oficiais gerados com cabeçalho, QR Code de validação, assinatura digital e rodapé padrão.

✔ 6. Liberação de acesso de alunos (novo)

Alunos importados ou cadastrados podem ter credenciais emitidas em lote pela secretaria: `/secretaria/acesso-alunos` lista pendentes e chama `/api/secretaria/alunos/liberar-acesso`, que cria usuários/profiles se necessário, gera códigos em `alunos`, enfileira notificações em `outbox_notificacoes` e usa Twilio/Resend para envio (worker externo). Ativação self-service via `/api/alunos/ativar-acesso` (código + BI).

⸻

2. Fluxo Completo de Importação

📁 Passo 1 — Upload (POST /api/migracao/upload)
	•	Recebe `file`, `escolaId`.
	•	Cria registro em `public.import_migrations` com `status = 'uploaded'`.

⸻

🧭 Passo 2 — Mapeamento
	•	O usuário mapeia as colunas do CSV para os campos do sistema. O `columnMap` é enviado para validação.

⸻

🔎 Passo 3 — Validação (POST /api/migracao/alunos/validar)
	•	Converte CSV em JSON.
	•	Preenche `public.staging_alunos` com dados normalizados.
	•	Retorna um preview para o wizard.

⸻

🚀 Passo 4 — Importação (POST /api/migracao/alunos/importar)

Chama a RPC `public.importar_alunos`. A função:
	•	Itera sobre `staging_alunos`.
	•	Cria/atualiza `public.alunos`.
	•	**Lazy Creation**: Se `curso_codigo` ou `turma_codigo` não existem, cria-os com status `pendente` ou `rascunho`, respectivamente, e associa o `import_id`.
	•	Retorna o número de alunos importados, erros, e a contagem de `turmas_created` e `cursos_created`.
	•	Captura flags de migração financeira (ignorar matrícula, mês inicial); se turmas já forem ativas, aplica isenção de matrícula e mensalidades retroativas, e direciona notificações (rascunhos → admin; ativa → financeiro).

Retorno típico:

```json
{
  "imported": 120,
  "errors": 2,
  "turmas_created": 3,
  "cursos_created": 1 
}
```

⸻

⚙️ Passo 5 — Configuração Pós-Importação (NOVO)

Se `turmas_created > 0` ou `cursos_created > 0`, o wizard avança para esta etapa.
	•	**GET `/api/migracao/{importId}/summary`**: Busca os cursos e turmas recém-criados.
	•	**UI de Configuração**: Permite ao usuário editar nomes, associar turmas a cursos/classes e, se for admin, aprovar cursos.
	•	**PATCH `/api/migracao/{importId}/configure`**: Salva as alterações, chamando a RPC `update_import_configuration`.

⸻

🎒 Passo 6 — Revisão de Matrícula (Preview)

GET /api/migracao/{importId}/matricula/preview

Mesmo comportamento de antes, agrupando alunos por turmas que agora estão configuradas e ativas.

🎒 Passo 7 — Matrícula em Massa (RPC por Turma)

POST /api/matriculas/massa/por-turma

O Frontend dispara em loop por cada lote marcado (status=ready), e a RPC `matricular_em_massa_por_turma` executa a matrícula.

🔗 Reabrir Wizard (deep link)
Abra diretamente a revisão de um import específico:

```
/migracao/alunos?importId={uuid}&step=review
```

⸻

3. Estrutura SQL

Tabelas principais
	•	`public.import_migrations`
	•	`public.import_errors`
	•	`public.staging_alunos`
	•	`public.cursos` (agora com `status_aprovacao` e `import_id`)
	•	`public.turmas` (agora com `import_id`)
	•	`public.alunos`
	•	`public.matriculas`

⸻

4. Funções Principais

🔧 `public.importar_alunos(p_import_id, p_escola_id, p_ano_letivo)`

Responsável por:
	•	Iterar `staging_alunos`.
	•	Criar/atualizar `public.alunos`.
	•	Criar `cursos` pendentes e `turmas` rascunho se não existirem, com base na role do usuário (via JWT).
	•	Retornar contadores de `imported`, `errors`, `turmas_created`, `cursos_created`.

🔧 `public.get_import_summary(p_import_id)` (NOVO)

Retorna um JSON com dois arrays:
	•	`cursos`: todos os cursos criados na importação.
	•	`turmas`: todas as turmas criadas na importação, com nomes de curso e classe associados.

🔧 `public.update_import_configuration(p_import_id, p_cursos_data, p_turmas_data)` (NOVO)

Recebe JSON com as atualizações da UI de configuração e as aplica:
	•	Atualiza nomes, status de aprovação de cursos (somente admins).
	•	Atualiza nomes, `curso_id`, `classe_id`, `turno` e `status_validacao` de turmas.

🔧 `public.matricular_em_massa_por_turma(...)`

Comportamento inalterado, mas agora opera sobre turmas validadas na etapa de configuração.

⸻

5. Matrícula em Massa (com Revisão por Turma)

Características
	•	Preview por turma antes de executar, com marcação dos lotes.
	•	Execução em lotes via RPC por turma (idempotente e escalável).
	•	Trabalha com alunos recém-importados e existentes (match BI/email/profile).
	•	Reativação segura (ON CONFLICT) e integração com numeração automática.

⸻

6. Template Institucional de PDFs

Arquivo: apps/web/src/lib/pdf/documentTemplate.ts

Principais pontos:
	•	Gera um PDFDocument com:
	•	Cabeçalho (nome/NIF/endereço/contatos)
	•	Título do documento
	•	URL de validação (opcional)
	•	Área de conteúdo customizável
	•	Rodapé com timestamp e marca “Moxi Nexa”
	•	É utilizado por rotas como:
	•	GET /api/secretaria/matriculas/[id]/declaracao

Arquivo de helpers: apps/web/src/lib/pdf/qr.ts:
	•	generateQrPngBytes(url: string)
	•	createQrImage(pdfDoc, url)
	•	buildSignatureLine({ signerName?, signerRole? })

⸻

7. API Endpoints

📤 Upload

POST /api/migracao/upload

	•	Body: multipart/form-data com file, escolaId, userId (opcional)
	•	Output: { importId, status, objectPath, hash }

⸻

🔍 Validar CSV

POST /api/migracao/alunos/validar
Content-Type: application/json

{
  "importId": "uuid",
  "escolaId": "uuid",
  "columnMap": { ... }
}


⸻

🚀 Importar para alunos

POST /api/migracao/alunos/importar
Content-Type: application/json

{
  "importId": "uuid",
  "escolaId": "uuid"
}


⸻

⚙️ Obter Resumo para Configuração (NOVO)

GET /api/migracao/{importId}/summary

Retorna:
```json
{
  "cursos": [ { "id": "...", "nome": "...", "status_aprovacao": "pendente" } ],
  "turmas": [ { "id": "...", "nome": "...", "status_validacao": "rascunho" } ]
}
```

⸻

💾 Salvar Configuração (NOVO)

PATCH /api/migracao/{importId}/configure
Content-Type: application/json

```json
{
  "cursos": [ { "id": "...", "nome": "Novo Nome do Curso", "status_aprovacao": "aprovado" } ],
  "turmas": [ { "id": "...", "classe_id": "...", "turno": "Manhã" } ]
}
```

⸻

⚠️ Listar erros

GET /api/migracao/{importId}/erros

Retorna:

{
  "errors": [
    { "row_number": 10, "column_name": "email", "message": "Email inválido", "raw_value": "..." }
  ]
}


⸻

📜 Histórico de imports

GET /api/migracao/historico

Retorna dados de import_migrations filtrados pela escola do usuário.

⸻

🎒 Matrícula em Massa (por Turma)

POST /api/matriculas/massa/por-turma
Content-Type: application/json

{
  "import_id": "uuid",
  "escola_id": "uuid",
  "turma_id": "uuid"
}


⸻

📄 Declaração de Matrícula (PDF)

GET /api/secretaria/matriculas/[id]/declaracao

	•	Carrega matrícula, aluno, turma, escola
	•	Usa createInstitutionalPdf
	•	Gera PDF com:
	•	Dados do aluno
	•	Dados acadêmicos
	•	Texto institucional
	•	QR de validação
	•	Assinatura digital

⸻

8. Modelo de Planilha Oficial (CSV)

🧬 Seções recomendadas

1) Dados pessoais

Coluna CSV	Descrição
nome	Nome completo do aluno
data_nascimento	Data (vários formatos aceitos)
bi	Número do BI / Cédula
telefone	Telefone do aluno ou encarregado
email	Email do aluno (ou responsável, se usado)

2) Dados para matrícula

Coluna CSV	Descrição
curso_codigo	Código curto do curso (ex.: EMG, INF, CTI)
classe_numero	Número da classe (ex.: 7, 8, 9, 10, 11, 12)
turno_codigo	Código do turno (M = manhã, T = tarde, N = noite)
turma_letra	Identificador da turma (A, B, AB, ABNG, etc.)
ano_letivo	Ano letivo (ex.: 2025 ou 2025-2026 — armazenado como inteiro principal)
numero_matricula	Opcional. Se vazio, sistema gera automaticamente

Obs.: o ColumnMapper permite que o CSV use cabeçalhos livres.
O mapeamento diz: “esta coluna aqui é curso_codigo, esta é bi, etc.”

⸻

9. Backlog Implementado neste Módulo

✅ Pipeline completo de importação:
	•	Upload → Staging → Importação → **Configuração** → Revisão → Matrícula → Histórico

✅ Criação automática de cursos e turmas ("Lazy Creation")
	•	Cursos criados como 'pendente' aguardando aprovação.
	•	Turmas criadas como 'rascunho' aguardando configuração.

✅ profile_id opcional:
	•	Não trava o fluxo se a escola não usar profiles ainda

✅ RPC `importar_alunos` com validação de role e `*_created` counters.
✅ RPCs `get_import_summary` e `update_import_configuration` para o novo fluxo.
✅ RPC `matricular_em_massa` com validações e logs de erro
✅ Trigger de número de matrícula (generate_matricula_number)
✅ Template institucional de PDFs
✅ Declaração de matrícula com QR e assinatura
✅ Novo ColumnMapper preparado para matrícula em massa
✅ Componente MatriculasEmMassa para o front
✅ Migrations com índices específicos para performance
✅ Documentação técnica inicial (docs/prerequisitos-documentos.md + este README)

⸻

10. Próximas Etapas
	•	UI para o passo de Configuração no wizard.
	•	Dashboard de aprovações pendentes para admins.
	•	Certificado de frequência (usando mesmo template PDF)
	•	Declaração de notas (integração com módulo de avaliações)
	•	Lista de alunos por turma (PDF com BI, contactos, encarregado)
	•	Extrato de propinas / situação financeira do aluno
	•	Relatório de documentos pendentes (schema + UI)
	•	Dashboard PDF diário (Fase 1.7 — secretaria + financeiro)
	•	Integração da matrícula em massa com distribuição inteligente de turmas

⸻


Se quiser, no próximo passo eu posso:

- Gerar um segundo README em **inglês** para o repositório público,  
- Ou quebrar este conteúdo em: `README.md` + `docs/importacao-matriculas.md` + `docs/pdf-engine.md` pra ficar bem organizado.
