# AppyPay — homologação de 2026-11-02
Base: 0f8a78e3c30bf4295a1da872b3c2d66f8ac5a6c4
Branch: codex/appypay-homologacao-flow
Estado: INCOMPLETO; can_merge: false; processamento publicado permanece desativado.

## Evidência executada no fornecedor
Credenciais KLASSE — Homologação autenticaram com HTTP 200. Configuração sandbox foi guardada como Secret em Production na Vercel por confirmação explícita do utilizador; APPYPAY_ENABLED=false verificado. Guardar a variável não substitui um deployment.

Uma única referência fictícia, sem aluno e sem lançamento no banco KLASSE, foi criada na API sandbox:
- HTTP 202, charge c743b617-b1b7-4fe9-930d-7f3a22e8a21d
- amount 100 AOA; merchant aa19825c028a42b; entidade 00348; referência 772413954
- criação: Pending, code 101
- simulador /mocks/referenceProcessing chamado uma única vez. Resposta sem JSON causou erro de leitura no script local, não repetido; código HTTP exato do simulador não foi capturado e não é alegado.
- GET autenticado posterior: HTTP 200, payment.status=Success, evento inicial 101 e evento posterior successful=true/code=100/source=REF, ambos correlacionados com a charge.

A resposta sanitizada do GET está em apps/web/tests/fixtures/appypay-lookup-sandbox.json. Contém apenas campos fictícios necessários à validação, sem segredos, tokens, dados de alunos ou providerTransactionId.

## Erro descoberto e correção
O GET real devolve {payment:{...,transactionEvents:[...]}}; o cliente antigo exigia id e responseStatus na raiz. Isso impedia confirmar o estado mesmo quando o pagamento sandbox tinha sido concluído.
O cliente agora normaliza esse envelope apenas na consulta GET, exige histórico correlacionado com id/type da cobrança e usa o evento cronologicamente mais recente. Histórico vazio, estrangeiro, datas inválidas ou último timestamp ambíguo são rejeitados. Status Success isolado não confirma pagamento: continuam obrigatórios successful=true, code=100, source=REF e identificação/valor correspondentes. O POST de emissão mantém o parser anterior; não há retry automático de POST.

## Validação local
31 testes aprovados; lint do core sem erros; typecheck isolado do core aprovado. O teste de reconciliação usa a resposta real sanitizada e uma base em memória: comprova chamada GET autenticada, uma confirmação apesar de repetição e rejeição de valor divergente. Não é baixa executada no banco publicado. Nenhum novo build global foi realizado.

## Bloqueios que impedem publicar e concluir o ciclo
1. REPORT_SCAN.json/PERFORMANCE_GATE.md da main continuam FAIL/can_merge=false; inspeção atual confirma o endpoint teste-rpc com consulta pública de alunos e o cliente privilegiado na exclusão de turmas. O download fiscal também mantém getSupabaseAdmin. As correções anteriores estão no PR #297 e não estão na main atual. A auditoria integral ainda não foi certificada. O utilizador escolheu corrigir o legado antes de publicar, sem exceção.
2. Fornecedor AppyPay da Escola KLASSE, id 44e75a81-d8d1-4344-b9c9-835d3e8e81f3, continua inactive/environment=production e com adesão antiga. Não foi ativado nem trocado para sandbox nesta verificação. A credencial sandbox não corresponde à configuração desse fornecedor.
3. Não houve callback real recebido pelo KLASSE nem baixa no Supabase. O endpoint não foi ativado. Não devolver sucesso fictício nem marcar referência como paga manualmente para contornar a validação.

## Requisitos para concluir
Resolver e certificar o gate de segurança; alinhar o fornecedor sandbox com dados fictícios isolados; publicar a correção; configurar e confirmar webhook transacional nessa conta; então repetir o ciclo através do KLASSE e provar a baixa/idempotência no banco. Não confundir a simulação bem-sucedida no fornecedor com o fluxo publicado completo.

Documentação oficial consultada:
- https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385503-como-simular-pagamentos-no-ambiente-sandbox-gpo-e-refer%C3%AAncia-
- https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385505-como-validar-o-webhook-payloads
