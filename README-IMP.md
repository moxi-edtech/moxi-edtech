Perfeito, vamos tunar esse README pra ficar com cara de projeto sério em produção. 😎🚀

Abaixo vai a versão consolidada com badges + diagrama Mermaid já encaixados.

⸻


# 📘 Moxi Nexa — Módulo de Importação, Matrículas em Massa e Documentos Académicos

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-blue)
![Stack](https://img.shields.io/badge/stack-Next.js%20%7C%20Supabase%20%7C%20Postgres-0B7285)
![DB](https://img.shields.io/badge/db-PostgreSQL%20%2B%20RLS-336791)
![PDF](https://img.shields.io/badge/pdf-pdf--lib%20%2B%20qrcode-10B981)
![Scope](https://img.shields.io/badge/módulo-importação%20%2B%20matrículas%20%2B%20documentos-orange)

Este módulo implementa o **wizard completo de migração de alunos**, o **processo de matrícula em massa**, a **padronização institucional de PDFs** e os **endpoints de suporte a documentos oficiais**.

Toda a arquitetura foi projetada para:

- Minimizar intervenção manual  
- Garantir consistência & auditabilidade  
- Permitir escalabilidade (escolas pequenas → 10.000+ alunos)  
- Suportar alunos **sem `profile_id`** (opcional)  
- Gerar documentos institucionais com **QR Code + validação online**  
- Suportar turmas com **classe, turno, capacidade e ocupação**

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
      A5 --> A6[Revisão de Matrícula]
      A6 --> A7[Matricular por Turma]
    end

    subgraph API ["API Routes (Next.js)"]
      B1[/POST /api/migracao/upload/]
      B2[/POST /api/migracao/alunos/validar/]
      B2b[/GET/POST /api/migracao/:importId/academico/backfill]
      B3[/POST /api/migracao/alunos/importar/]
      B3b[/GET /api/migracao/:importId/matricula/preview]
      B6b[/POST /api/matriculas/massa/por-turma]
      B4[/GET  /api/migracao/:importId/erros/]
      B5[/GET  /api/migracao/historico/]
      B7[/GET  /api/secretaria/matriculas/:id/declaracao/]
    end

    subgraph DB ["Supabase / Postgres"]
      C1[(import_migrations)]
      C2[(staging_alunos)]
      C3[(import_errors)]
      C4[(alunos)]
      C5[(matriculas)]
      C6[(turmas)]
      C7[(escolas)]
      C8[[RPC importar_alunos]]
      C9[[RPC matricular_em_massa_por_turma]]
      C10[[FN generate_matricula_number (trigger)]]
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

    %% Matrícula em Massa por Turma
    A6 --> B3b --> C2
    A7 --> B6b --> C9 --> C5 --> C10

    %% Erros e Histórico
    A4 --> B4 --> C3
    A1 --> B5 --> C1

    %% Declaração de Matrícula (PDF)
    A7 --> B7 --> C5 & C4 & C6 & C7 --> D1 --> D2 --> D3


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

✔ 2. Importação de alunos

Cria/atualiza alunos reais na tabela public.alunos:
	•	profile_id opcional
	•	Matching por profile_id / BI / email
	•	Cria novos registros e atualiza existentes
	•	Loga erros em import_errors

✔ 3. Matrícula em Massa

Agrupa automaticamente por:
	•	curso_codigo
	•	classe_numero
	•	turno_codigo
	•	turma_letra
	•	ano_letivo

E gera matrículas com:
	•	numero_matricula automático (trigger) ou recebido do CSV
	•	status = 'ativo'
	•	reativação de matrícula se já existir (aluno_id, turma_id, ano_letivo)

✔ 4. Padronização institucional de PDFs

Documentos oficiais gerados com:
	•	Cabeçalho institucional
	•	QR Code para validação online
	•	URL de verificação (validationBaseUrl + verificationToken)
	•	Linha de assinatura digital
	•	Rodapé padrão “Emitido via Moxi Nexa”

✔ 5. Backend seguro com RPCs

Toda lógica pesada roda no Postgres:
	•	importar_alunos → move staging → alunos
	•	matricular_em_massa → cria/atualiza matrículas
	•	Funções utilitárias (normalize_text, normalize_date)
	•	RLS e policies para service_role e authenticated

⸻

2. Fluxo Completo de Importação

📁 Passo 1 — Upload (POST /api/migracao/upload)
	•	Recebe file, escolaId, userId (opcional)
	•	Salva no bucket migracoes → migracoes/{importId}/{fileName}
	•	Calcula hash (file_hash)
	•	Cria registro em public.import_migrations com:
	•	id (= importId)
	•	escola_id
	•	created_by
	•	status = 'uploaded'

Resposta:

{
  "importId": "uuid",
  "status": "uploaded",
  "objectPath": "migracoes/...",
  "hash": "..."
}


⸻

🧭 Passo 2 — Mapeamento

No front, o usuário mapeia colunas do CSV para campos internos, incluindo:
	•	Dados pessoais: nome, data_nascimento, bi/bi_numero, telefone, email, nif
	•	Responsáveis: encarregado_nome (obrigatório), encarregado_telefone (obrigatório), encarregado_email
	•	Dados de matrícula: curso_codigo, classe_numero, turno_codigo, turma_letra, ano_letivo, numero_matricula
	•	Formato de turma (quando matricular): <CURSO>-<CLASSE>-<TURNO>-<TURMA> (ex.: TI-10-M-A) – CURSO é a sigla configurada na escola (EP/ESG/TI/CFB/CEJ/ENF/AC...).

Esse columnMap é enviado na validação e persistido em import_migrations.column_map para auditoria/reuso.

⸻

🔎 Passo 3 — Validação (POST /api/migracao/alunos/validar)
	•	Faz download do arquivo do bucket (via storage_path)
	•	Converte CSV → JSON (com autodetecção de ; ou ,)
	•	Normaliza textos e datas
	•	Preenche public.staging_alunos com:
	•	import_id, escola_id
	•	campos pessoais (nome, data_nascimento, telefone, bi/bi_numero, nif, email)
	•	campos de responsáveis (encarregado_nome, encarregado_telefone, encarregado_email)
	•	campos de matrícula (curso_codigo, classe_numero, turno_codigo, turma_letra, ano_letivo, numero_matricula)
	•	observação: quando há turma, o backend resolve curso via course_code da escola e cria/usa a turma por código único (escola+ano) antes de matricular; se a sigla não estiver configurada na escola, retorna erro.
	•	raw_data (linha original)

Também:
	•	Limpa import_errors e staging_alunos anteriores daquele import_id
	•	Atualiza import_migrations.status = 'validado'
	•	Retorna um preview (até 20 linhas) para o wizard.

⸻

🚀 Passo 4 — Importação (POST /api/migracao/alunos/importar)

Chama a RPC:

SELECT * FROM public.importar_alunos(p_import_id := :importId, p_escola_id := :escolaId);

A função:
	•	Itera sobre staging_alunos
	•	Faz matching com public.alunos:
	•	por profile_id (se houver)
	•	senão por bi_numero
	•	senão por email
	•	INSERT ... ON CONFLICT para criar/atualizar aluno
	•	Registra erros em import_errors
	•	Atualiza import_migrations:
	•	status = 'imported'
	•	imported_rows, error_rows, processed_at

Retorno típico (Detect & Resolve habilitado):

{
  "result": {
    "imported": 120,
    "skipped": 3,
    "errors": 2,
    "warnings_turma": 5, // alunos criados sem matrícula porque a turma não foi encontrada
    "turmas_created": 3   // turmas criadas automaticamente em modo rascunho
  }
}


⸻

🎒 Passo 5 — Revisão de Matrícula (Preview)

GET /api/migracao/{importId}/matricula/preview

Retorna lotes agrupados por turma detectada no staging, indicando se a turma existe (status=ready) ou não (warning). A UI permite marcar/desmarcar os lotes antes de executar.

🎒 Passo 6 — Matrícula em Massa (RPC por Turma)

POST /api/matriculas/massa/por-turma

{
  "import_id": "uuid",
  "escola_id": "uuid",
  "turma_id": "uuid"
}

O Frontend dispara em loop por cada lote marcado (status=ready), e a RPC ‘matricular_em_massa_por_turma’ executa a matrícula apenas para aquela turma.

🔗 Reabrir Wizard (deep link)
Abra diretamente a revisão de um import específico:

```
/migracao/alunos?importId={uuid}&step=review
```

⸻

3. Estrutura SQL

Tabelas principais
	•	public.import_migrations
	•	public.import_errors
	•	public.staging_alunos
	•	public.alunos (com campos extras: telefone, import_id)
	•	public.matriculas (com trigger de número de matrícula)
	•	public.turmas (com classe e capacidade_max se já aplicadas)
	•	Funções utilitárias e RPCs.

(A migration consolidada está nos arquivos 20251125090000_student_import_wizard.sql + extensões/migrations complementares.)

⸻

4. Funções Principais

🔧 public.importar_alunos(p_import_id uuid, p_escola_id uuid)

Responsável por:
	•	Validar existência de import_migrations
	•	Iterar staging_alunos daquele import_id
	•	Tentar criar/atualizar em public.alunos
	•	Inserir erros em public.import_errors
	•	Atualizar métricas de importação (imported_rows, error_rows, status)
	•	Retornar imported, skipped, errors

Observação: profile_id agora é opcional; o sistema consegue trabalhar só com BI/email.

⸻

🔧 public.matricular_em_massa(...) (v2)

Assinatura:

CREATE OR REPLACE FUNCTION public.matricular_em_massa(
  p_import_id     uuid,
  p_escola_id     uuid,
  p_curso_codigo  text,
  p_classe_numero integer,
  p_turno_codigo  text,
  p_turma_letra   text,
  p_ano_letivo    integer,
  p_turma_id      uuid
)
RETURNS TABLE(success_count integer, error_count integer, errors jsonb)

Comportamento:
	•	Garante que p_turma_id pertence a p_escola_id
	•	Seleciona em staging_alunos os registros que pertencem ao grupo e escola_id
	•	Faz matching com alunos usando:
	•	profile_id
	•	ou bi
	•	ou email
	•	Para cada aluno válido:
	•	INSERT INTO matriculas (...)
	•	ON CONFLICT (aluno_id, turma_id, ano_letivo) → reativa matrícula
	•	numero_matricula:
	•	se veio do staging → usa
	•	se NULL → trigger generate_matricula_number gera
	•	Acumula erros em JSONB com detalhes (staging_id, nome, erro)

Retorno:

{
  "success_count": 23,
  "error_count": 2,
  "errors": [
    { "staging_id": 10, "nome": "João", "erro": "Aluno não encontrado..." }
  ]
}


⸻

🔧 generate_matricula_number (trigger)
	•	Sequência global matricula_seq
	•	Prefixo pseudo-curto derivado de escola_id
	•	Formato: ABC-000123
	•	Roda apenas quando numero_matricula é nulo.

⸻

🔧 Normalizadores
	•	normalize_text(text) → minúsculo, sem acentos, espaços normalizados
	•	normalize_date(text) → tenta múltiplos formatos (YYYY-MM-DD, DD/MM/YYYY, etc.)

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
	•	Upload → Staging → Importação → Histórico → Erros

✅ profile_id opcional:
	•	Não trava o fluxo se a escola não usar profiles ainda

✅ RPC importar_alunos à prova de reexecução
✅ RPC matricular_em_massa com validações e logs de erro
✅ Trigger de número de matrícula (generate_matricula_number)
✅ Template institucional de PDFs
✅ Declaração de matrícula com QR e assinatura
✅ Novo ColumnMapper preparado para matrícula em massa
✅ Componente MatriculasEmMassa para o front
✅ Migrations com índices específicos para performance
✅ Documentação técnica inicial (docs/prerequisitos-documentos.md + este README)

⸻

10. Próximas Etapas
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
