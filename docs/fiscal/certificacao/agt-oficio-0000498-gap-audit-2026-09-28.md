# Auditoria AGT — Ofício Ref. 0000498/01180000/AGT/2026

Data da auditoria: 2026-09-28  
Base: ofício AGT de 29/03/2026 — “Solicitação de informação adicional”  
Empresa: MOXI SOLUÇÕES – COMÉRCIO GERAL E PRESTAÇÃO DE SERVIÇOS, (SU), LDA.  
NIF produtor: 5002637618  
Produto: KLASSE

## Estado executivo

**Estado: NO-GO para envio do dossiê final.**

O KLASSE possui uma base fiscal significativamente mais madura do que em março,
mas o pacote pedido pela AGT ainda não está materialmente fechado.

A matriz histórica de 2026-03-29 não deve ser usada como estado atual sem
revalidação. Esta auditoria encontrou falsos positivos e evidências antigas que
não satisfazem o contrato atual.

Principais bloqueios atuais:

1. P1 não está provado: o documento histórico `FR FR/1` usado como evidência
   possui `cliente_nif=999999999` e cliente “Consumidor final”; não prova
   “cliente que forneceu NIF”.
2. P6 não possui documento live com duas linhas; o banco atual tem zero
   documentos fiscais com `count(itens) >= 2`.
3. P7 possui motor/oráculo determinístico para desconto de linha + desconto
   global, mas o fluxo canónico de emissão não expõe desconto global; o live tem
   zero linhas com `settlement_amount != 0`.
4. P8 possui documentos USD live e SAF-T com nó `Currency`, porém o PDF atual
   usa totais `*_aoa` e etiqueta-os com a moeda do documento; em USD isso pode
   apresentar montantes AOA como USD. Não usar como evidência antes da correção.
5. P9/P10: o fluxo persiste cliente sem NIF com NIF fiscal
   `999999999`, e tanto PDF quanto SAF-T colapsam esse caso para
   “Consumidor final”. Isso não preserva o requisito “cliente identificado,
   mas sem NIF”.
6. P11/P14: existem GR/GT/FG históricos, mas os números legados
   `GR-000001`, `GT-000001`, `FG-000001` não satisfazem o parser semântico
   atual, que exige o formato canónico `TIPO SERIE/NUMERO`. Regenerar.
7. P13 pode ser formalmente **Não aplicável**: o contrato atual não permite
   `GF` e o SAF-T mantém `SelfBillingIndicator=0`; não implementar
   auto-faturação apenas para a certificação se o produto não a oferece.
8. P17 histórico não é o pacote final: o export março
   `0998ad5b-1c05-4a0c-9348-e277080b783b` foi XSD-validado com 29 documentos,
   mas não inclui os exemplos posteriores de abril. O export abril existente
   foi gerado antes dos documentos e tem summary com zero documentos.
9. A pasta `agents/outputs/fiscal/agt/PDFS_AGT/` não contém PDFs finais
   do dossiê; apenas README/.gitkeep.
10. A entidade fiscal live continua sem `certificado_agt_numero`; não usar
    fallback `0/AGT` como evidência final sem confirmação formal da AGT.

## Matriz atual P01–P17

