# CRM KLASSE - Roadmap, Checklist e Backlog por Sprint

Versao: 1.3.0
Data: 2026-06-29
Atualizado em: 2026-06-30
Escopo: CRM comercial, onboarding, implantacao, capacitacao, suporte L1, comissoes e equipe do parceiro operacional

## 1. Objetivo

Transformar o CRM do parceiro em uma central operacional completa, cobrindo o fluxo:

`prospeccao -> demonstracao -> fechamento -> onboarding -> setup -> capacitacao -> go-live -> suporte L1 -> comissoes/payout`

O CRM deve permitir que os operadores trabalhem com inicio, meio e fim, mantendo evidencias, SLAs, responsabilidades e comissoes rastreaveis.

## 2. Checklist Macro

### Comercial

- [x] Cadastro de leads.
- [x] Etapas do funil comercial.
- [ ] Agenda de demonstracoes.
- [x] Historico de contactos.
- [x] Proposta comercial.
- [x] Aceite comercial.
- [x] Proxima acao comercial com data.
- [x] Painel de pendencias comerciais vencidas.

### Onboarding

- [x] Conversao do lead para escola em ativacao.
- [x] Checklist de implantacao.
- [x] Uploads/documentos.
- [x] Setup de dados.
- [x] Status por fase.
- [x] Termo de aceite assinado.

### Operacao

- [ ] Formacao da secretaria.
- [ ] Formacao dos docentes.
- [ ] Evidencias de treinamento.
- [ ] Ativacao/go-live.

### Suporte L1

- [x] Abertura de chamados.
- [x] Gravidade.
- [x] SLA.
- [x] Escalonamento L2/L3 para KLASSE.
- [ ] Relatorio de performance.

### Financeiro e Comissoes

- [x] Comissao de ativacao.
- [x] Comissao recorrente.
- [ ] Bloqueio por inadimplencia.
- [ ] Penalidade por SLA.
- [x] Solicitacao de payout.
- [ ] Upload de fatura/recibo.
- [x] Status de repasse.

### Gestao Interna

- [x] Operadores do parceiro.
- [x] Papeis/permissoes.
- [x] Reset de PIN.
- [x] Produtividade por operador.

## 3. Roadmap por Sprint

## Sprint 1 - Fundacao do CRM Operacional

### Meta

Garantir que o parceiro consegue gerir equipe, leads e tarefas sem depender do Super Admin para a rotina diaria.

### Backlog

- [x] Criar gestao de operadores no portal do parceiro.
- [x] Criar papeis: `admin`, `vendas`, `implantacao`, `suporte_l1`.
- [x] Adicionar criar/desativar/resetar PIN.
- [x] Melhorar agenda de follow-up dos leads.
- [x] Criar tarefas por operador.
- [x] Criar painel `Minhas pendencias`.

### Entrega

- [x] Parceiro administra a propria equipe.
- [x] Cada lead/tarefa tem responsavel.
- [x] Historico comercial fica rastreavel.

### Criterios de Aceite

- [x] Admin do parceiro cria operador.
- [ ] Operador entra com PIN.
- [x] Lead pode ter proxima acao com data e responsavel.
- [x] Dashboard mostra tarefas vencidas.

### Implementado em 2026-06-29

- UI do portal do parceiro: aba `Equipe` em `/influencers/[codigo]`.
- API: `/api/influencers/[codigo]/team` com `GET`, `POST` e `PATCH`.
- Banco remoto: migration `20270629100000_partner_portal_team_management.sql` aplicada.
- Papeis ativos no banco: `owner`, `admin`, `vendas`, `implantacao`, `suporte_l1`, `operator`.
- Painel de pendencias comerciais: card `Proximas acoes comerciais` na aba CRM.
- Responsavel por lead/follow-up: migration `20270629103000_crm_lead_responsavel_membro.sql` aplicada.
- UI do CRM permite escolher responsavel no cadastro do lead e no registro de contato.
- Produtividade por operador exibida na aba `Equipe`: leads ativos, follow-ups vencidos, leads sem acao, ganhos e pipeline potencial.

### Pendencias restantes da Sprint 1

- Validar login real de um operador recem-criado em ambiente remoto.

## Sprint 2 - Proposta, Fechamento e Conversao

### Meta

