# WhatsApp Flow — AppyPay sandbox
Estado em 2026-11-02: backend implementado/testado; rascunho Meta atualizado; SQL, segredos e publicação pendentes. Não operacional.
Flow: KLASSE — Pagamento AppyPay (teste)
Flow ID: 2328444514659033
Empresa: KLASSE; conta selecionada: Fexa Soluções de Negocio; número existente terminado em 6206, já registado.

## Validado ao vivo
- Meta aceita o JSON 7.3/data API 3.0 com zero erros e apresenta a pré-visualização.
- Primeiro ecrã explica a homologação fictícia de 100 AOA; data_exchange pede issue_test_reference.
- Segundo ecrã recebe entidade, referência, valor, validade e charge_id do servidor.
- Fechar o formulário não confirma pagamento. O estado pago depende da consulta autenticada AppyPay e reconciliação no servidor.
- O painel do Flow mostra número associado (concluído), mas URI do endpoint, assinatura da chave pública, associação ao app e saúde do endpoint pendentes.
- O conector confirma o número registado. O app Meta KLASSE existe e recebe a subscrição da conta Fexa, mas não tem callback configurado; está em modo de desenvolvimento. O app Meta Fexa tem callback existente; não foi alterado.

## Limites
Este JSON é apenas o rascunho visual/contrato de troca de dados. O endpoint /api/jobs/whatsapp/flows/appypay está implementado nesta branch, ainda não publicado nem ligado ao Flow. Não usar o webhook AppyPay como endpoint de Flows: são protocolos diferentes. Não foram enviados mensagens, templates, cobranças ou dados de alunos por WhatsApp; nenhum app foi publicado.
O painel também avisa que falta um método de pagamento para mensagens faturáveis. Isso é faturação da Meta, independente das credenciais da AppyPay. Não foi adicionado cartão ou assumido compromisso financeiro.
Os gates de release AppyPay/KLASSE previamente documentados continuam em vigor. Não marcar a criação do rascunho como integração completa.

## Ligação pendente
Implementar endpoint HTTPS de Flows, validar a origem e desencriptar/encriptar segundo o protocolo Meta; configurar credenciais e chave privada apenas no servidor; associar chave pública/número/app e comprovar healthcheck. Para emissão, usar sessão autorizada e reserva idempotente no servidor, escola e valor controlados pelo servidor. Nunca confiar em escola/aluno/valor recebido do formulário. Separar fixtures de dados reais.
Depois concluir o webhook/reconciliação AppyPay e testar o Flow no telefone de um destinatário de teste escolhido pelo utilizador. Não enviar para famílias nem presumir destinatário a partir do número remetente.

Referência oficial: https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/implementingyourflowendpoint/
Prova local do painel: /private/tmp/klasse-whatsapp-flow-evidence/draft-endpoint-pending.png.

## Backend implementado
- POST /api/jobs/whatsapp/flows/appypay, fechado por WHATSAPP_APPYPAY_TEST_ENABLED (por defeito desligado).
- WHATSAPP_APPYPAY_FLOW_CONFIG é JSON privado com schoolId, flowId, phoneId, appSecret e privateKey. APPYPAY_CONFIG deve ser sandbox e da Escola KLASSE. Credenciais production são rejeitadas antes de autenticar/emitir.
- HMAC SHA256 da Meta verificado sobre bytes brutos antes de RSA-OAEP SHA256/AES-128-GCM. Resposta usa o IV invertido exigido pela Meta. Tamanho do corpo limitado a 32768 bytes, inclusive sem Content-Length; no-store em todas as respostas e chamadas ao fornecedor.
- Token de teste assinado, válido até 30 minutos e vinculado à escola, ao Flow e ao remetente FEXA. Só o operador local pode criá-lo; não existe endpoint público para gerar tokens.
- Novas sessões têm referência fictícia fixa de 100 AOA, sem aluno, mensalidade ou intent real. Tabela privada separada, com CAS ready→issuing e issued→simulating. Resultado incerto nunca repete POST; consultas posteriores usam apenas GET.
- STATUS confirmado depende de GET autenticado e correspondência de id/merchant/valor/moeda/source/code. O resultado apenas atualiza a sessão fictícia. Nenhuma baixa ocorre nas tabelas reais.
- INIT/START → emitir referência; REFERENCE → simular pagamento; STATUS → concluir teste. Pending permanece na referência; divergências e sessões inválidas são rejeitadas.

## Verificação desta implementação
39 testes passaram: casos AppyPay existentes, transporte HTTP real do handler com assinatura/encriptação, limites de corpo, healthcheck sem consulta ao banco, tokens expirados/alterados/escopo errado, concorrência de emissão, simulação repetida/timeout e divergência de valor. Fixtures não substituem validação em telefone nem execução do SQL proposto. Lint de todos os módulos de produção alterados sem erros; typecheck dos módulos e typecheck global apps/web concluídos com exit 0. Nenhum novo build Next completo foi executado.

## Preparação privada do operador
scripts/prepare-appypay-whatsapp-test.ts prepara chave RSA local, configuração privada e opcionalmente o payload draft de envio. Recebe diretório privado; nunca envia mensagens e nunca imprime segredos. O App Secret do app Meta KLASSE deve estar em meta-app-secret.txt. O token de acesso da Cloud API, quando necessário para assinatura/envio, fica em whatsapp-access-token.txt, exclusivamente local. Os ficheiros locais em /private/tmp/klasse-appypay-homologacao usam permissões restritas; nenhum valor está neste repositório.
O destinatário foi explicitamente escolhido pelo utilizador: número terminado em 2877; é diferente do remetente FEXA terminado em 6206. O número completo só está no ficheiro privado recipient.txt.
Depois da publicação e das chaves configuradas, executar o operador com argumento message para gerar payload/flow_token novo, de 30 minutos. Antes de enviar, confirmar janela de atendimento ou template aprovado; um pedido explícito de teste não contorna as regras de entrega da Meta.

## SQL ainda não aplicado
session-store.proposed.sql cria apenas whatsapp_appypay_test_sessions, com escola/Flow/remetente fixos, montante JSON 100 AOA, RLS e privilégios apenas do servidor. Sem políticas para anon/authenticated por desenho privado. Tabela não existe no projeto em consulta de 2026-11-02. A proposta não altera tabelas financeiras existentes nem dados de alunos. Aprovação do contrato necessária antes de instalar o novo contrato SQL. Não declarar o store exercitado em Postgres antes dessa instalação/teste.
O gate global continua FAIL/can_merge=false. A implementação do teste não concede exceção de release, não publica apps Meta e não altera o callback existente do app FEXA. App Secret, token Meta e callback do app KLASSE continuam pendentes.

A leitura do App Secret foi tentada no painel Meta, que exige reautenticação por senha. A confirmação foi deixada para o utilizador, sem ler/guardar senha e sem alterar/regerar o App Secret. A chave RSA local foi preparada em ficheiros privados; ainda não foi enviada à Meta nem à Vercel. O rascunho atualizado tem três ecrãs, foi guardado, recarregado e apresenta zero erros/preview START válido. Prova: /private/tmp/klasse-whatsapp-flow-evidence/backend-ready-draft.png.
