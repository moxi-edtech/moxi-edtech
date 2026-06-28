# Manual Curto do WhatsApp Utility

O KLASSE integra-se ao WhatsApp via API WAHA para permitir o envio automatizado e manual de comunicados e notificações de cobrança.

## 1. Conexão e Status do Dispositivo
- Acessível em **Administração > Configurações > Comunicação** (rota: `/escola/[schoolId]/admin/configuracoes/comunicacao`).
- Para emparelhar um dispositivo, leia o QR Code gerado na tela com o aplicativo do WhatsApp do smartphone da escola.
- O status da conexão ("CONNECTED", "DISCONNECTED") é atualizado em tempo real.

## 2. Fluxo de Rascunhos e Envios
- O assistente de IA pode preparar rascunhos de mensagens para o WhatsApp com base nos inadimplentes do Radar ou comunicados escolares.
- **Importante:** A IA nunca envia mensagens diretamente para o destinatário sem supervisão.
- Todo rascunho criado pelo assistente deve ser enviado para a Central de Comunicação WhatsApp, onde passa por revisão humana obrigatória.
- As mensagens utilizam placeholders como `[Nome]` e `[Valor]` para proteger a privacidade dos dados antes da aprovação do envio.

## 3. Central de Mensagens (Inbox)
- A Central WhatsApp (rota: `/escola/[schoolId]/admin/comunicacao/whatsapp`) centraliza as conversas iniciadas com encarregados e o histórico de mensagens enviadas.