Fechar o ciclo comercial antes do onboarding.

### Backlog

- [x] Criar bloco de proposta comercial no lead.
- [x] Campos: plano, alunos, trial, taxa de ativacao, mensalidade.
- [x] Gerar proposta/preview.
- [x] Registrar aceite comercial.
- [x] Upload de proposta ou contrato preliminar.
- [x] Status: `proposta_enviada`, `aceite_comercial`, `aguardando_contrato_klasse`.
- [x] Melhorar botao `Iniciar ativacao` com validacoes.

### Entrega

- Lead so vira onboarding com dados comerciais minimos.
- KLASSE consegue ver o que foi negociado.

### Criterios de Aceite

- [x] Nao converter lead sem plano, trial e taxa de ativacao.
- [x] Trial maximo de 30 dias.
- [x] Taxa de ativacao registrada no onboarding.
- [x] Historico mostra quem converteu.

### Implementado em 2026-06-30

- Drawer do lead comercial no portal do parceiro com bloco `Proposta Comercial`.
- Campos ativos no lead: `plano_estimado`, `alunos_estimados`, `trial_days`, `taxa_ativacao`, `mensalidade_kz`.
- Status comercial ativos no banco e na UI: `rascunho`, `proposta_enviada`, `aceite_comercial`, `aguardando_contrato_klasse`.
- Upload de proposta/contrato preliminar via endpoint `/api/influencers/[codigo]/crm/leads/[leadId]/proposal`.
- Edicao dos termos comerciais via endpoint `/api/influencers/[codigo]/crm/leads/[leadId]/commercial`.
- Conversao para onboarding agora bloqueia sem etapa `ganho`, sem `trial_days` valido, sem `taxa_ativacao > 0` e sem status comercial pronto para conversao.
- Dados comerciais enviados para o onboarding incluem `trial_days`, `taxa_ativacao`, `mensalidade_kz`, `commercial_status` e `proposal_file_name`.
- Geração e impressão de proposta comercial print-ready em `/crm/proposta/preview` alimentada via query parameters do lead.
- Integração da UI: Botão de "Preview" adicionado ao bloco de Proposta Comercial no `CrmLeadDetailsSheet.tsx` para abrir a proposta preenchida em nova aba.

### Pendencias restantes da Sprint 2

- Definir se o aceite comercial exigira campo explicito de aprovador/canal ou se o status manual e suficiente.
- Decidir se o documento comercial deve migrar para bucket dedicado em vez de ficar no bucket `onboarding`.

## Sprint 3 - Checklist de Implantacao e Termo de Aceite

### Meta

Provar a entrega que libera os 100% da taxa de ativacao.

### Backlog

- [x] Criar checklist de implantacao por escola.
- [x] Incluir item: curriculo configurado.
- [x] Incluir item: turmas criadas.
- [x] Incluir item: disciplinas/pautas configuradas.
- [x] Incluir item: alunos importados.
- [x] Incluir item: encarregados importados.
- [x] Incluir item: formacao secretaria concluida.
- [x] Incluir item: formacao docentes concluida.
- [x] Incluir item: sistema em operacao.
- [x] Upload do Termo de Aceite.
- [x] Campo de assinatura/data/nome do diretor.
- [x] Status: `implantacao_em_andamento`, `aguardando_aceite`, `aceite_validado`.
- [x] Bloquear comissao de ativacao ate aceite validado.

### Entrega

- Implantacao passa a ter inicio, meio e fim.
- Comissao de ativacao fica ligada a evidencia contratual.

### Criterios de Aceite

- [x] Escola nao fica `implantada` sem checklist completo.
- [x] Termo de aceite e obrigatorio.
- [x] Comissao de ativacao aparece como pendente ate aceite.

### Implementado em 2026-06-29

