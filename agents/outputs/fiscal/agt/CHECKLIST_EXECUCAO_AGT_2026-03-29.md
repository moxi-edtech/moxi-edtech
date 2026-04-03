# Checklist de Execução AGT — Operação de Certificação

Janela alvo: 2026-03-29 a 2026-04-15

## A. Preparação (D0)

- [x] Nomear owner técnico da frente AGT
- [ ] Nomear owner fiscal/compliance
- [ ] Congelar mudanças não essenciais no módulo fiscal
- [x] Confirmar variáveis fiscais em produção (`SAFT_*`, `AWS_*`, `SUPABASE_*`)
- [ ] Confirmar Inngest sincronizado com `https://app.klasse.ao/api/inngest`
- [x] Integrar template PDF fiscal AGT no endpoint oficial (`/api/fiscal/documentos/[documentoId]/pdf`)

## B. Geração dos exemplos (D0-D4)

- [x] Ponto 1 gerado e PDF salvo
- [ ] Ponto 2 gerado (anulação) e PDF pós-anulação salvo
- [x] Ponto 3 gerado (pró-forma) ou marcado NA com justificativa
- [x] Ponto 4 gerado com referência ao ponto 3
- [x] Ponto 5 gerado com referência ao ponto 4
- [x] Ponto 6 gerado com linha isenta e códigos válidos
- [ ] Ponto 7 gerado com desconto de linha e global
- [ ] Ponto 8 gerado em moeda estrangeira
- [ ] Ponto 9 gerado com condição de horário e total
- [ ] Ponto 10 gerado para cliente sem NIF
- [ ] Ponto 11 gerado (2 guias) ou NA formal
- [ ] Ponto 12 gerado (orçamento/pró-forma) ou NA formal
- [ ] Ponto 13 gerado (genérica/auto-faturação) ou NA formal
- [ ] Ponto 14 gerado (fatura global) ou NA formal
- [ ] Ponto 15 gerado (tipos adicionais) ou NA formal

## C. Fecho técnico (D3-D8)

- [x] XML único gerado para março/2026 e validado no XSD oficial (export_id: `0998ad5b-1c05-4a0c-9348-e277080b783b`)
- [x] Validação XSD oficial sem erro
- [x] Validação hash_control concluída
- [x] Validação assinatura concluída
- [x] Replay audit da cadeia concluído
- [ ] Matriz AGT 1..17 preenchida sem lacunas
- [ ] Coerência temporal comprovada (evidências em pelo menos 2 meses distintos)
- [ ] Consistência PDF = XML = DB comprovada para todos os pontos READY
- [ ] Validar menção legal AGT e assinatura curta em todos os PDFs anexados
- [ ] Encadeamento documental validado (Pró-forma -> FT, FT -> NC)
- [ ] Isolamento multi-tenant validado (sem cross-tenant no SAF-T)
- [ ] Reconciliação decimal (diferença acumulada = 0.0000)

## D. Submissão (D8-D15)

- [ ] Revisão final técnica
- [ ] Revisão final fiscal/compliance
- [ ] Pacote PDF fechado
- [ ] XML final anexado em `agents/outputs/fiscal/agt/SAFT_AGT_UNICO_2026-03.xml`
- [ ] E-mail enviado para `produtos.dfe.dcrr.agt@minfin.gov.ao`
- [ ] Protocolo de envio guardado
- [ ] Simulação de Auditor AGT executada e anexada

## E. Critério final

- [ ] Todos os pontos obrigatórios em READY
- [ ] Pontos NA com justificação aprovada
- [ ] Status final: GO para submissão

## F. Cobertura Mínima por Tipo (Execução Real)

- [x] Execução autenticada em produção concluída (`compliance probe = 200`)
- [x] Tipos com emissão OK: `FT`, `RC`, `ND`, `NC`, `PP`, `GR`, `GT`, `FG`
- [x] `FR` com emissão estável e idempotência validada após migração (mesmo `origem_id` => mesmo `documento_id`)
- [x] Exportação SAF-T para `2026-04-01..2026-04-30` localizada (`export_id: ed3f5fc6-4b5f-4e91-aef1-58cbdecd7717`, status `generated`)
- Evidências:
  - `agents/outputs/fiscal/agt/FISCAL_TIPOS_MINIMO_EXEC_20260402T225502Z.md`
  - `agents/outputs/fiscal/agt/FISCAL_TIPOS_MINIMO_EXEC_20260402T225730Z.md`
  - `agents/outputs/fiscal/agt/FR_IDEMPOTENCIA_POS_MIGRACAO_2026-04-02.md`

### Correção aplicada (FR)

- Migração aplicada: `20260402133000_fix_fr_numero_formatado_idempotencia.sql`
- Resultado pós-fix (produção):
  - chamada 1 (`origem_id` A): `201`, `documento_id=0fcc55b7-e0fe-4f25-8199-05c1774a31b5`, `numero_formatado=FR FR/1`
  - chamada 2 (`origem_id` A): `201`, mesmo `documento_id` e mesmo `numero_formatado`
  - chamada 3 (`origem_id` B): `201`, `documento_id=b35c8983-da83-4007-810c-e69c13bb2336`, `numero_formatado=FR FR/2`
- Pré-condição operacional atendida: série `FR/FR/integrado` criada/ativada.

### Execução adicional (2026-04-03)

- Fluxo `PP -> FT(ref PP) -> NC(ref FT)` executado em produção:
  - PP: `5831e698-c72c-4db8-9980-2e2cbb9731bb` (`PP PP/3`)
  - FT: `2230924c-37e0-41da-96df-68f9bbd75509` (`FT FR/6`)
  - NC: `e0b4637e-b705-44d2-8e97-6eea534d078c` (`NC NC/3`)
- Pendente para fechar os pontos 3/4/5: anexar PDFs e validar referências no XML final do pacote AGT.
