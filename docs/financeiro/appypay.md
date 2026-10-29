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
- Interface integrada no botão financeiro de recebimento e no extrato do aluno em Turmas e Alunos. A ação só aparece quando o servidor confirma gateway ativo e permissão financeira na escola aberta. O diálogo consulta o saldo, exige confirmação, exibe entidade/referência/valor/vencimento na hora de Angola, copia os dados e verifica pagamento. Após confirmação, o extrato e o resumo são atualizados.

## APIs

Todas as respostas financeiras usam Cache-Control no-store; routes force-dynamic e fetches do provedor no-store.

`GET /api/financeiro/appypay/status`

Retorna apenas disponibilidade/ambiente/escola para a sessão autorizada. Sem credenciais. A UI deduplica consultas de disponibilidade por escola via SWR; fetch HTTP sempre no-store. Escolas diferentes e gateway desativado não recebem controles de emissão.

`GET /api/financeiro/appypay/references?obligationId=UUID`

Consulta prévia autenticada: devolve saldo, referência existente pública e canIssue. Não chama o provedor nem cria cobrança. Campos privados da referência nunca são devolvidos.

`POST /api/financeiro/appypay/references`

Body: `{ "obligationId": "UUID da mensalidade", "expectedAmount": 1500 }`. expectedAmount é apenas uma pré-condição contra saldo alterado desde a consulta: o valor da cobrança continua calculado no servidor e deve coincidir com o saldo mostrado. Não aceita valor efetivo, escola, ambiente ou credenciais no body. A seleção da escola usa x-escola-id, validada pelo resolvedor de vínculo e por can_manage_school; nunca é autorização por si só.
Verifica sessão, resolve escola, exige can_manage_school e provedor AppyPay ativo na mesma escola/ambiente.
Calcula o saldo no servidor, reserva uma referência local e então emite cobrança REF. A resposta expõe apenas referência/entidade/valor/vencimento/status.

`POST /api/webhooks/appypay`

Usa apenas o id da notificação; determina escola/provedor pela configuração privada. Exige referência local e consulta GET /charges/{id} na AppyPay. Compara charge id, merchantTransactionId, valor, moeda quando presente e source REF. Code 101 não significa pago: só Success, successful=true e code 100 podem confirmar. Guarda somente resultado verificado.
Se a notificação chegar antes da gravação da resposta de emissão, usa merchantTransactionId apenas para selecionar uma reserva local pendente; exige confirmação autenticada de charge/merchant/valor/referência antes de vincular o id. A resposta tardia do emissor nunca altera paid para active.
Não assume assinatura HMAC que a documentação não especifica. A prova de pagamento vem da consulta autenticada ao provedor.

`POST /api/financeiro/appypay/reconcile`

Body: `{ "referenceId": "UUID local" }`. Mesmas permissões/escola; consulta novamente o provedor e executa o mesmo fluxo idempotente. Recuperação manual de notificações perdidas para referências já emitidas e persistidas.

## Idempotência, recuperação e consistência

- Índice existente `ux_payment_references_active_obligation` e reserva antes do POST impedem dois emissores concorrentes.
- Cada emissão tem merchantTransactionId alfanumérico de 15 caracteres e referência numérica de 9 dígitos. Colisão local falha antes da cobrança.
- Timeout ou resultado incerto deixa a reserva pending. NÃO repetir POST financeiro automaticamente. Rever a transação no portal; comparar id/merchant/valor antes de associar a charge à reserva. Não apagar a reserva para tentar novamente sem conferir o provedor.
- Uma referência active expirada ou com saldo alterado exige revisão. A integração não cancela cobranças automaticamente.
- Uma referência ativa com valor diferente do saldo atual é ocultada da sugestão de pagamento e encaminhada à revisão, sem permitir nova emissão.
- O índice de intents e ignoreDuplicates impedem reset de confirmed para pending. A data original paid_at é preservada em callbacks repetidos. Retries após confirmação apenas completam os registros auxiliares.
- A função SQL aprovada bloqueia intent e mensalidade e revalida saldo antes de chamar a RPC financeira existente. Não altera RLS nem a RPC existente; exige tenant/permissão e vínculo à referência AppyPay. Saldo alterado vai para manual_review.
- Workers ProxyPay agora selecionam somente eventos do provedor ProxyPay.

## Credenciais

`APPYPAY_CONFIG` é um JSON privado com `schoolId`, `environment`, `clientId`, `clientSecret`, `paymentMethod` (REF_ + chave). Nunca usar NEXT_PUBLIC_, config de tabela, payload do browser ou logs. Não incluir valores em issues/PRs.
O ficheiro local `.env.appypay.local` é gitignored e modo 0600; é uma cópia de operação e não é carregado automaticamente pelo Next. A Vercel injeta a Secret em Production. Preview não recebe credenciais reais.
O segredo foi fornecido pelo proprietário nesta conversa. A eventual substituição da credencial deve ser feita pelo proprietário; não houve rotação automática.