- Banco remoto: migration `20270629120000_onboarding_implantation_checklist_foundation.sql` aplicada para criar o checklist de implantacao e os status de implantacao.
- Banco remoto: migration `20270629123000_onboarding_acceptance_term_gate.sql` aplicada para registrar Termo de Aceite, signatario, data de assinatura e validacao KLASSE.
- Banco remoto: migration `20270629124000_partner_portal_acceptance_fields.sql` aplicada para devolver os campos de aceite e papel do membro no portal do parceiro.
- RPC: `update_influencer_onboarding_implantation_checklist` normaliza os 8 itens obrigatorios, audita a alteracao e move a escola para `aguardando_aceite` quando o checklist fica completo.
- RPC: `validate_onboarding_implantation_acceptance` exige checklist completo, termo anexado, nome do diretor/signatario e data de assinatura antes de marcar `aceite_validado`.
- Gate financeiro: trigger `trg_activation_commission_acceptance_gate` impede aprovar ou pagar comissao de ativacao sem `aceite_validado` e termo assinado.
- UI do portal do parceiro: aba "Implantação" no drawer de detalhes da escola expondo os checkboxes e notas do checklist de implantação integrado à API PATCH `/checklist`.
- UI de Termo de Aceite: formulário operacional de upload do documento, preenchimento do signatário, cargo, data e notas com chamada integrada ao endpoint `/acceptance` (SLA de comissão liberado após validação).

### Pendencias restantes da Sprint 3

- Nenhuma. Sprint 3 totalmente entregue (Backend + Frontend).

## Sprint 4 - Setup de Dados e Documentos

### Meta

Dar ao parceiro controle real sobre recolha e preparacao dos dados.

### Backlog

- [x] Criar fila de documentos por escola.
- [x] Classificar uploads: legais, planilhas, contrato, logotipo, pautas.
- [x] Permitir triagem do parceiro com status `pendente`.
- [x] Permitir triagem do parceiro com status `em_revisao_parceiro`.
- [x] Permitir triagem do parceiro com status `pendencia_cliente`.
- [x] Permitir triagem do parceiro com status `pronto_para_klasse`.
- [x] Manter aprovacao final KLASSE onde necessario.
- [x] Adicionar comentarios por arquivo.
- [x] Linkar modelos de planilhas.
- [x] Criar checklist de recolha baseado no documento HTML.

### Entrega

- [x] Parceiro acompanha e cobra documentos sem depender de WhatsApp solto.
- [x] KLASSE recebe apenas material pronto para revisao/importacao.

### Criterios de Aceite

- [x] Operador marca arquivo como pendente ou pronto para KLASSE.
- [x] Escola/parceiro conseguem ver motivo da pendencia.
- [x] Super Admin mantem aprovacao final.

### Implementado em 2026-06-30

- Banco remoto: migration `20270630100000_partner_document_triage_sprint4.sql` aplicada.
- `onboarding_uploads` ganhou classificação documental (`document_type`) e campos de triagem do parceiro: nota, responsável e data.
- Estados documentais ativos: `pendente`, `processando`, `em_revisao_parceiro`, `pendencia_cliente`, `pronto_para_klasse`, `aprovado`, `rejeitado`.
- RPC: `partner_triage_onboarding_upload` garante que o parceiro só tria uploads da própria carteira e não altera arquivos já aprovados/rejeitados pela KLASSE.
- API: `/api/influencers/[codigo]/onboarding/[token]/uploads/[uploadId]/triage` com `PATCH`.
- UI do portal do parceiro: seção `Arquivos e Staging de Importação` no drawer da escola permite classificar documento, marcar status de pré-validação e adicionar comentário por arquivo.
- Super Admin continua com aprovação final em `/api/super-admin/onboarding/uploads/[uploadId]/review`; os novos estados de triagem são tratados como uploads ativos até decisão final KLASSE.
- Link de modelos de planilhas permanece no portal público de acompanhamento da escola e a triagem do parceiro usa a etapa `planilhas` como fila compartilhada.

### Pendencias restantes da Sprint 4

- Refinar checklist visual de recolha por tipo de documento dentro da aba da escola.
- Criar filtros dedicados para `pronto_para_klasse` no Super Admin, além da listagem geral de uploads.

## Sprint 5 - Capacitacao e Go-Live

### Meta

Registrar formacao e ativacao real da escola.

### Backlog

- [ ] Criar modulo de treinamentos.
- [ ] Tipo de treinamento: secretaria.
- [ ] Tipo de treinamento: direcao.
- [ ] Tipo de treinamento: professores.
- [ ] Tipo de treinamento: financeiro.
- [ ] Agenda de sessao.
- [ ] Lista de participantes.
- [ ] Evidencia: foto, ata, documento ou assinatura.
- [ ] Checklist pos-treinamento.
- [ ] Status de go-live.
- [ ] Registro de data oficial de ativacao.

