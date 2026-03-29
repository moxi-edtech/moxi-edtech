# Relatório — Inventário do Módulo Fiscal no KLASSE

Data: 2026-03-19
Escopo analisado: `apps/web`, `supabase/migrations`, `agents/outputs`
Objetivo: mapear o que já existe no KLASSE para suportar um módulo fiscal AGT v3, identificar o que pode ser reaproveitado sem duplicação e listar as lacunas reais para plugar o módulo no portal financeiro.

## Veredito executivo

O KLASSE **já tem uma base útil**, mas **ainda não tem um módulo fiscal certificável**.

Hoje o produto já oferece:

- isolamento multi-tenant por `escola_id` com `resolveEscolaIdForUser` e políticas RLS em vários fluxos;
- um subsistema de **documentos emitidos** com snapshot imutável de conteúdo, `public_id`, `hash_validacao`, QR/URL pública de validação e auditoria;
- um subsistema financeiro operacional com pagamentos, mensalidades, fecho de caixa, conciliação, cobrança, dashboards e MVs;
- controles de plano/permissão que já antecipam a ideia de fiscal premium (`emitir_nota_fiscal`, `fin_recibo_pdf`, plano “Financeiro + Fiscal”).

Mas o que existe hoje resolve **comprovativos e recibos operacionais**, não **faturação fiscal regulada**.

O gap estrutural é claro:

1. o tenant fiscal actual é a **escola**; o Fiscal v3 exige **empresa/NIF** como fronteira de ledger;
2. `documentos_emitidos` foi desenhada para **documentos genéricos da secretaria + recibos**, não para séries fiscais, rectificações, anulações formais e encadeamento criptográfico;
3. o “hash” actual é um token de validação, **não assinatura RSA em cadeia**;
4. não existe motor de **numeração contínua por série fiscal**;
5. não existe **SAF-T(AO)** nem modelo orientado a exportação fiscal;
6. não existe trilho fiscal append-only por evento com semântica de emissão, rectificação, anulação, reimpressão e exportação.

Conclusão direta: **não devemos adaptar o módulo actual de recibos como se fosse o módulo fiscal**. Devemos **reaproveitar infra transversal** e **criar um bounded context fiscal separado**, plugado ao portal financeiro.

---

## 1) Inventário do que já existe e pode ser reutilizado

### 1.1 Multi-tenant, autenticação e resolução de contexto

**Existe hoje:**

- `resolveEscolaIdForUser` está disseminado nas APIs humanas para resolver contexto de tenant antes de query/mutação.
- O financeiro usa `escola_id` de forma consistente em endpoints críticos.
- Há uso de `current_tenant_escola_id()` e `user_has_role_in_school(...)` em policies e RPCs financeiras.

**Porque isto interessa ao Fiscal v3:**

- a disciplina de tenant já existe;
- o padrão de resolver contexto no backend antes de tocar dados já está institucionalizado;
- dá para reutilizar o mesmo shape operacional, trocando o contexto fiscal para `empresa_id` onde a conformidade exigir.

**Reutilizar sem duplicar:**

- middleware/auth server-side;
- pattern de `resolveTenant → authorize → mutate → audit`;
- claims e memberships já usados no produto.

**Limite:**

- o fiscal não pode depender só de `escola_id`; precisa de um **novo contexto fiscal explícito** (`empresa_id`) com ponte controlada escola → empresa fiscal.

### 1.2 Documentos emitidos e snapshot imutável

**Existe hoje:**

- a tabela `documentos_emitidos` já guarda snapshot JSON, `public_id`, `hash_validacao`, `created_by` e revogação formal via `revoked_at` / `revoked_by`.
- Há emissão de documentos finais da secretaria por RPC (`emitir_documento_final`) e emissão de comprovante de matrícula por helper/rota.
- O sistema já expõe consulta pública por token/hash para validação de documento.

**Porque isto interessa ao Fiscal v3:**

- o produto já entendeu a diferença entre “render actual” e “snapshot emitido”; isso é valioso;
- já existe noção de documento publicado, verificável e auditável;
- o padrão de documento como artefacto persistido está maduro o suficiente para servir de referência.

