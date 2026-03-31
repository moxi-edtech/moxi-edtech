# Roadmap de Certificação AGT (SAF-T AO) — KLASSE

Data base: 2026-03-29  
Prazo AGT: 15 dias úteis após notificação (alvo interno: 2026-04-15)  
Escopo: responder integralmente ao ofício de solicitação de informação adicional.

## 1. Objetivo

Entregar um pacote de evidências auditável com:

- PDFs dos documentos de exemplo solicitados pela AGT;
- 1 XML SAF-T único contendo os exemplos aplicáveis;
- mapeamento explícito ponto AGT -> documento enviado;
- validação técnica (hash, assinatura e cadeia).

## 2. Plano por fases

| Fase | Janela | Entrega |
|---|---|---|
| F0 - Governança | D0 | Dono, matriz mestre e freeze de escopo fiscal |
| F1 - Cobertura documental | D0-D4 | Geração dos exemplos 1..14 (ou N/A justificado) |
| F2 - Pacote técnico | D3-D6 | SAF-T único + validação XSD + provas criptográficas |
| F3 - Dossiê AGT | D5-D8 | PDFs, matriz final e carta de submissão |
| F4 - Pré-submissão | D8-D10 | Simulação de auditoria interna e correções finais |
| F5 - Submissão | D10-D15 | Envio oficial + protocolo + contingência |

## 3. Matriz operacional AGT (1..17)

| Ponto AGT | Exigência | Status | Evidência esperada | Observação |
|---|---|---|---|---|
| 1 | Fatura com cliente com NIF | PENDENTE | PDF + doc_id + hash_control | Tipo FT/FR |
| 2 | Fatura anulada + PDF após anulação visível | PENDENTE | PDF antes/depois + doc_id origem + anulação | Estado deve refletir no SAF-T |
| 3 | Documento de conferência (pró-forma) | PENDENTE | PDF + doc_id | Se não aplicável, declarar |
| 4 | Fatura baseada no ponto 3 (Order References) | PENDENTE | PDF + XML com referência | Validar OrderReference |
| 5 | Nota de crédito com base no ponto 4 | PENDENTE | PDF + XML de referência | Se 4 não aplicável, referenciar outro doc |
| 6 | Documento 2 linhas: 1 tributada (14%/5%) + 1 isenta com código | PENDENTE | PDF + XML com TaxExemption* | Incluir código legal da tabela AGT |
| 7 | Documento com qty 100, unit 0.55, desconto de linha 8.8% e desconto global | PENDENTE | PDF + XML com SettlementAmount | Garantir casas decimais |
| 8 | Documento em moeda estrangeira | PENDENTE | PDF + XML com Currency | Omitir Currency apenas para AOA |
| 9 | Cliente identificado sem NIF, total < 50 AOA, lançamento antes das 10h | PENDENTE | PDF + timestamps + XML | Validar regra de horário |
| 10 | Outro cliente identificado sem NIF | PENDENTE | PDF + XML | Aplicar fallback fiscal do cliente |
| 11 | Duas guias de remessa | PENDENTE | 2 PDFs + XML | Se não aplicável, declarar |
| 12 | Orçamento ou fatura pró-forma | PENDENTE | PDF + XML | Se não aplicável, declarar |
| 13 | Fatura genérica e auto-faturação | PENDENTE | PDFs + XML | Se não aplicável, declarar por item |
| 14 | Fatura global | PENDENTE | PDF + XML | Se não aplicável, declarar |
| 15 | Exemplo de outros tipos emitidos pela aplicação | PENDENTE | PDFs + XML | Catálogo de tipos extras |
| 16 | Para cada ponto, indicar qual documento foi enviado | PENDENTE | Matriz final preenchida | Campo obrigatório do dossiê |
| 17 | SAF-T único com todos exemplos e HashControl preenchido | PENDENTE | XML final + validação XSD | Entrega central da certificação |

## 3.1 Gaps técnicos explícitos (pré-condição de GO)

Estado atual do motor fiscal: cobertura parcial para os cenários do ofício AGT.

Itens a implementar antes de submissão:

1. Tipologias documentais não suportadas na API/schema atual:
- `PP` (pró-forma)
- `GR`/`GT` (guia de remessa/transporte)
- `FG` (fatura global)

2. Nós XML obrigatórios ainda não serializados:
- `OrderReferences` (pontos 4 e 5)
- `SettlementAmount` (ponto 7)

3. Parametrização de comportamento fiscal ainda fixa:
- `SelfBillingIndicator` atualmente fixo em `0` (deve ser parametrizável para cenários de auto-faturação).

4. Cobertura por tipologia em fluxo documental:
- gerar explicitamente os pares de referência exigidos (pró-forma -> fatura -> nota de crédito);
- produzir documentos de transporte quando aplicável, ou formalizar `Não aplicável` com justificativa.

Sem estes itens, o status permanece `NO-GO` para certificação formal.

## 3.2 Regras de consistência obrigatórias (anti-reprovação)

### Regra 1 — Coerência temporal

- Os documentos de evidência devem estar distribuídos em, no mínimo, dois períodos contabilísticos distintos.
- `InvoiceDate` e `SystemEntryDate` devem refletir essa separação temporal.
- O SAF-T final deve representar corretamente os períodos usados nas evidências.