### Entrega

- O parceiro comprova capacitacao.
- A escola so vai para operacao quando treinada.

### Criterios de Aceite

- [ ] Cada treinamento tem data, responsavel e evidencia.
- [ ] Go-live exige treinamentos minimos.
- [ ] Historico fica no perfil da escola.

## Sprint 6 - Suporte L1 com SLA

### Meta

Cumprir o anexo contratual de suporte e medir performance.

### Backlog

- [x] Criar tickets de suporte.
- [x] Campo: escola.
- [x] Campo: canal.
- [x] Campo: categoria.
- [x] Campo: gravidade.
- [x] Campo: responsavel.
- [x] Campo: SLA de resposta.
- [x] Campo: SLA de resolucao.
- [x] Gravidade Alta: FRT 15 min, resolucao 2h.
- [x] Gravidade Media: FRT 1h, resolucao 8h.
- [x] Gravidade Baixa: FRT 4h, resolucao 24h.
- [x] Relogio de SLA.
- [x] Status: `aberto`, `em_atendimento`, `aguardando_cliente`, `escalado_klasse`, `resolvido`.
- [x] Escalonamento L2/L3 para KLASSE.
- [ ] Anexos e prints.

### Entrega

- [x] Suporte deixa de ser informal.
- [x] SLA vira metrica contratual.

### Criterios de Aceite

- [x] Ticket calcula vencimento automaticamente.
- [x] SLA atrasado fica visivel.
- [x] Escalonamento gera historico.
- [ ] Relatorio mensal mostra cumprimento.

### Implementado em 2026-06-29

- Banco remoto: migration `20270629130000_partner_support_tickets_l1.sql` aplicada.
- Tabela `partner_support_tickets` criada com escola, canal, categoria, gravidade, status, responsavel, SLA de primeira resposta, SLA de resolucao, escalação e notas.
- RPCs ativos: `list_influencer_support_tickets`, `create_influencer_support_ticket` e `update_influencer_support_ticket`.
- SLAs automáticos por gravidade: alta `15 min / 2h`, media `1h / 8h`, baixa `4h / 24h`.
- API: `/api/influencers/[codigo]/support/tickets` com `GET`, `POST` e `PATCH`.
- UI do portal do parceiro: aba `Suporte L1` em `/influencers/[codigo]`.
- Operador consegue abrir ticket, selecionar escola em ativacao ou nome manual, definir canal/categoria/gravidade/responsavel, ver SLA vencido e mover status.
- Escalonamento para KLASSE exige motivo e grava historico em `audit_logs`.

### Pendencias restantes da Sprint 6

- Upload de anexos/prints por ticket.
- Relatorio mensal de cumprimento de SLA.

## Sprint 7 - Comissoes, Penalidades e Payout

### Meta

Fechar o financeiro do parceiro de ponta a ponta.

### Backlog

- [ ] Comissao de ativacao gerada apos aceite validado.
- [ ] Comissao de ativacao corresponde a 100% da taxa.
- [ ] Comissao recorrente corresponde a 25% do valor pago pela escola.
- [ ] Comissao recorrente fica suspensa por inadimplencia.
- [ ] Penalidade SLA: se mais de 15% dos chamados validos ficarem fora do SLA, reduzir 5% da comissao recorrente da carteira afetada.
- [x] Solicitacao de payout.
- [x] Upload de fatura/recibo.
- [x] Status de payout: `requested`, `approved`, `paid`, `rejected`, `cancelled`.
- [ ] Extrato mensal.
- [ ] Export CSV/PDF.

### Entrega

- Parceiro sabe quanto tem a receber e por que.
- KLASSE tem evidencia para pagar, bloquear ou aplicar penalidade.

### Criterios de Aceite

- [x] Payout nao abre sem fatura/recibo.
- [ ] Comissao recorrente nao aprova se escola nao pagou.
- [ ] Penalidade aparece discriminada.
- [x] Pagamento muda comissao para `paid`.

### Implementado em 2026-06-30

