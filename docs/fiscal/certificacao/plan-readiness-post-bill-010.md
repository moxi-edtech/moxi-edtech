# Plano de Execução — Fiscal Readiness pós BILL-010

Data: 2026-09-27
Branch: `fix/fiscal-readiness-post-bill-010`
Base: `fix/bill-010-document-lifecycle` @ `821fbfa252eea42fd65fb87e0bebf0c8e3dff1a2`

## Regra de execução

Este plano é auto-aprovado para execução. Nenhuma migration destrutiva será aplicada sem:

1. discovery do schema/contratos reais;
2. prova de que BILL-001–003 continuam intactos;
3. negative tests de DELETE/UPDATE/TRUNCATE nos objetos fiscais/financeiros afectados;
4. migration versionada no Git com o mesmo SQL aplicado no Supabase;
5. advisors + regressão fiscal/security.

Trabalho paralelo permitido somente quando os blocos não disputam os mesmos contratos/migrations.

## Discovery concluído antes de assumir formatos

### fiscal_documento_itens

Schema real confirmado com 29 colunas. Além dos campos históricos, existem:
`tax_profile_code`, `tax_profile_version`, `tax_type`, `tax_code`,
`tax_country_region`, `operation_type`, `unit_of_measure`, `product_type`,
`unit_price_base`, `settlement_amount`, totais AOA e totais na moeda do documento.

O worker FE já lê explicitamente essas colunas.

### financeiro_ledger e reversões

`financeiro_ledger` existe e contém eventos reais.
Já possui:
- RLS;
- SELECT-only para papéis de aplicação;
- trigger `trg_fin_ledger_immutable` bloqueando UPDATE/DELETE;
- writer canónico `fn_ledger_insert_once`.

`financeiro_estornos`, `financeiro_pagamento_reversoes`,
`financeiro_pagamento_alocacoes` e `financeiro_recibo_alocacoes`
também já possuem guards de UPDATE/DELETE e SELECT-only.

Portanto BILL-009/022/023 será tratado como auditoria + delta real, não como recriação
do modelo append-only.

### fiscal_chaves / signer

`fiscal_chaves` NÃO possui `private_key_pem`.
Possui `private_key_ref`; as chaves activas usam referências `kms://...`.

Signer real:
- `kmsSigner.ts`: assinatura fiscal canónica em AWS KMS;
- `agtJws.ts`: JWS RS256 da Facturação Electrónica em AWS KMS;
- `saftDocumentSigner.ts`: cadeia SAF-T RSA-1024/SHA1 distinta, ainda PEM/env.

Gap real encontrado: grants directos excessivos em `fiscal_chaves`
(`anon/authenticated/service_role` ainda têm mutações amplas), apesar de a custódia
privada já estar fora do banco.

### AGT FE

Endpoints oficiais de homologação:
- `POST https://sifphml.minfin.gov.ao/sigt/fe/v1/registarFactura`
- `POST https://sifphml.minfin.gov.ao/sigt/fe/v1/obterEstado`

O código usa actualmente `AGT_FE_USERNAME/AGT_FE_PASSWORD`; o escopo recebido
indica credenciais `FISCAL_AGT_USERNAME/FISCAL_AGT_PASSWORD`.
A implementação aceitará ambos os nomes, priorizando o namespace FISCAL_AGT.

`softwareInfo` já existe no código, mas o binding é apenas por env.
`fiscal_empresas.certificado_agt_numero` existe e está vazio nas entidades actuais.
O BILL-027 deve tornar o vínculo auditável sem inventar número de certificação.

## Fases

### Track A — FE mapper + decimal boundary + softwareInfo

1. Criar `apps/web/src/lib/fiscal/mapper.ts` como mapper canónico dos rows reais.
2. Fazer `agtInvoicePayload.ts` delegar ao mapper para compatibilidade.
3. Eliminar cálculos autoritativos baseados em IEEE-754 do mapper.
4. Introduzir helpers decimal/string para dinheiro/rate/FX.
5. Mapear e classificar todos os `Number()/parseFloat()` fiscais e adjacentes.
6. Corrigir somente os call-sites autoritativos:
   - mapper AGT;
   - reconciliação;
   - recibos fiscais;
   - relatórios/totais usados como verdade financeira/fiscal.
