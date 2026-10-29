# AppyPay — verificação do webhook e proteção do legado
Data: 2026-10-29
Base: d0b79c4a371b3856fbbd5bd02bbe613d25fae04b
Branch: codex/appypay-release-hardening

## Webhook
Na aplicação REF MS 1791542538, Programador mostra um único vínculo de webhook de pagamentos ativo para a URL do KLASSE. A lista geral continua vazia; portanto não é prova de inexistência. Através do menu da chave → Webhook, foi aberto o webhook DEFAULT existente, cujo nome anterior era KLASSE. Foi atualizado, guardado e reaberto após recarregar:
- Nome: KLASSE — Confirmação de Pagamentos
- Descrição: Notificações transacionais de pagamentos por referência da Escola KLASSE.
- URL: https://app.klasse.ao/api/webhooks/appypay
- Método: POST
- Ativo no portal: sim

Não foi criado outro vínculo. A descrição não certifica a classificação: a tela do webhook existente não apresenta o seletor Tipo. “Transacional” ainda exige confirmação do fornecedor/portal (APY-008). As tentativas do formulário geral não produziram entradas visíveis; não foram contadas como cadastro concluído. Nome e URL persistidos foram comprovados reabrindo o vínculo real da aplicação. Captura local: /private/tmp/klasse-appypay-evidence/webhook-persisted.png.

No Supabase, somente metadados administrativos do fornecedor AppyPay da Escola KLASSE foram atualizados: application_name=REF MS 1791542538, webhook_url acima, webhook_method=POST, webhook_type=transactional (configuração pretendida, não evidência do tipo efetivo no portal). Provedor continua inactive/production, produtos [ref]. Nenhuma credencial armazenada em tabela. Nenhuma cobrança real emitida.

Release externo #295 já publicou a integração. POST {} no endpoint publicado retornou 503 {ok:false,error:AppyPay indisponível}; APPYPAY_ENABLED=false permanece. Não é receção operacional de pagamentos. O formato documentado foi revisado; nenhum callback real foi recebido para validação. Confirmar via GET autenticado da cobrança antes de reconciliar; nunca confiar apenas no corpo do callback.

Documentação oficial:
- [Configuração por aplicação](https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385504-passo-a-passo-para-configurar-um-webhook-no-portal-appypay)
- [Payloads e validação](https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385505-como-validar-o-webhook-payloads)

## Legado
O utilizador escolheu corrigir antes de publicar, recusando exceção. Nesta branch:
1. Diagnóstico teste-rpc retirado, 404 sem consulta ou detalhes de alunos.
2. Cópia do calendário filtra a escola resolvida nos anos e eventos. Fixture A/B comprova ausência de cópia cruzada.
3. Exclusão de turma remove service role e exige sessão/escola/permissão. A exclusão fica temporariamente indisponível (409) para proteger dependências académicas/financeiras: o banco contém várias FKs CASCADE, e conferir apenas três tabelas não evita eliminação indireta nem corridas concorrentes. Reabertura exige operação atómica adequada; não foi criada migração/RLS sem aprovação.

Validação: 30 testes de integração lógica/HTTP com fixtures aprovados; lint dos três endpoints sem erros. Nenhum teste em dados reais. Typecheck global apps/web concluído com exit 0, sem diagnósticos. Não foi executado novo build Next completo nesta branch. Os três findings anteriores foram corrigidos, mas a auditoria global e a matriz MV continuam sem certificação. Gate can_merge=false; não ativar processamento nem alegar PASS global.

## Bloqueio adicional na triagem
SEC-002-7e446b7f: rota humana fiscal/saft/export/[exportId]/download cria cliente privilegiado para assinar URLs, sem exceção documentada (SEC-002). A correção ainda requer operação de domínio segura ou política tenant-scoped devidamente aprovada; não assumir que remover a credencial preserve o download. Nenhuma alteração de RLS aplicada. Ver evidência completa no REPORT_SCAN.md.
