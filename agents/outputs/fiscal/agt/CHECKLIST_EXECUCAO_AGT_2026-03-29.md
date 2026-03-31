# Checklist de Execução AGT — Operação de Certificação

Janela alvo: 2026-03-29 a 2026-04-15

## A. Preparação (D0)

- [x] Nomear owner técnico da frente AGT
- [ ] Nomear owner fiscal/compliance
- [ ] Congelar mudanças não essenciais no módulo fiscal
- [x] Confirmar variáveis fiscais em produção (`SAFT_*`, `AWS_*`, `SUPABASE_*`)
- [ ] Confirmar Inngest sincronizado com `https://app.klasse.ao/api/inngest`

## B. Geração dos exemplos (D0-D4)

- [x] Ponto 1 gerado e PDF salvo
- [ ] Ponto 2 gerado (anulação) e PDF pós-anulação salvo
- [ ] Ponto 3 gerado (pró-forma) ou marcado NA com justificativa
- [ ] Ponto 4 gerado com referência ao ponto 3
- [ ] Ponto 5 gerado com referência ao ponto 4
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

- [ ] XML único gerado com todos os exemplos aplicáveis
- [x] Validação XSD oficial sem erro
- [x] Validação hash_control concluída
- [x] Validação assinatura concluída
- [x] Replay audit da cadeia concluído
- [ ] Matriz AGT 1..17 preenchida sem lacunas
- [ ] Coerência temporal comprovada (evidências em pelo menos 2 meses distintos)
- [ ] Consistência PDF = XML = DB comprovada para todos os pontos READY
- [ ] Encadeamento documental validado (Pró-forma -> FT, FT -> NC)
- [ ] Isolamento multi-tenant validado (sem cross-tenant no SAF-T)
- [ ] Reconciliação decimal (diferença acumulada = 0.0000)

## D. Submissão (D8-D15)

- [ ] Revisão final técnica
- [ ] Revisão final fiscal/compliance
- [ ] Pacote PDF fechado
- [ ] XML final anexado
- [ ] E-mail enviado para `produtos.dfe.dcrr.agt@minfin.gov.ao`
- [ ] Protocolo de envio guardado
- [ ] Simulação de Auditor AGT executada e anexada

## E. Critério final

- [ ] Todos os pontos obrigatórios em READY
- [ ] Pontos NA com justificação aprovada
- [ ] Status final: GO para submissão
