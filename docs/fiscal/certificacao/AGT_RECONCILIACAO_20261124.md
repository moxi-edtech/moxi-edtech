# Reconciliação fiscal AGT — 2026-11-24

Status: NO-GO para submissão formal e activação. Epic #440, dependência #308.
Base main: 4e9ef8d6dae5b0f05382ac8ba170ec0d61d8f32b.
Origem recuperada: PR #193, commit cda2b63ead1fd2d8680fa3f357fd24cf8430ea6e (módulos puros de #185/#186). Cinco blobs preservados integralmente. Não importar a cadeia empilhada #118–#131 ou #137 em bloco. #126/#128/#129/#130 foram integradas na branch BILL-010, não demonstram presença em main.

## Regra inviolável de execução
- Nenhuma escola, incluindo Curtume, pode ter o motor fiscal activado antes de certificação AGT verificável e autorização separada.
- Preservar fiscal_escola_bindings.fiscal_enabled=false, freeze de emissão e ACL de RPCs críticas; nenhum GRANT, alteração RLS, migração, replay, KMS, série real, comunicação AGT ou deploy de produção nesta etapa.
- Recibos operacionais, propinas, bolsas, pagamentos e estornos actuais permanecem inalterados. Módulos recuperados não têm consumidores runtime novos; o motor decimal4/engineDeterministico existente não é substituído.
- Esta PR não resolve paridade SQL, não demonstra homologação nem autoriza merge de runtime fiscal. CI verde dos módulos puros não equivale a certificação.

## Base normativa a verificar e arquivar
DP 71/25 (Regime Jurídico das Facturas); DE 74/19 (validação de software); DE 317/20 (SAF-T AO, verificar vigência e articulação com diplomas posteriores); DE 683/25 (facturação electrónica). Portal oficial: https://portaldoparceiro.minfin.gov.ao/ (Schema 2, contratos, assinaturas e códigos); QR: https://portaldoparceiro.minfin.gov.ao/doc-agt/doc-agt/2/qrcode.html . Obter ofício original 0000498/01180000/AGT/2026 e confirmar prazo/processo administrativo; matriz interna não substitui original. Confirmar âmbito software de facturação (F), sem afirmar contabilidade completa nem autofacturação não oferecida.

## Evidência e discrepâncias
Snapshot anterior da auditoria 24/11: 786 migrações registadas; 2 vínculos fiscais, ambos desactivados; 20 tabelas fiscais/alocação com RLS ligada; EXECUTE negado a anon/authenticated/service_role para emitir documento, emitir recibo, finalizar assinatura e reservar número. Não é prova de paridade ou de isolamento integral. #308 contém números históricos desactualizados: novo inventário por versão/hash/definição/ACL necessário. Não executar db push/repair ou reproduzir SQL antigo para fazer o inventário coincidir.
Na main auditada: decimal.ts, agtCertificationPlan.ts, workflow fiscal-certification.yml, rotas de submit/provisioning originais ausentes. saftAo.ts usa hash_control em Hash e HashControl, e Number em FX. Adaptador financeiro colapsa cliente identificado sem NIF. PDF fiscal sem QR identificado. Verificar semântica dos campos e do material criptográfico persistido antes de corrigir (não reescrever histórico). Plano P11 exige confirmar duas guias de remessa, não presumir GR+GT suficiente; P13 N/A é apenas candidato; P15 inclui FR/RE e demais tipos efectivamente oferecidos.

## Matriz de execução
| Ponto | Evidência de aceitação | Estado |
|---|---|---|
| P01 | FT cliente com NIF real de homologação | Pendente |
| P02 | PDF antes/depois, anulação, motivo e XML; distinguir anulação local e AGT | Pendente |
| P03 | PP conferência | Pendente |
| P04 | FT a partir de PP, OrderReferences | Pendente |
| P05 | NC a partir de FT, References/Reason e limite cumulativo | Pendente |
| P06 | Duas linhas, IVA e isenção legal | Pendente |
| P07 | 100 x 0,55, desconto linha 8,8% e global; DB/PDF/XML/JSON | Pendente |
| P08 | FX, totais por moeda e AOA, câmbio | Pendente |
| P09 | Cliente identificado sem NIF, <50 AOA, antes das 10h reais de Luanda | Pendente |
| P10 | Segundo cliente identificado sem NIF | Pendente |
| P11 | Duas guias de remessa conforme ofício | Pendente |
| P12 | Orçamento ou PP conforme ofício | Pendente |
| P13 | Âmbito GF/autofacturação: exemplo ou N/A formal aceite | Pendente |
| P14 | FG se suportada | Pendente |
| P15 | Outros tipos suportados (incluindo FR/RC/ND/RE se aplicável) | Pendente |
| P16 | Índice ponto → IDs, número, PDF, XML, checksum, resultado | Pendente |
| P17 | SAF-T consolidado, dois períodos reais, XSD+semântica+assinatura; nenhuma omissão | Pendente |

## Gates em ordem
- [ ] A. Inventário actual main vs ledger remoto; comparar versões, hashes, funções/triggers/RLS/grants, recuperar proveniência e replay PostgreSQL 17 descartável com pg_cron; manter freeze.
- [ ] B. BILL-001–005: provar bloqueio de UPDATE/DELETE/TRUNCATE directos em documentos/linhas/eventos, numeração concorrente e rollback, tenant e série, cinco negativos originais; testar service_role também.
- [ ] C. BILL-007/009/010: ledger append-only, reversão idempotente, pagamentos parciais/lote, bolsas, descontos, regras tributárias versionadas e não mutáveis após emissão, arredondamento exacto, NC/ND/RC/rejeições.
- [ ] D. SAF-T: Hash=assinatura, HashControl=versão conforme origem/regra oficial, snapshot canónico, identificação cliente, referências, totais/FX, XSD oficial + validação semântica; PDF QR e menções. Não fabricar assinatura/versão ou certificado. Testes golden e comparação tripla.
- [ ] E. AGT Schema 2: contratos e JWS, separação chaves produtor/contribuinte, provisão de séries, outbox, estado/rejeição, contingência, retry seguro; testes offline com transport double e sem segredos.
- [ ] F. Runner P01–P17: dry-run default; vincular preflight a empresa, ambiente, versão e ano, janela Luanda, impedir replay incerto, manifesto e hash; ambiente isolado e aprovação separada para HML. Não filtrar transacções estatutárias de um SAF-T de período.
- [ ] G. Dossiê administrativo: confirmar original do ofício, prazo, Modelo 8/chave pública, retenção, backup/restauro, versões, processo e comprovativo de aceitação. Somente então propor activação em escola individual por aprovação separada.

## Etapa 1
Recuperação dos dois módulos puros, testes existentes e workflow específico de #193; execução CI pendente à criação deste documento. Aritmética não integrada ao runtime e sem alteração de guard fiscal global. Os testes históricos têm escopo limitado: adicionar limites de precisão/expoente, sinais, arredondamento e validação de transporte antes de integrar consumidores. Nenhum ponto P01–P17 deve ser declarado encerrado com testes sintéticos.

### Hardening adicional nesta branch
Limites de entrada/expoente/escala para evitar alocação descontrolada; validação round-trip do número JSON, rejeição de inteiros JS inseguros, testes de sinais/divisão/limites. P11 conserva GR (duas amostras a demonstrar); P15 explicita FR e inventário restante. As restrições técnicas de recursos não são limites legais de valores. CI ainda por confirmar; não alterar contratos financeiros até validar schemas e integração.