## Testes executados

- 19 testes de código e HTTP: auth/permissões, escolas distintas, callbacks inválidos e grandes, OAuth, separação de ambientes, código 101, dados divergentes, emissões concorrentes, timeout sem repetição, duplicatas e falha após confirmação, recuperação de webhook antecipado, proteção de paid contra resposta tardia, saldo alterado desde a consulta e preservação da data original em callbacks repetidos.
- TypeScript strict dos módulos core/service passou. Após recuperar as dependências fixadas, o typecheck direcionado de todos os módulos e das rotas AppyPay passou com imports/tipos reais do projeto. No teste HTTP, as dependências de fronteira são simuladas.
- PostgreSQL 14.17 local, descartável: SQL da proposta executado literalmente. Bloqueio de outra escola/anon, saldo alterado por transação concorrente e confirmações duplicadas simultâneas passaram. A RPC financeira existente foi representada por fixture; isto NÃO prova o fluxo completo com triggers/RLS do PostgreSQL 17 de produção.
- Build Next.js de produção completo aprovado, incluindo verificação de tipos e geração de 182 páginas. Executado com credenciais fictícias, URL build-only.invalid e gateway desativado; não acessa os dados de produção. Lint dos ficheiros alterados passou separadamente. Dependências instaladas com frozen-lockfile, sem mudar o lockfile.
- Scanners legados do repositório executados; não cobrem todas as regras do contrato 2.0.0. Seus resultados não autorizam PASS global.
- Verificação no Supabase após aplicação SQL: hash do corpo idêntico ao aprovado, privilégios e SECURITY INVOKER conferidos; probe com intent inexistente passou sem alterações de dados. Advisors consultados sem aviso específico AppyPay; isto não comprova ausência de avisos globais.
- Validação visual do componente real em fixture local com dados fictícios: consulta sem POST, confirmação explícita, referência emitida, pagamento confirmado, resultado incerto sem repetição, controles ocultos quando desativado e retorno de foco após Escape. A fixture valida o expectedAmount enviado pelo componente e não acessa AppyPay/Supabase. Não equivale à validação autenticada do portal publicado.
- Screenshot local: /private/tmp/klasse-appypay-evidence/reference.jpg (dados fictícios).
- Não houve teste de cobrança ou pagamento real/sandbox no provedor.

Execução em ambiente com dependências instaladas:

```sh
node --import tsx --test apps/web/tests/unit/appypay.spec.ts apps/web/tests/unit/appypay-http.spec.ts
# Fixture visual local, sem credenciais reais:
node apps/web/tests/fixtures/appypay-preview.mjs
```

O teste HTTP resolve esbuild através do pacote tsx para respeitar a árvore de dependências do pnpm.
Para SQL, usar somente um PostgreSQL descartável com os parâmetros de segurança descritos no início de `apps/web/tests/appypay-atomic-local.py`. O script cria fixtures de domínio e nunca deve apontar para Supabase.

## Ativação pendente

1. SQL atômico: concluído. Aprovação registada no commit 42c9855c8, migration aplicada, permissões/código/probe verificados no PostgreSQL real. O ficheiro `appypay-confirm-payment.proposed.sql` preserva o snapshot aprovado e é idêntico à migration; não executar novamente como uma segunda migration.
2. Concluir revisão e cobertura integral do gate contratual; o estado final do build/lint/testes está nos reports deste run. Publicar o commit aprovado mantendo emissão desativada. Não publicar por inferência desta documentação.
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

## Portal do aluno — propinas, serviços e emolumentos (2026-10-29)

O pedido atual autoriza colocar o fluxo em produção para a Escola KLASSE. Esta extensão ainda depende da aprovação financeira específica `cf8dc48d-6b39-47d3-af87-410afcf95ddb` em `agents/outputs/PENDING_APPROVAL.md`; o SQL proposto e testado está em `appypay-portal-services.proposed.sql` (SHA256 `989e97331e2ddcb0aaf89723af731d5cbbf6ffcb95362ac525e39ae948bbc60a`). Não foi aplicado no Supabase.

