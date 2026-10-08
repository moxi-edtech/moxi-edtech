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

## Validação de impressão

O teste isolado do `agent-browser` gerou PDF A4 de 1 página e duas vias com Setembro, Outubro e Novembro (Kz 4.000, 5.000 e 6.000), total Kz 15.000. A mesma estrutura foi renderizada no Financeiro após `onPrintReady`. O teste identificou e corrigiu uma falha de data civil: `2026-10-08` aparecia como 07/10 por deslocamento de fuso; os dois modelos utilizam agora `formatReceiptDate` e o ensaio confirmou 08/10. Evidências em `evidence/receipts-2026-10-08`.

Não se considera aceite o E2E autenticado; os testes de abertura e impressão ainda precisam de ser executados com conta autorizada num ambiente de homologação.

## Reconciliação de incongruências — 08/10, segunda passagem

- **Replay singular**: endpoint Balcão devolvia apenas o pagamento existente ao repetir a chave de idempotência, sem recuperar/emitir o recibo. Agora, após confirmar que aluno, mensalidade, valor e método são idênticos, a execução prossegue **sem nova inserção de pagamento**, mas retoma o RPC de emissão idempotente. Reutilização divergente: 409.
- **Replay de lote**: o Balcão mantém a chave de idempotência por tentativa até receber confirmação e bloqueia novas cobranças após o retorno de pagamento confirmado. Erro de rede instrui a verificar o histórico antes de qualquer nova tentativa; recuperação permanece ação distinta.
- **Documento histórico incompleto**: um recibo antigo sem `itens_pagamento` não pode receber silenciosamente conteúdo de um checkout de hoje. A função de enriquecimento devolve erro explícito para documento antigo incompleto; não declara sucesso falso nem reescreve prova histórica.
- **Pagamento parcial**: `emitir_recibo` exige que a mensalidade esteja paga. Logo, o fluxo de comprovativos de parcelas ainda exige decisão contábil e teste E2E específico; não emitir recibo fiscal por uma função de serviços por analogia. Esta questão permanece como **gate funcional**.
- **Integridade fiscal**: confirmação do pagamento e emissão/impres­são do documento são operações separadas. O erro do recibo não pode levar a uma segunda cobrança.

A revisão do código não substitui a homologação autenticada, especialmente de parcelas, replays e isolamento entre escolas.

## Homologação de acesso HTTP — 2026-10-08

Foi iniciada uma instância local da branch PR #176 com variáveis fictícias de Supabase e **sem sessões autenticadas**. Quatro testes HTTP executados via `node --test --import tsx` (ficheiro `apps/web/tests/unit/receipt-access-http.spec.ts`) passaram:

1. `POST /api/secretaria/recibos/recuperar` com `mensalidade_id` inválido respondeu 400.
2. Mesmo endpoint com UUID sintaticamente válido, mas sem sessão, respondeu 401.
3. `GET /secretaria/documentos/{uuid}/recibo/print` sem sessão redireccionou para login.
4. `GET /aluno/documentos/{uuid}/recibo/print` sem sessão redireccionou para login.

**Limites:** não há `TEST_LOGIN_EMAIL`, `TEST_LOGIN_PASSWORD`, `TEST_ESCOLA_SLUG` configurados; não foi identificado deployment de homologação da branch na Vercel; a automação Playwright não está instalada no worktree. Nenhuma operação de pagamento real, emissão, autorização multi-tenant com dois utilizadores, recuperação real de Kz 4.000 ou validação de impressão autenticada foi executada. A aprovação de produção permanece bloqueada nesses gates.

Comando de reprodução quando existir uma instância de teste, sem credenciais reais no repositório:

`RECEIPT_TEST_BASE_URL=http://localhost:3192 node --test --import tsx apps/web/tests/unit/receipt-access-http.spec.ts`