**Reutilizar sem duplicar:**

- bucket mental: snapshot persistido e render posterior a partir do snapshot;
- infra de impressão/PDF e de URL pública de validação;
- auditoria de emissão e integração com notificações/outbox;
- componente de QR e padrão de documento com identificador público.

**Não reutilizar como base fiscal principal:**

- a própria tabela `documentos_emitidos` não serve como ledger fiscal canónico;
- `hash_validacao` não cumpre o papel regulatório de assinatura RSA versionada;
- a numeração actual (`next_documento_numero`) é genérica da escola, não por série fiscal.

### 1.3 Recibos operacionais já emitidos no financeiro

**Existe hoje:**

- endpoint `POST /api/financeiro/recibos/emitir` com `Idempotency-Key`, `requireFeature("fin_recibo_pdf")`, auditoria e RPC `emitir_recibo`.
- componente `ReciboImprimivel` com QR code, URL de validação e impressão pós-emissão.
- o recibo é idempotente por mensalidade e nasce só quando a mensalidade está paga.

**Porque isto interessa ao Fiscal v3:**

- já há fluxo de emissão pós-pagamento;
- já há gating comercial e autorização;
- a equipa/produto já fala a linguagem de “emitir documento oficial” dentro do financeiro.

**Reutilizar sem duplicar:**

- a experiência UX de emitir um documento finalizado, não editável e imprimível;
- a estrutura de idempotência por operação;
- o endpoint pattern e os componentes de impressão.

**O que não serve para AGT v3:**

- o recibo actual não usa série fiscal;
- não há assinatura RSA;
- não há rectificação/anulação formal;
- o snapshot não guarda cadeia fiscal nem `HashControl` real.

### 1.4 Auditoria, outbox e retenção

**Existe hoje:**

- `recordAuditServer(...)` em vários fluxos sensíveis;
- `audit_logs` e `outbox_events` são usados por emissão de documentos e pagamentos;
- já existe automação de arquivamento/live events em torno de documentos.

**Porque isto interessa ao Fiscal v3:**

- o produto já tem primitives de append-only operacional;
- dá para reaproveitar outbox para exportações, submissões, notificações e trilho de eventos fiscais;
- retenção/arquivamento já existe como preocupação de plataforma.

**Reutilizar sem duplicar:**

- outbox worker;
- audit trail transversal;
- storage de artefactos finais;
- observabilidade de emissão.

**Gap:**

- o fiscal precisa de **tabela própria de eventos fiscais imutáveis**, não apenas logs genéricos.

### 1.5 Motor financeiro operacional

**Existe hoje:**

- tabelas e APIs para `pagamentos`, `mensalidades`, `fecho_caixa`, `conciliacao_uploads`, cobranças e dashboards;
- MVs e wrappers para radar de inadimplência e status de pagamentos;
- listagens e exports operacionais no portal financeiro.

**Porque isto interessa ao Fiscal v3:**

- o módulo fiscal precisa de fontes confiáveis de cobrança, pagamento e catálogo escolar;
- grande parte dos dados comerciais já existe no ERP escolar;
- dá para gerar faturas/recibos fiscais a partir de eventos financeiros reais, em vez de criar um sistema paralelo.

**Reutilizar sem duplicar:**

- `pagamentos` e `mensalidades` como origem operacional;
- configuração de preços/tabelas;
- telas financeiras existentes como ponto de entrada;
- dashboards e MVs não fiscais para visibilidade operacional.

**Gap:**

- o modelo financeiro actual não é um ledger fiscal fechado;
- nem tudo que existe em `pagamentos`/`mensalidades` tem semântica fiscal suficiente para SAF-T(AO).

### 1.6 Permissões, features e posicionamento comercial

**Existe hoje:**

- permissões incluem `emitir_recibo` e `emitir_nota_fiscal`;
- o plano premium já comunica “Financeiro + Fiscal”; 
- o feature flag `fin_recibo_pdf` está implementado no backend e no frontend.

**Porque isto interessa ao Fiscal v3:**