- Financeiro do aluno: botão Pagar com AppyPay em cada propina pendente e pedido de serviço com intenção draft, incluindo serviços não documentais. Débitos com comprovativo pendente não geram outra cobrança.
- Secretaria Digital e notas: o mesmo botão está no drawer de pagamento dos serviços. O retorno de confirmação atualiza o catálogo; não exibe a mensagem de envio de comprovativo.
- `GET /api/aluno/financeiro/appypay?action=status|preview`: sessão, escola resolvida, studentId autorizado e RPC autenticada de propriedade. Preview exige kind=monthly|service e targetId; para serviços o targetId é o pagamento_intent_id.
- `POST /api/aluno/financeiro/appypay`: action=issue exige a mesma seleção e expectedAmount; action=check exige referenceId. Outros campos são recusados. O servidor ignora qualquer seleção de escola enviada por cliente e deriva a escola da sessão.
- O endpoint humano não usa service_role. Encaminha apenas um comando assinado HMAC ao worker `/api/jobs/appypay/portal`, com corpo, caminho e timestamp vinculados, expiração de 60 segundos e destino fixo https://app.klasse.ao. O segredo AppyPay permanece no servidor; ele não é transmitido ao worker nem ao browser, apenas a assinatura derivada.
- O worker valida a assinatura antes de criar o cliente privilegiado, confere escola/aluno/provedor e volta a consultar os débitos por escola E aluno. Status fica indisponível se a nova tabela não existir. Assinaturas repetidas não repetem cobranças: as reservas exclusivas e o fluxo idempotente permanecem obrigatórios.
- Propinas reaproveitam a tabela/baixa atômica já aprovadas. Serviços usam a nova tabela privada appypay_service_references vinculada a servico_pedidos/pagamento_intents; não são convertidos em mensalidades fictícias.
- A resposta documentada de criação REF não inclui valor/merchant; valida-se sua referência/código/fonte. A confirmação exige o GET autenticado com valor, merchant, id, moeda e source REF compatíveis. Código 101 nunca baixa o débito.
- A nova função appypay_confirm_service_payment bloqueia referência, intenção e pedido e exige evento de pagamento verificado. Revalida valores/vínculos/estado, usa draft → pending → settled para preservar o guard de boletim e deixa os gatilhos existentes criarem pagamentos. A mesma charge mantém a data original e não materializa dois pagamentos.
- Intenções de serviço usam o método canônico existente mcx e metadata provider=appypay/charge id. Não muda enum ou contrato de método existente. Pedidos que exigem aprovação permanecem blocked após pagamento; a elegibilidade de rematrícula continua sendo verificada.
- O histórico identifica cada pedido pelo UUID, evitando esconder um novo pedido porque o mesmo código de serviço já foi pago no passado.

### Evidência desta extensão
29 testes de código/HTTP passaram, incluindo rota real aluno → broker assinado → operação com fronteiras de sessão/DB/HTTP simuladas. Seis grupos SQL locais passaram usando literalmente a proposta e snapshots dos dois gatilhos existentes (boletim e materialização do pagamento): permissões negativas, callbacks simultâneos, aprovação de serviço, valor alterado, evento 101 e alteração concorrente com row lock. A fixture usa PostgreSQL 14 e esquema reduzido; não certifica todos os gatilhos/RLS de produção.

Validação no navegador com dados fictícios: pagamento do serviço, confirmação após verificação, cópia com mensagem de sucesso, propina com emissão incerta sem segundo POST. Abrir o diálogo confirmou zero POST; recuperar a emissão incerta confirmou exatamente um POST. Captura: /private/tmp/klasse-appypay-evidence/student-service.png.

Painel AppyPay de produção consultado: lista de webhooks vazia; adesões disponíveis GPO MS 1791542425 e REF MS 1791542538. Nenhum webhook foi criado ou alterado. A instalação deve usar somente a adesão REF e POST https://app.klasse.ao/api/webhooks/appypay depois da publicação.

Executar os testes de código com os dois ficheiros anteriores e `apps/web/tests/unit/appypay-portal.spec.ts`. O novo ensaio SQL é `apps/web/tests/appypay-services-local.py`; aceita exclusivamente a base descartável appypay_services_test no socket local documentado. Não usar o script no Supabase.

Build final desta extensão: Next.js completo com validação de tipos e 182 páginas aprovado, usando chaves fictícias e gateway desligado. Lint: zero erros, um aviso preexistente MAX_SPAN não usado na rota financeira do aluno (presente no commit base). Nenhuma dependência ou lockfile alterados. A interface foi validada com API fictícia; ainda não há sessão autenticada de aluno no fluxo publicado.

Verificação HTTP sobre o servidor local da versão compilada: worker sem assinatura → 401; corpo do worker maior que 4 KiB → 413; webhook com id inválido → 400; rota do aluno sem sessão → 401. Chaves/configuração fictícias, sem chamada válida à AppyPay/Supabase. Isto verifica as fronteiras negativas em runtime, não o fluxo autenticado de produção.