7. Golden tests de arredondamento, FX, desconto, RC e limites.
8. Centralizar `softwareInfo` e garantir presença em registarFactura/obterEstado/solicitarSerie.

### Track B — Ledger / estorno hardening

1. Provar grants + RLS + guards em:
   - financeiro_ledger;
   - financeiro_estornos;
   - financeiro_pagamento_reversoes;
   - financeiro_pagamento_alocacoes;
   - financeiro_recibo_alocacoes.
2. Auditar TRUNCATE e INSERT directo.
3. Reforçar somente gaps reais:
   - guard de TRUNCATE;
   - EXECUTE dos writers;
   - idempotency/uniqueness;
   - writer internal-only.
4. Testar reversal-based accounting e zero mutação histórica.

### Track C — Custódia KMS / fiscal_chaves

1. Revogar mutações directas de `fiscal_chaves` para anon/authenticated/service_role.
2. Remover SELECT directo de material de custódia quando não for necessário ao cliente.
3. Criar RPC/admin backend canónico para registrar/rotacionar refs se necessário.
4. Exigir refs KMS e rejeitar PEM/secret literal.
5. Verificar KMS key status/algoritmo real sem expor material privado.
6. Manter SAF-T separado; não reutilizar chave FE para cadeia SAF-T.

### Track D — SAF-T semantic hardening

1. Construir oracle semântico sobre dataset real:
   FT/FR/NC/ND/RC.
2. Validar:
   - master tables referenciadas;
   - número de documentos;
   - totais líquido/imposto/bruto;
   - sourceDocuments RC;
   - tax tables/codes;
   - hash chain;
   - moedas/FX;
   - referências NC/ND.
3. Comparar XML gerado com agregados do DB antes de persistir export.
4. Manter XSD + semantic gate obrigatórios.

### Track E — Contingência

1. Auditar série `C`, origem do documento e estado AGT.
2. Modelar estados explícitos de contingência:
   provisioned -> active -> exhausted/closed.
3. Bloquear uso de série C fora de documento contingência e vice-versa.
4. Reconciliação posterior com FE normal sem renumerar histórico.
5. Readiness tests de mudança de ano e esgotamento.

### Track F — Gateways / idempotência / observabilidade

1. Inventariar todos os gateways de pagamento e provider fiscal.
2. Idempotency-Key obrigatória em comandos de mutação.
3. Constraint DB/ledger quando aplicável.
4. Métricas estruturadas:
   request, attempt, latency, terminal state.
5. Retry exponencial com classificação de erro.
6. DLQ/replay explícito para outcome incerto sem nova identidade.
7. SLOs documentados/testáveis.

### Track F status — BILL-018 hardening 2026-09-27

- live snapshot: 4.162 pagamentos históricos com `idempotency_key IS NULL`; nenhum backfill;
- writers HTTP/UI/direct insert corrigidos para identidade scoped;
- MCX com claim antes do provider e webhook dedupado pela identidade do provider;
- timeout/exceção pós-claim e falha de persistência pós-aceite ficam `MCX_OUTCOME_UNCERTAIN`; retries não voltam a chamar o provider;
- valor MCX passa por `exactMoney`/`moneyToJson`, sem `Number()` autoritativo nesse caminho;
- migration `20260928002000_bill_018_payment_idempotency_hardening.sql` preparada;
- guard prospectivo + chave imutável + revogação de RPCs legados;
- negative/readiness tests adicionados;
- **não aplicado ao live** porque não existe Supabase development branch/staging actualmente;
- estado: **READY FOR STAGING — NOT LIVE**.

### Track G — Homologação AGT

