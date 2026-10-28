# Auditoria de recibos: emissão correta, consulta de lote incorreta — 2026-10-28

## Diagnóstico (produção, leitura apenas)

A Vercel Hobby não retornou registos úteis de recibo no horizonte de 45 minutos; a tentativa de ampliar para 24 horas excedeu a retenção. A fonte decisiva foram os registos instalados do Supabase e o código ativo do GET `/api/secretaria/recibos/consultar`.

- `operational-receipts-1m`: ativo, 1440 execuções `succeeded` nas 24 horas verificadas.
- Desde o início do novo worker em 26/10 (11:13 UTC), 43 eventos operacionais de recibo foram enviados: 27 com `pagamentos.meta.emitir_recibo=true` e **27 documentos ligados ao pagamento emissor**; 16 com `emitir_recibo=false` e sem documento individual **por desenho do lote**.
- Oito lotes com chave explícita `meta.batch_idempotency_key`: cada um possuía um único emissor (`emitir_recibo=true`) e um único recibo consolidado.
- Exemplo confirmado em 28/10: lote de admissão com cinco pagamentos liquidados, dois de mensalidade, dois serviços intermediários e um serviço final de matrícula; apenas o último tem recibo, cuja referência está em `documentos_emitidos.dados_snapshot.pagamento_id`. Nas mensalidades intermediárias, a consulta antiga por `documentos_emitidos.mensalidade_id` retornava vazio.
- Existem 415 eventos históricos `pending`, 246 `failed` e 24 `dead`, anteriores ao corte do novo worker; estes **não** devem ser reprocessados automaticamente. Não são evidência de erro atual na emissão dos 27 documentos recentes.

**Causa comprovada para o falso recibo pendente:** a recuperação ignorava o identificador explícito do lote e assumia que todos os recibos eram emitidos contra a própria mensalidade. A interface concluía incorretamente que o recibo consolidado não existia.

## Correção

1. A consulta read-only aceita exatamente um dos identificadores `mensalidade_id` ou `pagamento_id` (ambos UUID).
2. Procura primeiro o recibo específico já emitido, nunca um documento apenas por aluno/data.
3. Se o pagamento liquidado possui `meta.emitir_recibo=false`, pesquisa o único emissor da **mesma escola, aluno e `meta.batch_idempotency_key`**; seleciona por `mensalidade_id` se o terminal for mensalidade, senão pelo `dados_snapshot.pagamento_id` do terminal de serviço.
4. Não aceita lote com múltiplos emissores: devolve conflito para reconciliação. Só aceita documentos operacionais `tipo=recibo` não revogados, com autorização de staff financeiro.
5. Na admissão, caso a chamada síncrona de emissão responda com erro depois do pagamento, a interface pode consultar o documento já emitido pelo worker usando o `pagamento_id` devolvido pelo servidor, sem segunda cobrança nem segundo RPC de emissão.

Nenhuma alteração a banco, liquidação, event handlers, migrações, fiscal/AGT ou geração de recibos históricos.

## Validação requerida

- Testes unitários: metadados de lote, exclusão de emissor e de metadados ambíguos, recuperação por pagamento read-only, garantias de tenant e status `settled`.
- Smoke autenticado: pagamento mensal isolado; lote com terminal mensalidade; lote de admissão com terminal serviço; emissão síncrona indisponível e posterior confirmação pelo worker; reimpressão sem novo pagamento.
- Verificar novamente o vínculo `pagamentos.meta.batch_idempotency_key` → `pagamentos(meta.emitir_recibo=true)` → `documentos_emitidos` sem modificações nos dados reais.

**Fora do escopo:** replay histórico dos 415/246/24 eventos, que depende de reconciliação seletiva com documentos já emitidos e autorização para replay gated.
