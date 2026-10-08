# Auditoria de recibos de pagamentos em lote — 2026-10-08

## Evidência de produção — exclusivamente consultas de leitura

- 2026-10-07 (UTC): 15 pagamentos de mensalidade `settled`; 6 com documento `recibo` associado directamente à mensalidade, 9 sem essa associação.
- Desses 9, 8 foram pagamentos de regularização pós-virada com `emitir_recibo=false`, pelo desenho anterior de agrupar num recibo do último mês. Dois documentos da mesma escola/alunos apareceram no intervalo de dez minutos, mas **nenhum tinha `itens_pagamento` no snapshot**. Não inferir deles que a composição do recibo era correcta.
- O nono, de Kz 4.000, estava integralmente pago, com emissão pedida, mas sem documento na mensalidade. A reparação deve ocorrer por pessoal escolar autorizado, sem repetir o registo do pagamento.
- As políticas RLS de `documentos_emitidos` permitem `SELECT` e `INSERT` ao utilizador autenticado da escola, mas **não `UPDATE`**. As rotas faziam um `update(dados_snapshot)` como utilizador e ignoravam o resultado, deixando os recibos sem as linhas do lote.

## Correcção

1. Substituir a regularização sequencial do Balcão pelo mesmo endpoint de lote atómico usado no pagamento rápido: `/api/secretaria/pagamentos/processar`. Preserva `origem_matricula_id` por item e um único recibo para o lote.
2. Enriquecer o snapshot por uma operação **server-only** com service role, após o endpoint autenticar o utilizador, validar o papel na escola e obter o documento pelo RPC canónico. Os filtros exigem simultaneamente `id`, `escola_id`, `aluno_id`, `tipo=recibo` e não revogado; apenas campos descritivos explicitamente permitidos podem ser adicionados. Não muda id, hash ou número. Não altera recibos históricos (mais de 60 minutos).
3. Erros de enriquecimento devem ser explícitos; pagamentos já persistidos não devem devolver um erro que induza o utilizador a pagar outra vez.
4. Uma acção expressa de recuperação em `/api/secretaria/recibos/recuperar`, sujeita a autenticação, papel da escola, mensalidade paga e pagamento settled, chama exclusivamente o `emitir_recibo` idempotente. **Não regista novos pagamentos.** Balcão e Financeiro disponibilizam a acção após falha.
5. No Financeiro, aguardar sinal do recibo renderizado e logótipo carregado para imprimir; eliminar atraso fixo de 800 ms.

## Restrições e gates

- Sem alterações de migrations, RLS, funções fiscais ou lançamentos existentes. Nunca actualizar/reemitir em massa os oito documentos históricos.
- Validar permissões multi-tenant, plano, execução em produção, abertura e impressão reais antes de deploy.
- O caso histórico de Kz 4.000 **não é remediado por um commit**: acção de recuperação autenticada da escola é exigida. A rota não deve ser invocada por SQL com privilégios de administrador ou através de impersonação.
- Testes unitários de distribuição por mensalidade (pagamento parcial e integral), tipagem/linters e CI documentados no PR.