1. Confirmar presença de credenciais/host sem logar valores.
2. Validar softwareInfo + KMS JWS.
3. Criar fixture homologação isolada.
4. registarFactura -> requestID -> obterEstado.
5. Persistir evidência sanitizada.
6. Nunca reusar documento/submissionUUID após outcome incerto.
7. Se credencial/certificado real estiver ausente, deixar BLOCKED com prova exacta,
   sem fabricar sucesso.

### Cross-check oficial AGT — 2026-09-27

Fonte normativa principal:

`https://portaldoparceiro.minfin.gov.ao/doc-agt/faturacao-electronica/1/servicos/registar.html`

Páginas auxiliares usadas somente para resolver contratos relacionados:

- `/servicos/consultar.html` — `obterEstado`;
- `/estrutura.html` — estrutura JWS;
- `/gestao.html` — custódia/chaves.

#### Conforme / provado no código ou live

- `registarFactura` HML/produção: endpoints alinhados;
- Basic Auth + JSON: alinhado;
- `schemaVersion=2.0`;
- `submissionUUID` persistido e preservado nos retries;
- máximo 30 documentos por chamada;
- `numberOfEntries = documents.length`;
- assinatura de documento RS256 sobre:
  `documentNo,taxRegistrationNumber,documentType,documentDate,customerTaxID,customerCountry,companyName,documentTotals`;
- `documentStatus=N/C` e `rejectedDocumentNo` com novo número para correcção;
- RC sem `lines` e com `paymentReceipt.sourceDocuments`;
- NC com `referenceInfo`;
- tipos FE usados pelo KLASSE: FT/FR/NC/ND/RC/RE;
- `operationType=SE` suportado para educação;
- IVA/isencão e `taxExemptionCode`;
- `taxContribution` usa `fiscal_tax_ceil_cent` no motor SQL canónico;
- exemplos oficiais codificados na readiness:
  `23.144 -> 23.15`, `0.001844 -> 0.01`, `5.9999999 -> 6.00`;
- FX usa contravalor AOA persistido e arredondamento matemático a 2 casas no motor canónico;
- `requestID` obrigatório e limitado a 15;
- `obterEstado` assina `taxRegistrationNumber + requestID`;
- result codes 0/1/2/7/8/9;
- HTTP 422/429 do polling são tratados como transitórios, não como rejeição fiscal;
- vínculo `fiscal_empresas.certificado_agt_numero` x `softwareValidationNumber` é fail-closed.

#### Gap local corrigido no branch

A AGT exige `documentNo` entre 8 e 60 caracteres.

Snapshot live encontrou 11 documentos históricos com 7 caracteres
(ex.: `FR FR/1`, `RC RC/8`). Todos pertencem a séries `agt_status=legacy`;
não foram renumerados nem alterados.

O mapper passou a rejeitar qualquer submissão FE cujo `documentNo` esteja fora
de 8–60 caracteres ou tenha espaços periféricos. Teste unitário adicionado.

#### Ambiguidades do próprio documento AGT — bloquear decisão até homologação

1. `signatureVersion`:
   - a tabela de `registarFactura` o marca obrigatório dentro de `softwareInfoDetail`;
   - o exemplo de `registarFactura`, o exemplo de `obterEstado` e a página
     `estrutura.html` mostram/assinam somente
     `productId,productVersion,softwareValidationNumber`.
   - o KLASSE configura `signatureVersion`, mas actualmente não o transmite dentro
     de `softwareInfoDetail`.
   - não alterar o JWS por inferência; provar em HML qual contrato a AGT realmente aceita.

2. `jwsSignature` em `registarFactura`:
   - a tabela/payload de entrada de `registarFactura` não lista o campo;
   - a lista de erros inclui E40 para assinatura da chamada;
   - `estrutura.html` diz que requisições importantes podem usar `jwsSignature`.
   - o KLASSE não envia `jwsSignature` top-level em `registarFactura`.
   - tratar como hipótese de homologação, não inventar payload antes da resposta real da AGT.

#### Funcionalidades AGT não suportadas pelo escopo actual do KLASSE