| Ponto | Requisito do ofício | Evidência atual | Estado 2026-09-28 | Gap / ação |
|---|---|---|---|---|
| P01 | Fatura para cliente que forneceu NIF | Suporte de schema existe; cadeia histórica P3/P4/P5 usa NIF 5002637618 | **BLOCKED EVIDENCE** | Emitir nova FT/FR normal, estado emitido, cliente identificado com NIF; gerar PDF/XML. Não usar FR FR/1, pois é consumidor final. |
| P02 | Fatura anulada + PDF após anulação visível + registo DB/SAF-T | 4 FT anuladas live; PDF renderiza watermark `ANULADA`; SAF-T mapeia status para `A` | **PARTIAL** | Escolher novo caso canónico, capturar PDF antes/depois, provar evento/motivo/data e presença no SAF-T final. |
| P03 | Documento para conferência (pró-forma) | PP suportada; `PP PP/3` histórico existe | **PARTIAL / REGENERATE** | Gerar PP canónica do dossiê; PDF final; não depender do exemplo curto/legado. |
| P04 | Fatura baseada no P03 com OrderReferences | `FT FR/6` aponta para PP; builder serializa `OrderReferences` | **PARTIAL / REGENERATE** | Nova cadeia PP → FT; validar nó no XML final e PDF. |
| P05 | NC baseada na fatura P04 | `NC NC/3` aponta para FT; builder serializa `References` | **PARTIAL / REGENERATE** | Nova cadeia FT → NC; validar `Reference`/Reason e PDF final. |
| P06 | 2 linhas: uma 14%/5%, outra isenta com código/motivo | Engine/schema suportam 14%, 5%, isenção Mxx e TaxExemptionReason/Code | **BLOCKED EVIDENCE** | Live possui zero docs com 2+ itens. Emitir exatamente o cenário pedido e validar PDF/XML/DB. |
| P07 | qty=100, unit=0.55, desconto linha 8.8% + desconto global | Oráculo determinístico possui cenário; SAF-T suporta SettlementAmount por linha | **BLOCKED IMPLEMENTATION** | Fluxo de emissão canónico não recebe `globalDiscountPct`; live tem zero settlement !=0. Integrar desconto global ao documento real, persistência, PDF e SAF-T. |
| P08 | Documento em moeda estrangeira | FT USD live com câmbio 920; SAF-T gera Currency/ExchangeRate | **BLOCKED PDF** | Corrigir PDF: hoje totais AOA são renderizados com label USD. Depois emitir/selecionar caso canónico e validar reconciliação moeda ↔ AOA. |
| P09 | Cliente identificado sem NIF, GrossTotal < 50 AOA, SystemEntryDate antes das 10h | Não há candidato live que satisfaça total+horário | **BLOCKED** | Preservar nome/identidade do cliente sem NIF; não colapsar para “Consumidor final”. Emitir <50 AOA antes das 10h de Luanda e provar timestamp. |
| P10 | Outro cliente identificado sem NIF | API aceita nome sem NIF, mas PDF/SAF-T colapsam NIF 999999999 para Consumidor final | **BLOCKED IMPLEMENTATION** | Modelar CustomerID/CompanyName do cliente identificado separadamente do tax ID de consumidor final e provar PDF/XML. |
| P11 | Duas guias de remessa | GR/GT suportados; 2 GR + 2 GT históricos live | **PARTIAL / REGENERATE** | Números históricos `GR-...`/`GT-...` não passam parser atual; gerar duas guias canónicas e validar XML/layout. |
| P12 | Orçamento ou fatura pró-forma | PP suportada | **PARTIAL** | Gerar evidência dedicada ou mapear explicitamente a PP de P03, se aceite no dossiê. |
| P13 | Fatura genérica (se aplicável) + auto-faturação | `GF` não está no enum de emissão; `SelfBillingIndicator=0` fixo | **NA CANDIDATE** | Declarar formalmente “Não aplicável” se KLASSE não oferece GF/auto-faturação. Não implementar feature apenas para satisfazer teste. |
| P14 | Fatura global | `FG` está no enum; 2 FG históricas live | **PARTIAL / REGENERATE** | Como o produto permite FG, AGT pode exigir exemplo. Regenerar em numeração canónica e incluir PDF/XML; ou remover formalmente a feature antes da submissão. |
| P15 | Outros tipos emitidos pela aplicação | Enum atual: FR, FT, NC, ND, RC, RE, PP, GR, GT, FG | **PARTIAL** | Incluir exemplos dos tipos suportados ainda não demonstrados nos pontos anteriores, especialmente ND/RC e RE se permanecer suportado. |
| P16 | Indicar documento de exemplo enviado por ponto | Matriz histórica existe | **PARTIAL** | Esta matriz passa a ser a base; preencher doc_id, número, PDF, XML node/checksum e status final de cada ponto. |
| P17 | Um único SAF-T com todos os exemplos e HashControl | Export março XSD-validado com 29 docs | **BLOCKED FINAL PACKAGE** | Gerar novo SAF-T consolidado apenas depois de todos os casos finais existirem, cobrindo os dois meses usados no dossiê, e rodar XSD + semântica + hash/signature/replay. |

