# Fiscal UI/UX — Fase 5

Data: 2026-03-25
Status: Implementado (com pendências de integração final)

## Objetivo

Consolidar uma superfície única de operação fiscal no portal financeiro com foco em:

- emissão de documentos fiscais;
- operação de compliance (health check KMS + exportação SAF-T);
- leitura rápida do ledger fiscal;
- acesso fiscal unificado para escolas autenticadas com permissão fiscal.

## Escopo implementado

Rota principal:

- `/financeiro/fiscal`

Componentes:

- `apps/web/src/components/fiscal/FiscalCockpit.tsx`
- `apps/web/src/components/fiscal/FiscalLedgerTable.tsx`
- `apps/web/src/components/fiscal/FiscalRowActions.tsx`
- `apps/web/src/components/fiscal/AnularModal.tsx`
- `apps/web/src/components/fiscal/SAFTExportModal.tsx`
- `apps/web/src/components/fiscal/FiscalEmissaoModal.tsx`
- `apps/web/src/components/fiscal/FiscalUpgradeGate.tsx`
- `apps/web/src/components/fiscal/types.ts`

Página:

- `apps/web/src/app/financeiro/fiscal/page.tsx`

Backend de listagem para UI:

- `apps/web/src/app/api/fiscal/documentos/route.ts` (`GET` adicionado)

## Fluxos da página

### 1) Load inicial

- A página chama `GET /api/fiscal/documentos` com `cache: 'no-store'`.
- Se `200`, renderiza cockpit + tabela de ledger.
- Se erro genérico, renderiza bloco de erro operacional.

### 2) Acesso ao módulo

- Não há bloqueio por plano no módulo fiscal.
- A página depende de autenticação e de acesso fiscal válido à empresa.

### 3) Cockpit de compliance

- `FiscalCockpit` chama `GET /api/fiscal/compliance/status?probe=1` no mount.
- Estados:
  - loading: skeleton;
  - ok: indicador verde com “Motor Criptográfico: Operacional”;
  - erro: indicador vermelho com “Falha na Ligação KMS. Contacte Suporte.”
- Ação principal: abrir modal de exportação SAF-T(AO).

### 4) Exportação SAF-T(AO)

- `SAFTExportModal` recolhe ano e mês.
- Submete para `POST /api/fiscal/saft/export`.
- Mensagens:
  - sucesso (`201/202`): confirmação de export iniciada;
  - falha (`5xx`): erro genérico para tentar novamente/contactar suporte.

### 5) Ledger fiscal

- `FiscalLedgerTable` mostra colunas:
  - Data
  - Documento
  - Cliente
  - Total
  - Hash (short + tooltip)
  - Status
  - Acções
- Linha `ANULADO` é exibida com estilo `line-through` e texto atenuado.
- Badges semânticas:
  - `EMITIDO`
  - `RETIFICADO`
  - `ANULADO`

### 6) Ações por linha

- `FiscalRowActions` aplica visibilidade por status:
  - `EMITIDO`: Anular + Retificar
  - `RETIFICADO`: Anular
  - `ANULADO`: sem ações
- Anular abre `AnularModal`.
- Retificar navega para `/financeiro/fiscal/retificar/[id]`.
- Ação de PDF fiscal por linha:
  - chama `GET /api/fiscal/documentos/{documentoId}/pdf`;
  - aplica bloqueio AGT de prévia em `pendente_assinatura` (`409 FISCAL_PREVIEW_NOT_ALLOWED`).

### 7) Anulação

- `AnularModal` exige motivo mínimo de 10 caracteres.
- Chama `POST /api/fiscal/documentos/{id}/anular`.
- Tratamento:
  - `409`: aviso com mensagem amigável do backend;
  - `5xx`: erro interno genérico;
  - sucesso: fecha modal, toast de sucesso e refresh do ledger.

### 8) Emissão fiscal

- `FiscalEmissaoModal` recolhe:
  - tipo documento (`FT|FR`)
  - ano fiscal
  - cliente
  - itens dinâmicos (descrição + valor)
- O frontend envia payload canónico de UI (`ano_fiscal`, `tipo_documento`, `cliente_nome`, `itens[{descricao,valor}]`) sem expor `serie_id`.
- O backend normaliza internamente para o contrato fiscal completo.
- Tratamento:
  - `201`: toast de sucesso com número formatado;
  - `409` (`CHAVE_FISCAL_INDISPONIVEL`/`SERIE_NAO_ENCONTRADA`): aviso orientado a configuração fiscal;
  - `5xx`: erro genérico.
- Se vier `pdf_url`, abre overlay fullscreen com visualização de PDF.

### 9) Retificação

- Rota UI implementada: `/financeiro/fiscal/retificar/[id]`.
- A página carrega o documento alvo, valida motivo (mínimo 10) e chama:
  - `POST /api/fiscal/documentos/{documentoId}/rectificar`
- Em sucesso, mostra toast e retorna para `/financeiro/fiscal`.

## Contratos API usados

- `GET /api/fiscal/documentos`
- `POST /api/fiscal/documentos`
- `POST /api/fiscal/documentos/{documentoId}/rectificar`
- `POST /api/fiscal/documentos/{documentoId}/anular`
- `POST /api/fiscal/saft/export`
- `GET /api/fiscal/compliance/status?probe=1`

## Tokens visuais aplicados

- Base: `bg-slate-50` (página), `bg-white` (cards), `border-slate-200`.
- Primário: `#1F6B3B`.
- Upsell/atenção: `#E3B23C`.
- Erro: tons `red-*`.
- Tipografia:
  - títulos: `font-sora`;
  - dados hash/criptografia: `Geist Mono, monospace`.
- Forma:
  - cartões/modais/botões/tabela externa: `rounded-xl`.

## Pendências e próximos passos

1. Validar smoke funcional autenticado em ambiente local/prod (`probe=1` + emissão + retificação + anulação + export).
2. Evoluir refresh de tabela para invalidação local sem `window.location.reload()`.
