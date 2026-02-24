# 📘 KLASSE – Pautas Ministeriais (Pacote Técnico Oficial)

Versão: 2026-02-05  
Status: Liberado para Implementação  
Owner: Académico Engine Team

---

## 🔥 1. Scope (O que será entregue neste pacote)

Implementar no KLASSE todos os documentos exigidos pelo sistema de educação angolano:
1. Mini-Pauta
2. Pauta Trimestral
3. Mapa de Aproveitamento por Disciplina
4. Mapa Geral da Turma
5. Relatório de Aproveitamento
6. Pauta de Faltas (futuro, pós-módulo de assiduidade)

Formatos idênticos ao do MINED, mas com:
- layout modernizado
- fontes consistentes
- PDF 100% estável
- auditoria
- cabeçalho oficial
- geração pelo servidor (server action / API)

---

## 🧩 2. Pontos de Integração Existentes (onde plugar)

### 2.1. UI já disponível

- Pauta do professor (grid com autosave): `apps/web/src/app/professor/notas/page.tsx`
- Ações rápidas de pauta (secretaria): `apps/web/src/components/secretaria/PautaRapidaModal.tsx`
- Turma detalhada (atalhos de pauta): `apps/web/src/components/secretaria/TurmaDetailClient.tsx`
- Declaração de notas com layout oficial: `apps/web/src/app/secretaria/documentos/[docId]/notas/print/page.tsx`
- Rotinas/horários (UI client-side): `apps/web/src/app/escola/[id]/rotina/page.tsx`

### 2.2. APIs candidatas

- Pauta do professor (dados por turma/disciplina): `apps/web/src/app/api/professor/pauta/route.ts`
- Lançamento de notas (batch + auditoria): `apps/web/src/app/api/professor/notas/route.ts`
- Períodos letivos (trimestres): `apps/web/src/app/api/professor/periodos/route.ts`
- Pauta XLSX por turma: `apps/web/src/app/api/secretaria/turmas/[id]/pauta/route.ts`
- Pauta em branco XLSX: `apps/web/src/app/api/secretaria/turmas/[id]/pauta-branca/route.ts`
- Mini‑pautas XLSX por disciplina: `apps/web/src/app/api/secretaria/turmas/[id]/mini-pautas/route.ts`
- Atribuição de professor + horários JSON: `apps/web/src/app/api/secretaria/turmas/[id]/atribuir-professor/route.ts`

### 2.3. DB / Views já úteis

- Notas e avaliações: tabelas `notas`, `avaliacoes`
- Matrículas e turma: `matriculas`, `turmas`, `turma_disciplinas`, `turma_disciplinas_professores`
- Configuração de avaliação: `configuracoes_escola`
- View consolidada para boletim: `supabase/migrations/20260203000008_materialize_vw_boletim.sql`
- RPC de batch auditado: `supabase/migrations/20260203000007_rpc_lancar_notas_batch.sql`
- Rotinas (legado/estrutura base): `supabase/migrations_archive/migrations/20250915000000_remote_schema.sql`
- Períodos letivos existentes: `periodos_letivos`, `anos_letivos`

### 2.4. PDF e layouts

- `@react-pdf/renderer`: `apps/web/src/components/secretaria/FichaInscricaoPDF.tsx`
- `pdf-lib` para templates institucionais: `apps/web/src/lib/pdf/documentTemplate.ts`

### 2.5. Plug recomendado por feature

- Mini‑Pauta: evoluir `mini-pautas` (XLSX → PDF) usando `vw_boletim_por_matricula`.
- Pauta Trimestral: unir `professor/pauta` + `periodos` e gerar PDF oficial.
- Mapa de Aproveitamento: reaproveitar `vw_boletim_por_matricula` com layout ministerial.
- Mapa Geral da Turma: consolidar notas por disciplina a partir de `vw_boletim_por_matricula`.
- Relatório de Aproveitamento: partir da rota de declaração de notas e adicionar sumários.
- Pauta de Faltas: expandir depois do módulo de `presencas`.

### 2.6. Implementação atual (Sprint 0)

- Grade reativa (professor): `apps/web/src/components/professor/GradeEntryGrid.tsx`.
- Grade secretaria: `apps/web/src/app/secretaria/(portal-secretaria)/notas/page.tsx`.
- API grade secretaria: `GET /api/secretaria/turmas/:id/pauta-grid`.
- API salvar notas secretaria: `POST /api/secretaria/notas`.
- PDF Mini‑Pauta: `apps/web/src/templates/pdf/ministerio/MiniPautaV2.tsx`.
- PDF Pauta Trimestral: `apps/web/src/templates/pdf/ministerio/PautaTrimestralV1.tsx`.
- Export PDF na secretaria: `apps/web/src/components/secretaria/PautaRapidaModal.tsx`.

---

## 🧱 3. Estrutura de Dados (SSOT Oficial)

### 2.1. Tabela: avaliacao_periodos

- id uuid pk
- escola_id uuid fk
- nome text -- "1º Trimestre", "2º Trimestre", etc.
- data_inicio date
- data_fim date
- status text -- 'aberto', 'fechado'

### 2.2. Tabela: avaliacao_notas

- id uuid pk
- aluno_id uuid
- turma_id uuid
- disciplina_id uuid
- periodo_id uuid
- avaliacao1 decimal
- avaliacao2 decimal
- avaliacao3 decimal
- avaliacao4 decimal
- mac decimal
- npt decimal
- mt1 decimal
- mt2 decimal
- status text -- 'draft', 'ok', 'revisto'
- updated_by uuid
- updated_at timestamptz

### 2.3. Tabela: avaliacao_comportamento