## Requisitos transversais do ofício

### PDFs em dois meses diferentes

O live possui documentos em fevereiro, março e abril de 2026, portanto existe
matéria histórica em mais de um mês. Isso **não fecha o requisito automaticamente**:
os documentos finais selecionados para P01–P15 precisam, em conjunto, cobrir pelo
menos dois meses e continuar válidos sob as regras atuais.

Não criar/backdate documentos fictícios. Preferir evidência histórica realmente
conforme + novos casos atuais, ou aguardar orientação da AGT se exigir nova janela.

### PDF — hash curto + mensagem do software

O endpoint atual extrai quatro caracteres de `hash_control` e os imprime no
rodapé. O texto atual é:

`<HASH4> - Processado por programa validado n.º <agtNumber>/AGT`

O ofício usa formulação diferente (“Processado por programa válido ...”).
Além disso, `certificado_agt_numero` está vazio no live e o PDF cai para `0/AGT`.

**Gate:** não enviar PDF com `0/AGT` como evidência final sem confirmação AGT
sobre o valor/formato esperado durante a pré-certificação.

### Identidade do cliente sem NIF

Hoje:

- emissão aceita `cliente.nome` sem `nif`;
- persistência usa/faz fallback fiscal para `999999999`;
- PDF, ao ver `999999999`, substitui o nome por “Consumidor final”;
- SAF-T `resolveCustomerIdentity` faz o mesmo e usa um único
  `CustomerID=NIF-999999999`.

Isso conflita com os P09/P10 do ofício, que pedem **cliente identificado**
sem NIF. É um gap de modelagem, não apenas de evidência.

### Moeda estrangeira — bug documental

O PDF recebe `total_liquido_aoa`, `total_impostos_aoa` e
`total_bruto_aoa`, mas usa `documento.moeda` como label.

Exemplo live:

- documento: `FT FR/15`;
- moeda: USD;
- câmbio: 920;
- líquido AOA: 46.000;
- bruto AOA: 52.440.

No template atual, os totais podem aparecer como “46.000 USD / 52.440 USD”.
Não utilizar o PDF FX enquanto isso não for corrigido.

## O que já está forte

- hash_control persistido e cadeia fiscal;
- PDF mostra watermark ANULADA;
- SAF-T mapeia anulação para status A e exige data/motivo;
- `OrderReferences` e `References` existem no builder;
- isenção exige code/reason;
- Currency/ExchangeRate existe no SAF-T;
- XSD oficial integrado;
- engine decimal determinística possui cenário de desconto global;
- KMS fiscal/AGT agora existe e runtime Vercel OIDC está configurado;
- documentos live existem em múltiplos meses;
- matriz e tooling histórico podem ser reaproveitados.

## Sprint de fecho recomendada

### P0 — corrigir antes de produzir qualquer dossiê

1. Corrigir cliente identificado sem NIF em PDF + SAF-T.
2. Corrigir PDF de moeda estrangeira para usar montantes da moeda do documento.
3. Integrar desconto global no fluxo canónico de emissão/persistência/PDF/SAF-T.
4. Decidir formalmente o escopo de tipos:
   - manter ou remover `FG`;
   - `GF`/auto-faturação = NA se não oferecidos;
   - decidir se `RE` permanece tipo exposto.