- Banco remoto: migration `20270630113000_partner_commission_payouts_sprint7.sql` aplicada.
- Tabelas criadas: `partner_commission_payouts` e `partner_commission_payout_items`.
- RPC: `create_influencer_partner_commission_payout` valida sessao do parceiro, exige fatura/recibo, aceita apenas comissoes `approved` ainda sem payout ativo e cria pedido com status `requested`.
- RPC: `get_influencer_partner_commissions` agora retorna `available_payout_kz`, `requested_payout_kz`, `payout_status` por item e lista recente de payouts.
- API: `/api/influencers/[codigo]/commissions/payouts` com upload de fatura/recibo para o bucket `onboarding`.
- UI do portal do parceiro: card `Payout disponivel` na area de comissoes do owner, com upload obrigatorio e historico recente de pedidos.
- Banco remoto: migration `20270630122000_partner_payout_reopen_unique_index.sql` aplicada para permitir nova solicitacao quando payout anterior for rejeitado/cancelado.
- API Super Admin: `/api/super-admin/commissions/payouts` lista pedidos com recibo assinado, itens e escolas relacionadas.
- API Super Admin: `/api/super-admin/commissions/payouts/[id]` aprova, rejeita, cancela e marca payout como pago; ao pagar, atualiza as comissoes relacionadas para `paid`.
- UI Super Admin: cockpit de comissoes agora inclui fila de payout com recibo, acoes administrativas e resumo por status.

### Pendencias restantes da Sprint 7

- Ajustar geracao/aprovacao automatica da comissao de ativacao apos `aceite_validado`, com evidencia de 100% da taxa.
- Suspender comissao recorrente por inadimplencia antes da aprovacao.
- Criar motor de penalidade SLA mensal.
- Criar extrato mensal e export CSV/PDF.

## Sprint 8 - Biblioteca Operacional e Painel de Carteira

### Meta

Consolidar a operacao diaria numa tela unica.

### Backlog

- [x] Criar biblioteca de POPs dentro do CRM.
- [x] Organizar POPs por fase: comercial.
- [x] Organizar POPs por fase: onboarding.
- [x] Organizar POPs por fase: setup.
- [x] Organizar POPs por fase: treinamento.
- [x] Organizar POPs por fase: suporte.
- [x] Organizar POPs por fase: financeiro.
- [x] Criar painel 360 da escola.
- [x] Painel 360 mostra lead.
- [x] Painel 360 mostra contrato.
- [x] Painel 360 mostra onboarding.
- [x] Painel 360 mostra checklist.
- [x] Painel 360 mostra treinamentos.
- [x] Painel 360 mostra tickets.
- [x] Painel 360 mostra SLA.
- [x] Painel 360 mostra comissoes.
- [x] Painel 360 mostra risco.
- [ ] Criar indicadores por operador.
- [ ] Criar indicadores por escola.
- [x] Criar alertas de risco.

### Entrega

- Operador tem uma tela unica para trabalhar a carteira.
- Gestor ve gargalos e produtividade.

### Criterios de Aceite

- [x] Cada escola tem timeline consolidada no painel 360.
- [x] POPs aparecem no contexto da fase.
- [x] Dashboard mostra pendencias criticas.

### Implementado em 2026-06-30

- UI: nova aba `Escolas 360` no portal do parceiro (`/influencers/[codigo]`).
- Componente: `Escola360TabContent` consolida lead, contrato comercial, onboarding, checklist de implantacao/treinamento, tickets, SLA, comissoes e risco operacional por escola.
- Navegacao: `PartnerAppShell` inclui a rota operacional `escolas360` dentro do grupo Funil/CRM.
- Acoes diretas: abrir lead, abrir detalhes de onboarding e registrar follow-up a partir do card 360.
- Regras de risco inicial: tickets fora do SLA, etapas atrasadas, documentos pendentes, ausencia de follow-up e comissoes bloqueadas.
- POPs publicados em `apps/web/public/crm/pops/parceiro` para acesso no navegador via `/crm/pops/parceiro/...`.
- Biblioteca contextual `PARTNER_CONTEXTUAL_POPS` liga POPs por fase: comercial, onboarding, setup, treinamento, suporte, financeiro e equipe.
- Painel 360 mostra `POPs da fase` com links diretos para os HTML relevantes da escola.
- UI dedicada `Biblioteca POPs` adicionada ao portal do parceiro com busca, filtros por fase e estado de revisão.
- Filtros do Painel 360: operador, risco, status de onboarding, SLA e carteira.
- Banco remoto: migration `20270630133000_partner_school_360_filters_risk_fk.sql` aplicada.
- Score de risco persistido em `onboarding_requests.crm_risk_score`, `crm_risk_level`, `crm_risk_reasons`, `crm_risk_snapshot` e `crm_risk_updated_at`.
- API: `/api/influencers/[codigo]/school-360/risk` sincroniza risco calculado no painel para o backend via RPC `sync_influencer_school_360_risk`.
- FK explicita reforcada: `crm_leads.onboarding_request_id` e `onboarding_requests.crm_lead_id` sincronizados e expostos no payload do portal.