- id uuid pk
- aluno_id uuid
- turma_id uuid
- comp text -- 'Bom', 'Mau', 'Regular'
- assid text -- 'Boa', 'Mau'

---

## ⚙ 4. RPCs Oficiais

### 3.1. gerar_pauta_trimestral(turma_id, periodo_id)

Retorna um JSON estruturado com:
- lista de alunos
- notas
- MAC, NPT, MT1/MT2
- comportamento
- estatísticas

### 3.2. gerar_mapa_disciplina(turma_id, periodo_id, disciplina_id)

Retorna:
- nº matriculados
- nº avaliados
- nº bom aproveitamento
- nº mau aproveitamento
- percentuais

### 3.3. gerar_mapa_geral(turma_id, periodo_id)

Retorna visão consolidada:
- por disciplina
- totais
- comparativos
- média geral da turma

---

## 🛠 5. Endpoints

GET /api/academico/turmas/[turmaId]/pauta/trimestre/[periodoId]

Retorna JSON pronto para o PDF.

GET /api/academico/turmas/[turmaId]/pauta/disciplina/[disciplinaId]/[periodoId]

GET /api/academico/turmas/[turmaId]/pauta/geral/[periodoId]

---

## 🖨 6. Geração de PDF (Server-Side)

Biblioteca recomendada: @react-pdf/renderer (Next.js SSR-ready)

Características:
- exporta PDF identicamente ao modelo ministerial
- aceita background watermark da escola
- cabeçalho oficial configurável
- assinatura do diretor
- logs de auditoria
- permite download e envio por e-mail

Layout baseado:
- screenshots do AngoSchool
- normas do MINED
- PDF público das escolas técnicas

---

## 🎨 7. UI/UX (KLASSE Turbo)

Posicionamento visual:
- Interface limpa, moderna e rápida
- Inputs monoespaçados (Geist Mono)
- Cards para cada disciplina
- Autosave
- Colunas fixas
- Alternância clara entre “editável” e “PDF final”

Componentes:

<NotasTableTurbo />
<ComportamentoSelector />
<PautaPreview />
<PautaPDFExport />

---

## 🔐 8. Auditoria & Permissões

Fluxo oficial:
1. Professor lança notas
2. Diretor revisa turma
3. Diretor aprova (bloqueia edição)
4. Escola gera pauta final
5. Professor não edita mais
6. Alterações tardias exigem justificativa e log
7. Logs são armazenados em academico_nota_auditoria

---

## 🔁 9. Workflow (Processo Académico Oficial)

### 8.1. Abertura de período

→ cria períodos + desbloqueia notas

### 8.2. Lançamento

→ professor adiciona avaliações, comportamento, assiduidade

### 8.3. Revisão

→ diretor da turma revisa todos os alunos

### 8.4. Fecho académico

→ período é fechado
→ notas bloqueadas

### 8.5. Geração das Pautas

→ exportação PDF
→ assinatura digital
→ envio ao Ministério

---

## 🧠 10. Vantagem Competitiva (por que isso destrói o AngoSchool)

- KLASSE terá todas as pautas que eles têm
- Layout mais limpo
- Automação 10×
- Auditoria avançada (eles não têm)
- Integração com financeiro (eles não têm)
- Geração por disciplina e global
- App professor turbo com UI de 2026

---

## 🚀 11. Próximos Passos (Para execução imediata)

### Sprint 1 — Modelos e RPCs
- Criar tabelas
- Criar RPCs com cálculos oficiais
- Criar endpoints
- Validar modelos JSON

### Sprint 2 — UI Professor Turbo
- Grade reativa (já iniciada)
- Comportamento & Assiduidade
- Autosave
- Indicação de “revisto / confirmado”

### Sprint 3 — PDFs Oficiais
- Implementar export
- Revisar com escolas piloto
- Validar com professor real
- Publicar

### Backlog imediato (execução)
- Link no menu da secretaria para `/secretaria/notas`.
- Endpoint único de metadata (escola/diretor/professor/província).
- Bloquear edição por período fechado.
- Colunas de comportamento/assiduidade na grade.
- QR Code real via URL pública de validação.

---

## 🧩 Fase 2 — Motor de Horários (Scheduler)

### Entregas base
- Migration `horario_slots`, `professor_disponibilidade`, `quadro_horarios`.
- Configuração de slots: `/escola/[id]/horarios/slots`.
- Quadro drag & drop: `/escola/[id]/horarios/quadro`.
- API slots: `GET|POST /api/escolas/[id]/horarios/slots`.
- API quadro: `GET|POST /api/escolas/[id]/horarios/quadro`.

### Backlog Fase 2
- Tabela de turnos (normalização) e UI de gestão.
- Validar conflitos de professor/sala antes de salvar.
- Persistir professor_id e sala_id no quadro.
- Edge Function de auto‑geração (IA/heurística).
- Versionamento de quadros (drafts, diff e histórico).

### Status Fase 2 (atual)
- Conflitos server-side + feedback visual (professor/sala).
- Cadastro rápido de salas no quadro.
- Persistência de professor_id/sala_id no save.
- Slots/quadro com outbox e Server-Timing.

---

## ✔ 12. Fecho

Bro, depois desse pacote, o KLASSE:
- ganha o académico
- conquista professores
- se encaixa na cultura ministerial
- vira referência visual moderna
- supera o AngoSchool por quilómetros

---

🔥 PACOTE #2 — Gerador Automático de Horários (KLASSE Engine v2)  
🔥 PACOTE #3 — Portal do Professor Turbo (UI next-level)  
🔥 PACOTE #4 — Auditoria Académica + Logs

---

## Referências relacionadas
- `agents/CONTRACTS.md`
- `agents/specs/performance.md`
- `agents/outputs/ROADMAP_REAL_DATA_IMPLEMENTATION.md`