5. Garantir numeração canónica para PP/GR/GT/FG usados no dossiê.

### P1 — gerar dataset de certificação

Gerar/selecionar, sem adulterar histórico:

- P01 cliente com NIF;
- P02 anulado;
- P03 PP;
- P04 FT referenciando PP;
- P05 NC referenciando FT;
- P06 2 linhas tributada + isenta;
- P07 100 x 0.55 + 8.8% + global;
- P08 FX;
- P09 identificado sem NIF <50 antes 10h;
- P10 segundo identificado sem NIF;
- P11 duas guias;
- P12 PP/orçamento;
- P14 FG se mantida;
- P15 ND/RC/RE aplicáveis.

### P2 — artefatos finais

Para cada ponto:

- doc_id;
- numero_formatado;
- PDF;
- hash curto mostrado;
- XML node correspondente;
- verificação DB ↔ PDF ↔ XML;
- status `READY` ou `NA` justificado.

Depois:

1. gerar **um único SAF-T** cobrindo todos os exemplos;
2. validar XSD;
3. validar semântica;
4. validar hash/signature/replay;
5. preencher matriz final P01–P17;
6. montar carta de resposta citando
   `Ref. 0000498/01180000/AGT/2026`.

## Gate final

Somente declarar **READY TO SUBMIT** quando:

- P01–P17 = READY ou NA formalmente justificável;
- nenhum PDF usa `0/AGT` sem confirmação explícita da AGT;
- P09/P10 preservam cliente identificado sem NIF;
- P08 não mistura total AOA com label de moeda externa;
- P07 existe como documento real, não apenas oracle;
- SAF-T final contém exatamente o conjunto documental do dossiê;
- evidência cobre dois meses;
- XSD + semantic + hash + signature + replay = PASS;
- PDFs finais estão materializados em `agents/outputs/fiscal/agt/PDFS_AGT/`.

## Atualização de implementação — 2026-09-28 / PR #129

PR #129 foi mergeado em `fix/bill-010-document-lifecycle`
(`21033a7ecaf9bccaf76d7285a36d9a7d4f02b67a`).

Os gaps P07–P10 foram corrigidos em código e cobertos por regressão:

- **P07 — CODE READY / EVIDENCE PENDING**: emissão canónica aceita
  `line_discount_pct` e `global_discount_pct`, normaliza-os para
  `unit_price_base`, preço líquido e `settlement_amount`. Cenário
  `100 x 0,55 + 8,8% + 1,5%` resulta em base `0,55`,
  `SettlementAmount=5,59` e `UnitPrice=0,4941`.
- **P08 — CODE READY / EVIDENCE PENDING**: PDF em moeda estrangeira passa a
  usar `total_*_moeda`, evitando etiquetar totais AOA como USD.
- **P09/P10 — CODE READY / EVIDENCE PENDING**: cliente identificado sem NIF
  mantém nome/morada em emissão, PDF e SAF-T; o placeholder fiscal
  `999999999` deixa de o colapsar para “Consumidor final”. SAF-T usa
  `CustomerID=SNIF-...` para estes casos.
- suíte fiscal no head do PR: **65/65 PASS**; AWS/OIDC: **3/3 PASS**;
  Security/UI PASS. O KF2 global permaneceu vermelho por findings não
  relacionados.

### Novo gate antes de emitir o dataset

O live foi reconsultado após o merge:

- séries locais `PP`, `GR` e `GT` existem como `legacy`;
- as séries FE (`FT/NC/ND/RC/FG`, e `RE` se declarado) exigem
  `agt_status=provisioned` pelo contrato atual;
- **nenhuma série FE está provisionada** hoje;
- `fiscal_empresas.certificado_agt_numero` continua sem binding válido.

Portanto, não se deve contornar `AGT_SERIES_REQUIRED` para produzir o
dossiê. O próximo executor deve rodar preflight e permanecer fail-closed até
o binding/canal AGT estarem disponíveis.