### Pendencias restantes da Sprint 8

- Revisar textos dos POPs antigos que ainda citam funcionalidades como `NAO OPERACIONAL NO CODIGO ACTUAL` quando o código já evoluiu.
- Criar indicadores/ranking por operador.
- Criar indicadores agregados por escola para gestor.

## 4. Prioridade Recomendada

1. Sprint 1 - operadores, papeis e tarefas.
2. Sprint 3 - checklist de implantacao e termo de aceite.
3. Sprint 6 - suporte L1 com SLA.
4. Sprint 7 - comissoes e payout.
5. Sprint 2, Sprint 4, Sprint 5 e Sprint 8 refinam e fecham o ciclo.

## 5. MVP Operacional

Para operar com um fluxo minimo de inicio, meio e fim, implementar primeiro:

- [x] Gestao de operadores.
- [x] Lead com responsavel e proxima acao.
- [x] Conversao para onboarding.
- [x] Checklist de implantacao.
- [x] Termo de aceite.
- [x] Tickets L1 com SLA.
- [x] Triagem documental do parceiro.
- [x] Comissao de ativacao bloqueada por aceite.
- [x] Comissao recorrente visivel.

## 6. Dependencias Tecnicas Provaveis

- [x] Tabelas/RPCs para gestao de membros pelo parceiro.
- [x] Tabelas de tarefas/agenda.
- [x] Tabelas de propostas/aceites comerciais.
- [x] Tabelas/RPCs/APIs/UI para checklist de implantação e termo de aceite.
- [x] Tabelas/RPCs/APIs/UI para triagem documental do parceiro.
- [ ] Tabelas de treinamentos/evidencias.
- [x] Tabelas/RPCs/APIs/UI de tickets e SLAs.
- [x] Tabelas/RPC/API/UI de payout com fatura/recibo obrigatório.
- [ ] Extensao do ledger de comissoes para penalidades SLA.
- [x] UI de biblioteca de POPs no CRM.

### Dependencias fechadas em 2026-06-30

- Banco remoto: migration `20270630143000_partner_tasks_and_commercial_proposals.sql` aplicada.
- Tabela `partner_tasks` criada para agenda operacional do parceiro, com responsavel, lead, onboarding, vencimento, status e tipo de tarefa.
- RPC `update_influencer_crm_lead_action` agora sincroniza a proxima acao do lead com uma tarefa `follow_up` aberta em `partner_tasks`.
- Tabela `crm_commercial_proposals` criada para persistir proposta comercial, status, valores, aceite e arquivo da proposta por lead.
- RPCs `update_influencer_crm_lead_commercial_terms` e `attach_influencer_crm_lead_proposal` agora sincronizam os dados comerciais nessa tabela normalizada.
- RPC `get_influencer_crm_leads` expoe `commercial_proposal_id`, status da proposta e tarefa aberta para uso futuro em filtros/agenda.

## 7. Regras de Negocio Obrigatorias

- Trial maximo: 30 dias.
- Taxa de ativacao: 100% do parceiro.
- Comissao recorrente: 25% sobre valor liquidado.
- Inadimplencia suspende repasse.
- Ativacao so libera comissao apos termo de aceite.
- SLA L1:
  - Alta: resposta em ate 15 minutos; resolucao em ate 2 horas.
  - Media: resposta em ate 1 hora; resolucao em ate 8 horas.
  - Baixa: resposta em ate 4 horas; resolucao em ate 24 horas.
- Penalidade: descumprimento de mais de 15% dos chamados validos no mes reduz 5% da comissao recorrente da carteira afetada.
