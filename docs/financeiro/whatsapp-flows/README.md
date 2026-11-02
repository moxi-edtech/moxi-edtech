# WhatsApp Flow — AppyPay sandbox
Estado em 2026-11-02: rascunho criado e guardado na Meta; não publicado; não operacional.
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
Este JSON é apenas o rascunho visual/contrato de troca de dados. Não existe ainda endpoint de Flows implementado/ligado no KLASSE. Não usar o webhook AppyPay como endpoint de Flows: são protocolos diferentes. Não foram enviados mensagens, templates, cobranças ou dados de alunos por WhatsApp; nenhum app foi publicado.
O painel também avisa que falta um método de pagamento para mensagens faturáveis. Isso é faturação da Meta, independente das credenciais da AppyPay. Não foi adicionado cartão ou assumido compromisso financeiro.
Os gates de release AppyPay/KLASSE previamente documentados continuam em vigor. Não marcar a criação do rascunho como integração completa.

## Ligação pendente
Implementar endpoint HTTPS de Flows, validar a origem e desencriptar/encriptar segundo o protocolo Meta; configurar credenciais e chave privada apenas no servidor; associar chave pública/número/app e comprovar healthcheck. Para emissão, usar sessão autorizada e reserva idempotente no servidor, escola e valor controlados pelo servidor. Nunca confiar em escola/aluno/valor recebido do formulário. Separar fixtures de dados reais.
Depois concluir o webhook/reconciliação AppyPay e testar o Flow no telefone de um destinatário de teste escolhido pelo utilizador. Não enviar para famílias nem presumir destinatário a partir do número remetente.

Referência oficial: https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/implementingyourflowendpoint/
Prova local do painel: /private/tmp/klasse-whatsapp-flow-evidence/draft-endpoint-pending.png.
