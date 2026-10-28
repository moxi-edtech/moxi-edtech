# AppyPay — Escola KLASSE

## Estado e limites de prova

Branch `codex/appypay-escola-klasse`, baseada em `origin/main` 074f96b21.
Integração REF (pagamento por referência), API v2.0, produção. MCX/GPO não implementado: a aplicação GPO consultada está inactiva.

- Autenticação OAuth2 de produção verificada, sem criar cobrança.
- `APPYPAY_CONFIG` guardada como Secret na Vercel, projeto `moxi-edtech`, apenas Production, com autorização explícita do proprietário. Não existe cópia em código, frontend, logs ou config do banco.
- `APPYPAY_ENABLED=false`. A variável privada contém o vínculo à escola; não existe fallback para credenciais de outra escola.
- Provedor cadastrado no Supabase para Escola KLASSE, ambiente production, status inactive, config `{}`. Nenhuma cobrança emitida.
- Webhook implementado, mas NÃO publicado ou cadastrado no portal. Nenhum webhook existente foi substituído.
- `appypay_confirm_payment` aprovada pelo proprietário e aplicada no Supabase: migration `20261028224738_appypay_atomic_confirmation.sql`. Código do corpo idêntico ao aprovado; SECURITY INVOKER, search_path fixo, sem EXECUTE para anon, com EXECUTE para authenticated/service_role. Probe sem dados reais confirmou o erro esperado para intent inexistente. Histórico em `agents/outputs/PENDING_APPROVAL.md`.
- Sem UI nova: são APIs de backend. O fluxo de emissão deve ser chamado por uma sessão autenticada com permissão financeira.

## APIs

Todas as respostas financeiras usam Cache-Control no-store; routes force-dynamic e fetches do provedor no-store.

`POST /api/financeiro/appypay/references`

Body: `{ "obligationId": "UUID da mensalidade" }`. Não aceita escola, valor, ambiente ou credenciais do cliente.
Verifica sessão, resolve escola, exige can_manage_school e provedor AppyPay ativo na mesma escola/ambiente.
Calcula o saldo no servidor, reserva uma referência local e então emite cobrança REF. A resposta expõe apenas referência/entidade/valor/vencimento/status.

`POST /api/webhooks/appypay`

Usa apenas o id da notificação; determina escola/provedor pela configuração privada. Exige referência local e consulta GET /charges/{id} na AppyPay. Compara charge id, merchantTransactionId, valor, moeda quando presente e source REF. Code 101 não significa pago: só Success, successful=true e code 100 podem confirmar. Guarda somente resultado verificado.
Não assume assinatura HMAC que a documentação não especifica. A prova de pagamento vem da consulta autenticada ao provedor.

`POST /api/financeiro/appypay/reconcile`

Body: `{ "referenceId": "UUID local" }`. Mesmas permissões/escola; consulta novamente o provedor e executa o mesmo fluxo idempotente. Recuperação manual de notificações perdidas para referências já emitidas e persistidas.

## Idempotência, recuperação e consistência

- Índice existente `ux_payment_references_active_obligation` e reserva antes do POST impedem dois emissores concorrentes.
- Cada emissão tem merchantTransactionId alfanumérico de 15 caracteres e referência numérica de 9 dígitos. Colisão local falha antes da cobrança.
- Timeout ou resultado incerto deixa a reserva pending. NÃO repetir POST financeiro automaticamente. Rever a transação no portal; comparar id/merchant/valor antes de associar a charge à reserva. Não apagar a reserva para tentar novamente sem conferir o provedor.
- Uma referência active expirada ou com saldo alterado exige revisão. A integração não cancela cobranças automaticamente.
- O índice de intents e ignoreDuplicates impedem reset de confirmed para pending. Retries após confirmação apenas completam os registros auxiliares.
- A função SQL aprovada bloqueia intent e mensalidade e revalida saldo antes de chamar a RPC financeira existente. Não altera RLS nem a RPC existente; exige tenant/permissão e vínculo à referência AppyPay. Saldo alterado vai para manual_review.
- Workers ProxyPay agora selecionam somente eventos do provedor ProxyPay.

## Credenciais

`APPYPAY_CONFIG` é um JSON privado com `schoolId`, `environment`, `clientId`, `clientSecret`, `paymentMethod` (REF_ + chave). Nunca usar NEXT_PUBLIC_, config de tabela, payload do browser ou logs. Não incluir valores em issues/PRs.
O ficheiro local `.env.appypay.local` é gitignored e modo 0600; é uma cópia de operação e não é carregado automaticamente pelo Next. A Vercel injeta a Secret em Production. Preview não recebe credenciais reais.
O segredo foi fornecido pelo proprietário nesta conversa. A eventual substituição da credencial deve ser feita pelo proprietário; não houve rotação automática.