- o conceito de monetizar fiscal como capability premium já está parcialmente modelado;
- dá para plugar o módulo novo sem reinventar o plano/entitlements layer.

**Reutilizar sem duplicar:**

- `app_plan_limits` / feature flags;
- UI de assinatura/upsell;
- guardas backend por plano.

**Gap:**

- não há feature gates específicas do fiscal (`fiscal_core`, `fiscal_saft_export`, `fiscal_series_admin`, etc.).

---

## 2) O que existe mas NÃO deve ser reutilizado como núcleo fiscal

### 2.1 `documentos_emitidos` como tabela canónica fiscal

É tentador estender essa tabela, mas isso seria erro de arquitectura.

**Porquê:**

- mistura documentos académicos, comprovantes e recibos;
- o tenant é `escola_id`, não `empresa_id`;
- a revogação actual não modela rectificação/origem do documento fiscal;
- o hash actual é de validação pública, não assinatura regulamentar;
- não há itens, impostos, séries, chaves, exportações, origem documental e encadeamento.

**Decisão certa:**

- manter `documentos_emitidos` para documentos não fiscais e recibos legados/operacionais;
- criar **novo schema/tabelas fiscais** para o ledger AGT.

### 2.2 `next_documento_numero(...)`

Também não deve ser reaproveitado como gerador fiscal.

**Porquê:**

- é sequencial genérico por escola;
- não respeita a unidade de continuidade `empresa + tipo + série + origem`;
- não suporta descontinuação de série, formação, contingência ou recuperação manual.

**Decisão certa:**

- novo reservador transacional por `serie_id` com `SELECT ... FOR UPDATE`.

### 2.3 `hash_validacao`

**Não confundir** hash de validação pública com assinatura fiscal.

**Porquê:**

- hoje ele é gerado com `sha256(randomUUID + timestamp + ids...)`;
- isso resolve verificação pública simples, mas não prova integridade normativa do encadeamento documental;
- não há `key_version`, `public_key_pem`, `HashControl` formal nem cadeia por documento anterior.

**Decisão certa:**

- manter `hash_validacao` só como mecanismo legado/documental onde fizer sentido;
- introduzir subsistema RSA fiscal separado.

---

## 3) Lacunas reais para o KLASSE Fiscal v3

### 3.1 Bounded context fiscal inexistente

Hoje não há nenhum núcleo com:

- `empresas`;
- `empresa_users`;
- `fiscal_series`;
- `fiscal_chaves`;
- `fiscal_documentos`;
- `fiscal_documento_itens`;
- `fiscal_documentos_eventos`;
- `fiscal_saft_exports`.

**Isto é blocker absoluto.** Sem isso, o produto continua a emitir documentos operacionais, não documentos fiscais certificáveis.

### 3.2 Assinatura RSA e gestão de chaves inexistentes

Não encontrei no código/migrations:

- geração/armazenamento de chaves fiscais versionadas;
- assinatura RSA server-side;
- `key_version` persistida por documento;
- cadeia por assinatura/documento anterior.

**Isto é o maior gap de conformidade.**

### 3.3 SAF-T(AO) inexistente

Não encontrei:

- schema de exportação fiscal;
- gerador XML SAF-T(AO);
- validação XSD;
- tabela de artefactos de export fiscal;
- trilho de export por período.

**Sem isso, o módulo não passa de faturação interna.**

### 3.4 Séries fiscais, rectificação, anulação e origem documental inexistentes

Não existe modelação actual para:

- série activa/inactiva/descontinuada;
- origem do documento (`interno`, `manual_recuperado`, `integrado`, `formacao`, `contingencia`);
- rectificação formal sem `UPDATE` destrutivo;
- documento originado de outro documento com referência obrigatória;
- anulação formal com evidência fiscal própria.

### 3.5 Ledger fiscal imutável separado do operativo inexistente

Hoje o sistema guarda snapshots imutáveis de alguns documentos, mas não existe:

- append-only fiscal por evento;
- separação clara entre rascunho comercial e documento fiscal emitido;
- proibição sistémica de mutação fiscal com trilho de evidência específico.