Critério de aceite:
- existência comprovada de evidências em dois meses distintos;
- período do SAF-T compatível com os documentos anexados.

### Regra 2 — Consistência documental (PDF vs XML vs DB)

Para cada documento da matriz AGT:

- valores de linhas, impostos e totais no PDF devem ser idênticos aos valores no XML;
- os mesmos valores devem corresponder aos registros persistidos em base de dados;
- `hash_control` deve corresponder ao documento persistido.

Critério de aceite:
- divergência numérica permitida: `0.0000` (zero);
- qualquer divergência bloqueia o ponto como `BLOQUEADO`.

### Regra 3 — Encadeamento entre documentos relacionados

- Pró-forma -> Fatura: referência obrigatória no XML (`OrderReferences`);
- Fatura -> Nota de crédito: referência obrigatória ao documento de origem;
- cadeia fiscal deve permanecer coerente em `hash_control` e referências.

Critério de aceite:
- 100% dos pares relacionados com referência válida e rastreável.

### Regra 4 — Isolamento multi-tenant (RLS e escopo)

- Cada exportação SAF-T deve conter apenas documentos de uma única `empresa_id`;
- nenhuma linha/documento de outra entidade pode aparecer no XML final;
- filtros de exportação e consultas devem respeitar escopo da empresa vinculada à escola.

Critério de aceite:
- zero ocorrências cross-tenant nos testes de amostragem e validação final.

### Regra 5 — Precisão numérica e arredondamento

- `UnitPrice` e cálculos de linha devem suportar precisão de pelo menos 4 casas decimais;
- descontos de linha e desconto global devem refletir corretamente `SettlementAmount`;
- somatório das linhas deve reconciliar com os totais documentais sem diferença acumulada.

Critério de aceite:
- diferença acumulada de reconciliação = `0.0000`.

## 4. Artefatos obrigatórios

1. `agents/outputs/fiscal/agt/MATRIZ_RESPOSTA_AGT_2026-03-29.md`  
2. `agents/outputs/fiscal/agt/PDFS_AGT/`  
3. `agents/outputs/fiscal/agt/PAYLOADS_EXECUCAO_AGT_2026-03-30.md`  
4. `agents/outputs/fiscal/agt/SAFT_AGT_UNICO_2026-03.xml`  
5. `agents/outputs/fiscal/agt/FISCAL_HASH_VALIDATION_PROD_YYYYMMDD.md`  
6. `agents/outputs/fiscal/agt/FISCAL_SIGNATURE_VALIDATION_PROD_YYYYMMDD.md`  
7. `agents/outputs/fiscal/agt/FISCAL_REPLAY_AUDIT_PROD_YYYYMMDD.md`

## 5. Critérios de GO/NO-GO

GO somente se:

1. Matriz 1..17 sem lacunas (ou N/A formal e defensável);
2. SAF-T único válido no XSD oficial `SAF-T-AO1.01_01.xsd`;
3. Hash, assinatura e replay audit em PASS;
4. Evidências PDF em dois meses distintos, conforme pedido;
5. Mensagens fiscais e HashControl consistentes no XML e nos documentos.

NO-GO se qualquer item acima falhar.

## 6. Responsabilidades recomendadas

| Frente | Responsável | SLA |
|---|---|---|
| Emissão dos casos e ajustes de negócio | Financeiro Escolar + Produto | D0-D4 |
| Motor fiscal, SAF-T e validação XSD | Engenharia Fiscal | D0-D8 |
| Provas criptográficas e rastreabilidade | Engenharia Plataforma | D3-D8 |
| Dossiê e submissão AGT | Operações/Compliance | D8-D15 |

## 7. Sprint de implementação (gaps de engine)

Objetivo: fechar gaps de tipologia/XML antes da rodada final de evidências.

1. Sprint A (D0-D2)
- Expandir enums/schemas/API para `PP`, `GR`/`GT`, `FG`.
- Ajustar validações Zod e contratos de emissão.

2. Sprint B (D2-D4)
- Implementar `OrderReferences` no builder SAF-T (pontos 4 e 5).
- Implementar `SettlementAmount` (linha/cabeçalho) com precisão decimal exigida.

3. Sprint C (D4-D5)
- Parametrizar `SelfBillingIndicator` e cobrir cenário de auto-faturação.
- Executar testes de regressão FT/RC/NC e smoke fiscal completo.

4. Sprint D (D5-D6)
- Gerar novos exemplos documentais e consolidar XML único final.
- Revalidar no XSD oficial + hash/signature/replay audit.

## 8. Fase F4.1 — Simulação de Auditor AGT (obrigatória)

Executar antes da submissão oficial:

1. Selecionar documento aleatório do pacote final;
2. Recalcular `hash_control` com o verificador externo;
3. Validar assinatura com chave pública da `key_version` correspondente;
4. Verificar referências com documento relacionado (quando aplicável);
5. Confirmar consistência do documento no SAF-T final.

Resultado esperado:
- PASS completo em hash, assinatura, cadeia documental e consistência de dados.

Saída obrigatória:
- relatório anexado em `agents/outputs/fiscal/agt/` com evidência da simulação.