- `taxBase` para correcções exclusivamente de imposto: não modelado; o motor bloqueia
  quantidade zero, portanto esse caso não é emitido silenciosamente;
- `withholdingTaxList`: contrato AGT existe, mas o mapper KLASSE falha fechado quando
  retenções/cativações são detectadas;
- exportação/factura AOA com contravalor em divisa: fora do fluxo escolar actual;
- tipos AR/RG/FA/FG/GF/AC/TV/AF/RP/RA/CS/LD não são emitidos pelo produto actual.

#### Gate de homologação

O BILL-013 só pode fechar depois de capturar evidência real HML para:

- forma exacta de `softwareInfoDetail`/JWS quanto a `signatureVersion`;
- necessidade ou não de `jwsSignature` em `registarFactura`;
- FT/FR/NC/ND/RC/RE;
- isenção, FX, rejeição intencional, duplicate submission;
- `obterEstado` V/I + 7/8 + 422/429;
- requests/responses sanitizados e persistidos.


### Track G status — HML tooling 2026-09-27

Implementado no branch:

- `agtContract.ts`: perfis explícitos `docs-example` e `table-strict`;
- `docs-example` reproduz os exemplos AGT sem `signatureVersion`;
- `table-strict` inclui `signatureVersion` conforme a tabela normativa;
- `jwsSoftwareSignature` é sempre calculado sobre exactamente o
  `softwareInfoDetail` transmitido;
- `FISCAL_AGT_SOFTWARE_INFO_MODE` selecciona o perfil sem alterar o default actual;
- `pnpm fiscal:agt:hml:preflight` valida host HML, configuração, binding de
  certificado e KMS sem enviar qualquer request à AGT;
- `pnpm fiscal:agt:hml:submit` faz uma submissão FT/FR + uma consulta
  `obterEstado`, mas somente com ACK, `submissionUUID` e timestamp explícitos;
- o probe nunca gera novo `submissionUUID` automaticamente, evitando retry
  acidental com nova identidade após outcome incerto.

Gates obrigatórios do submit HML:

```
FISCAL_AGT_ENV=hml
FISCAL_AGT_HML_PROBE_ACK=SUBMIT_REAL_HML_DOCUMENT
FISCAL_AGT_HML_DOCUMENT_ID=<uuid de FT/FR emitida para HML>
FISCAL_AGT_HML_SUBMISSION_UUID=<uuid v4 persistido>
FISCAL_AGT_HML_SUBMISSION_TIMESTAMP=<ISO-8601 persistido>
FISCAL_AGT_SOFTWARE_INFO_MODE=docs-example|table-strict
```

O script também exige as credenciais/configs AGT e Supabase já usadas pelo backend;
nenhum valor secreto é impresso.

**Bloqueio live confirmado:** existem 3 `fiscal_empresas`, mas 0 possuem
`certificado_agt_numero`. Existem 2 chaves fiscais activas e ambas são refs KMS.
Portanto a chamada HML real continua BLOCKED por binding de certificado, não por
signer/chave privada.

### Track H — Readiness suite (~40 cenários)

Automatizar matriz:
- FT/FR/NC/ND/RE/RC aplicáveis;
- IVA/isencão/FX;
- pagamento parcial/total;
- 2 e 100 emissões concorrentes;
- retry mesma origem;
- webhook duplicado;
- timeout AGT após accept;
- AGT 500;
- rejeição estrutural/fiscal;
- mudança de ano/série;
- cross-tenant SELECT/INSERT/RPC;
- DELETE documento emitido;
- UPDATE item emitido;
- DELETE evento;
- SAF-T XSD + semântica;
- JWS válido/adulterado/chave errada/revogada.

## Gates de conclusão

Cada bloco só fecha com:
- commit/arquivos;
- migration Git/live quando houver DB;
- teste positivo;
- teste negativo;
- residue check;
- advisors;
- CI;
- docs actualizadas.

Homologação externa não vira PASS sem resposta real da AGT.