### 3.6 Tenant fiscal por empresa/NIF inexistente

Hoje o multi-tenant do produto gira em torno de `escola_id`.

Isso é suficiente para o ERP escolar, mas **não garante o modelo correcto do fiscal** quando existir:

- grupo económico;
- mais de uma entidade emissora;
- escola com operação em nome de empresa diferente;
- multi-campus com mesma empresa fiscal;
- eventual B2B/B2G fora da estrutura escolar.

### 3.7 Portal financeiro sem módulo fiscal funcional

Existe a rota `/escola/[id]/(portal)/financeiro/fiscal/page.tsx`, mas ela só redirecciona para `/financeiro`.

Na prática, o portal financeiro **ainda não tem cockpit fiscal**.

---

## 4) O que precisamos construir agora, sem duplicação

### 4.1 Camada de domínio fiscal nova

Criar novas tabelas/migrations para o núcleo fiscal, separadas do legado de documentos:

- `empresas`
- `empresa_users`
- `fiscal_series`
- `fiscal_chaves`
- `fiscal_documentos`
- `fiscal_documento_itens`
- `fiscal_documentos_eventos`
- `fiscal_saft_exports`

**Regra prática:** não mover o legado para dentro disso agora; criar ponte gradual.

### 4.2 Mapeamento escola → empresa fiscal

Precisamos de uma decisão explícita de produto e dados:

- uma escola tem exactamente uma empresa fiscal?
- uma empresa fiscal pode servir várias escolas/unidades?
- escolas piloto existentes já têm NIF/razão social válidos?

**Minha recomendação:**

- criar relação explícita `escola_fiscal_binding(escola_id, empresa_id, is_primary, effective_from, effective_to)`;
- não assumir implicitamente que `escola == empresa` para sempre.

### 4.3 Serviço de assinatura server-side

Construir serviço interno de assinatura com:

- lookup da chave activa por `empresa_id`;
- construção de string canónica;
- assinatura RSA no backend/KMS;
- persistência de `assinatura_base64`, `hash_control`, `key_version`;
- rollback transacional se qualquer etapa falhar.

### 4.4 Numeração transacional por série

Implementar função do tipo `fiscal_reservar_numero_serie(...)` com lock pessimista.

**Sem improviso no frontend. Sem sequencial genérico.**

### 4.5 API fiscal separada do recibo operacional

Criar namespace novo:

- `POST /api/fiscal/documentos`
- `POST /api/fiscal/documentos/{id}/rectificar`
- `POST /api/fiscal/documentos/{id}/anular`
- `GET /api/fiscal/documentos`
- `GET /api/fiscal/documentos/{id}`
- `POST /api/fiscal/saft/export`

**Não acoplar isto em `/api/financeiro/recibos/emitir`.**

### 4.6 UI fiscal plugada ao portal financeiro

O portal financeiro deve ganhar área própria para:

- séries;
- empresa/NIF emissor;
- chaves e certificação;
- emissão de factura;
- rectificação/anulação;
- exportações SAF-T;
- trilho de eventos fiscais;
- estado de contingência/formação.

**Mas sem duplicar** dashboards operacionais já existentes de pagamentos, radar e fecho.

### 4.7 Ponte com dados já existentes

Precisamos de adaptadores, não duplicação:

- `mensalidades` e `pagamentos` continuam como origem operacional;
- o fiscal consome esses dados para gerar documento fiscal quando aplicável;
- recibo operacional actual pode coexistir durante transição;
- documentos fiscais emitidos passam a ser a fonte oficial para XML/PDF fiscal.

---

## 5) Mapa de reaproveitamento recomendado

### Reaproveitar directamente

- autenticação server-side Supabase;
- `resolveEscolaIdForUser` como inspiração para um `resolveEmpresaFiscalForUser`;
- `recordAuditServer` e outbox;
- infra de storage para PDFs/XMLs;
- idempotência por operação;
- guards de plano/permissões;
- componentes de render final, QR e impressão pós-emissão;
- consultas operacionais a `pagamentos`, `mensalidades`, `alunos`, `escolas`.