## Testes executados

- 14 testes de código e HTTP: auth/permissões, escolas distintas, callbacks inválidos e grandes, OAuth, separação de ambientes, código 101, dados divergentes, emissões concorrentes, timeout sem repetição, duplicatas e falha após confirmação.
- TypeScript strict dos módulos core/service passou. Após recuperar as dependências fixadas, o typecheck direcionado de todos os módulos e das três rotas AppyPay passou com imports/tipos reais do projeto. No teste HTTP, as dependências de fronteira são simuladas.
- PostgreSQL 14.17 local, descartável: SQL da proposta executado literalmente. Bloqueio de outra escola/anon, saldo alterado por transação concorrente e confirmações duplicadas simultâneas passaram. A RPC financeira existente foi representada por fixture; isto NÃO prova o fluxo completo com triggers/RLS do PostgreSQL 17 de produção.
- Verificação inicial: typecheck global limitado pelas dependências do checkout original, com 1865 diagnósticos. Após aprovação SQL, as dependências foram reinstaladas com frozen-lockfile e sem alteração do lockfile; os 14 testes passaram nesse ambiente. A nova tentativa global de typecheck foi interrompida após mais de seis minutos sem retornar diagnósticos; é inconclusiva. Não houve build completo validado.
- Scanners legados do repositório executados; não cobrem todas as regras do contrato 2.0.0. Seus resultados não autorizam PASS global.
- Verificação no Supabase após aplicação SQL: hash do corpo idêntico ao aprovado, privilégios e SECURITY INVOKER conferidos; probe com intent inexistente passou sem alterações de dados. Advisors consultados sem aviso específico AppyPay; isto não comprova ausência de avisos globais.
- Não houve teste de cobrança ou pagamento real/sandbox no provedor.

Execução em ambiente com dependências instaladas:

```sh
node --import tsx --test apps/web/tests/unit/appypay.spec.ts apps/web/tests/unit/appypay-http.spec.ts
```

O teste HTTP resolve esbuild através do pacote tsx para respeitar a árvore de dependências do pnpm.
Para SQL, usar somente um PostgreSQL descartável com os parâmetros de segurança descritos no início de `apps/web/tests/appypay-atomic-local.py`. O script cria fixtures de domínio e nunca deve apontar para Supabase.

## Ativação pendente

1. SQL atômico: concluído. Aprovação registada no commit 42c9855c8, migration aplicada, permissões/código/probe verificados no PostgreSQL real. O ficheiro `appypay-confirm-payment.proposed.sql` preserva o snapshot aprovado e é idêntico à migration; não executar novamente como uma segunda migration.
2. Instalar dependências, concluir build/typecheck e revisão. Publicar o commit aprovado mantendo emissão desativada. Não publicar por inferência desta documentação.
3. Ativar o provedor exclusivamente na Escola KLASSE e habilitar APPYPAY_ENABLED em Production no release aprovado. Variáveis só chegam a um novo deployment.
4. No portal AppyPay, Integração → Webhooks, cadastrar POST `https://app.klasse.ao/api/webhooks/appypay`, associado à aplicação REF. Confirmar o estado ativo e a entrega no portal; resolver o comportamento de validação observado antes de habilitar emissão aos operadores.
5. Teste real somente com pagador/finalidade/valor explicitamente autorizados. Conferir referência, GET da charge, evento, intent, pagamento e mensalidade, incluindo reenvio do webhook. A ação de pagar cabe ao utilizador.
6. Reversão operacional: APPYPAY_ENABLED=false em novo deployment e provedor inactive. Preservar eventos/referências/intents já existentes para auditoria e conciliação.

## Fontes oficiais consultadas

- OAuth2: https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385501
- Cobranças REF/GPO: https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385502-criar-uma-cobranca-charge-na-api-appypay-gpo-e-refer%C3%AAncia
- Webhooks/payloads: https://suporte-appypay.freshdesk.com/support/solutions/articles/501000385505-como-validar-o-webhook-payloads
- Credenciais: https://suporte-appypay.freshdesk.com/support/solutions/articles/501000417474-como-obter-as-credenciais-de-integrac%C3%A3o-client-id-client-secret-api-keys-e-resource-id

O guia OAuth diverge entre tabela e exemplo de produção. A URL da tabela (`login.microsoftonline.com/appypay.co.ao/oauth2/token`) foi validada por autenticação real nesta tarefa.
