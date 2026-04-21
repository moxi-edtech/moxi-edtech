# Session Notes — Fiscal/AGT

Data: 2026-04-21
Contexto: consolidação documental da frente de certificação AGT e alinhamento de roadmap fiscal.

## 1) Entregas documentais criadas/atualizadas na sessão

### 1.1 Roadmap estratégico (longo prazo)
- Criado:
  - `docs/fiscal/operacao/roadmap-vertical-escolar-para-engine-fiscal-comercial.md`
- Conteúdo:
  - transição de "vertical escolar" para "engine fiscal comercial";
  - fases A..E (Foundation, Compliance, Produto, Plataforma, Monetização);
  - KPIs e próximos passos.

### 1.2 Sincronização do pacote AGT (estado real)
- Atualizados:
  - `agents/outputs/fiscal/agt/CHECKLIST_EXECUCAO_AGT_2026-03-29.md`
  - `agents/outputs/fiscal/agt/MATRIZ_RESPOSTA_AGT_2026-03-29.md`
  - `docs/fiscal/operacao/roadmap-certificacao-agt-2026-03-29.md`
- Ajustes aplicados:
  - alinhamento de status por ponto com execução real;
  - nota explícita de cobertura de tipologias emitidas;
  - status do ponto 17 refletido como `READY` no roadmap;
  - observação técnica sobre PDF fiscal em template único.

### 1.3 Plano operacional de fecho AGT (execução curta)
- Atualizados:
  - `agents/outputs/fiscal/agt/PLANO_FECHO_PENDENCIAS_2026-04-02.md`
  - `agents/outputs/fiscal/agt/INDEX_PACOTE_AGT_2026-03-29.md`
  - `agents/outputs/fiscal/agt/PDFS_AGT/README.md`
- Conteúdo:
  - plano D+1 a D+3 para fecho;
  - lista fechada de PDFs por ponto AGT;
  - convenção de nomes e checklist mínimo por evidência.

## 2) Decisões e clarificações técnicas relevantes

1. Certificação AGT continua no caminho crítico.
- O roadmap comercial não deve entrar na trilha de execução crítica da submissão AGT.

2. Emissão no ato de pagamento (Financeiro escolar) está alinhada para Fase 1.
- Fluxo atual: `immediate_payment` -> `FR` no adapter fiscal.
- Estado financeiro fiscaliza vínculo e idempotência com `financeiro_fiscal_links` + `status_fiscal`.

3. Cobertura de PDF fiscal por tipologia existe, mas com template único.
- Tipos em cobertura operacional: `FT`, `FR`, `RC`, `NC`, `ND`, `PP`, `GR`, `GT`, `FG`.
- Pendência pós-fecho AGT: layouts dedicados por tipologia para UX/compliance avançada.

## 3) Estado de execução ao fim da sessão

- Pacote AGT: atualizado documentalmente, ainda com pendências operacionais por ponto.
- Prioridade imediata permanece:
  - anexar PDFs por ponto em `PDFS_AGT/`;
  - fechar validações `PDF = XML = DB`;
  - concluir itens bloqueados/NA formal (especialmente ponto 13 e ponto 15).

## 4) Nota de operação Git (sessão)

- Tentativa de `git pull --ff-only` trouxe fetch remoto, mas sem fast-forward por divergência (`ahead 3, behind 3`).
- Não houve descarte automático de alterações locais.