### Reaproveitar só como referência de design

- `documentos_emitidos`;
- `emitir_documento_final(...)`;
- `emitir_recibo(...)`;
- URL pública `/api/public/documentos/[publicId]`.

### Não reaproveitar como núcleo do fiscal

- `hash_validacao`;
- `next_documento_numero(...)`;
- tabela única de documentos mistos;
- recibo actual como substituto de fatura fiscal;
- redirect placeholder da rota `/financeiro/fiscal`.

---

## 6) Riscos e pressupostos que eu NÃO compraria sem validação

### Pressuposto perigoso 1
“Se já emitimos recibo com QR, estamos perto da certificação.”

**Não.** Isso é conforto falso. QR + hash público resolve validação superficial, não conformidade fiscal.

### Pressuposto perigoso 2
“Dá para evoluir `documentos_emitidos` incrementalmente até virar fiscal.”

**Risco alto.** Vai misturar domínios, gerar dívida regulatória e tornar migração/SAF-T mais frágil.

### Pressuposto perigoso 3
“Podemos usar `escola_id` como empresa fiscal.”

**Só como atalho temporário de bootstrap**, nunca como contrato permanente.

### Pressuposto perigoso 4
“Assinatura pode ficar para depois; emitimos primeiro.”

**Errado para v3.** Sem assinatura e numeração certa, vais emitir histórico que depois não consegues ‘corrigir’ sem risco regulatório.

---

## 7) Plano de implementação pragmático

### Fase 0 — Descoberta e decisões de contrato

- fechar a modelagem escola ↔ empresa fiscal;
- definir tipos documentais do v3 inicial;
- decidir provider de chaves (KMS/HSM/secret manager);
- confirmar layout mínimo de PDF fiscal e dados obrigatórios;
- congelar a string canónica e o formato de `HashControl`.

### Fase 1 — Fundamentos de dados

- migrations do núcleo fiscal;
- RLS por `empresa_id`;
- binds escola/empresa;
- políticas e índices;
- eventos append-only;
- storage buckets de artefactos fiscais.

### Fase 2 — Emissão fiscal

- reservar número por série;
- montar documento e itens;
- assinar com RSA;
- persistir documento + evento;
- gerar PDF final;
- bloquear alteração posterior.

### Fase 3 — Rectificação, anulação e reimpressão

- rectificativo formal;
- anulação formal;
- eventos obrigatórios;
- regras de origem e referência.

### Fase 4 — SAF-T(AO)

- extractor por período;
- serialização XML;
- validação XSD;
- storage + checksum;
- UI de export e histórico.

### Fase 5 — Plug final no portal financeiro

- cockpit fiscal;
- série/chaves/empresa;
- emissão/listagem/detalhe;
- exports SAF-T;
- alertas de conformidade.

---

## 8) Resposta objetiva à pergunta “o que já existe e o que é necessário?”

### Já existe

- multi-tenant escolar e guards maduros;
- auditoria/outbox/storage;
- documentos emitidos com snapshot e validação pública;
- recibos operacionais emitidos no financeiro;
- pagamentos, mensalidades, fecho, conciliação, cobranças, dashboards e MVs;
- permissões e gating comercial para evoluir fiscal.

### Necessário para plugar o Fiscal v3

- tenant fiscal por `empresa_id`;
- ledger fiscal novo;
- séries fiscais e numeração contínua;
- assinatura RSA com `key_version`;
- `HashControl` formal;
- rectificação/anulação/origem documental;
- eventos fiscais append-only;
- exportação SAF-T(AO);
- cockpit fiscal próprio no portal financeiro.

### A decisão de arquitectura certa

**Plugar o módulo fiscal ao portal financeiro, sim.**

**Reusar o core actual de recibos/documentos como se já fosse o fiscal, não.**

A abordagem correta é:

- **reusar infra transversal**;
- **isolar domínio fiscal novo**;
- **integrar com o financeiro operacional existente**.

Isso evita duplicação, preserva o que já funciona e não compromete a futura certificação.
