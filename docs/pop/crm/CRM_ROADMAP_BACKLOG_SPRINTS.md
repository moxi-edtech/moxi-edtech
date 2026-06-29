# CRM KLASSE - Roadmap, Checklist e Backlog por Sprint

Versao: 1.1.0
Data: 2026-06-29
Atualizado em: 2026-06-29
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
- [ ] Proposta comercial.
- [ ] Aceite comercial.
- [x] Proxima acao comercial com data.
- [x] Painel de pendencias comerciais vencidas.

### Onboarding

- [x] Conversao do lead para escola em ativacao.
- [ ] Checklist de implantacao.
- [x] Uploads/documentos.
- [ ] Setup de dados.
- [x] Status por fase.
- [ ] Termo de aceite assinado.

### Operacao

- [ ] Formacao da secretaria.
- [ ] Formacao dos docentes.
- [ ] Evidencias de treinamento.
- [ ] Ativacao/go-live.

### Suporte L1

- [ ] Abertura de chamados.
- [ ] Gravidade.
- [ ] SLA.
- [ ] Escalonamento L2/L3 para KLASSE.
- [ ] Relatorio de performance.

### Financeiro e Comissoes

- [x] Comissao de ativacao.
- [x] Comissao recorrente.
- [ ] Bloqueio por inadimplencia.
- [ ] Penalidade por SLA.
- [ ] Solicitacao de payout.
- [ ] Upload de fatura/recibo.
- [x] Status de repasse.

### Gestao Interna

- [x] Operadores do parceiro.
- [x] Papeis/permissoes.
- [x] Reset de PIN.
- [ ] Produtividade por operador.

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

### Pendencias restantes da Sprint 1

- Validar login real de um operador recem-criado em ambiente remoto.
- Criar metrica de produtividade por operador.

## Sprint 2 - Proposta, Fechamento e Conversao

### Meta

Fechar o ciclo comercial antes do onboarding.

### Backlog

- [x] Criar bloco de proposta comercial no lead.
- [x] Campos: plano, alunos, trial, taxa de ativacao, mensalidade.
- [ ] Gerar proposta/preview.
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

### Implementado em 2026-06-29

- Drawer do lead comercial no portal do parceiro com bloco `Proposta Comercial`.
- Campos ativos no lead: `plano_estimado`, `alunos_estimados`, `trial_days`, `taxa_ativacao`, `mensalidade_kz`.
- Status comercial ativos no banco e na UI: `rascunho`, `proposta_enviada`, `aceite_comercial`, `aguardando_contrato_klasse`.
- Upload de proposta/contrato preliminar via endpoint `/api/influencers/[codigo]/crm/leads/[leadId]/proposal`.
- Edicao dos termos comerciais via endpoint `/api/influencers/[codigo]/crm/leads/[leadId]/commercial`.
- Conversao para onboarding agora bloqueia sem etapa `ganho`, sem `trial_days` valido, sem `taxa_ativacao > 0` e sem status comercial pronto para conversao.
- Dados comerciais enviados para o onboarding incluem `trial_days`, `taxa_ativacao`, `mensalidade_kz`, `commercial_status` e `proposal_file_name`.

### Pendencias restantes da Sprint 2

- Gerar proposta/preview automatico a partir dos termos comerciais.
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
- RPC: `update_influencer_onboarding_implantation_checklist` normaliza os 8 itens obrigatorios, audita a alteracao e move a escola para `aguardando_aceite` quando o checklist fica completo.
- RPC: `validate_onboarding_implantation_acceptance` exige checklist completo, termo anexado, nome do diretor/signatario e data de assinatura antes de marcar `aceite_validado`.
- Gate financeiro: trigger `trg_activation_commission_acceptance_gate` impede aprovar ou pagar comissao de ativacao sem `aceite_validado` e termo assinado.

### Pendencias restantes da Sprint 3

- Expor na UI do portal do parceiro os checkboxes e notas do checklist de implantacao ja suportados pelo backend.
- Criar tela/acao operacional para upload dedicado do Termo de Aceite e chamada da RPC de validacao pela KLASSE.

## Sprint 4 - Setup de Dados e Documentos

### Meta

Dar ao parceiro controle real sobre recolha e preparacao dos dados.

### Backlog

- [ ] Criar fila de documentos por escola.
- [ ] Classificar uploads: legais, planilhas, contrato, logotipo, pautas.
- [ ] Permitir triagem do parceiro com status `pendente`.
- [ ] Permitir triagem do parceiro com status `em_revisao_parceiro`.
- [ ] Permitir triagem do parceiro com status `pendencia_cliente`.
- [ ] Permitir triagem do parceiro com status `pronto_para_klasse`.
- [ ] Manter aprovacao final KLASSE onde necessario.
- [ ] Adicionar comentarios por arquivo.
- [ ] Linkar modelos de planilhas.
- [ ] Criar checklist de recolha baseado no documento HTML.

### Entrega

- Parceiro acompanha e cobra documentos sem depender de WhatsApp solto.
- KLASSE recebe apenas material pronto para revisao/importacao.

### Criterios de Aceite

- [ ] Operador marca arquivo como pendente ou pronto para KLASSE.
- [ ] Escola/parceiro conseguem ver motivo da pendencia.
- [ ] Super Admin mantem aprovacao final.

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

- [ ] Criar tickets de suporte.
- [ ] Campo: escola.
- [ ] Campo: canal.
- [ ] Campo: categoria.
- [ ] Campo: gravidade.
- [ ] Campo: responsavel.
- [ ] Campo: SLA de resposta.
- [ ] Campo: SLA de resolucao.
- [ ] Gravidade Alta: FRT 15 min, resolucao 2h.
- [ ] Gravidade Media: FRT 1h, resolucao 8h.
- [ ] Gravidade Baixa: FRT 4h, resolucao 24h.
- [ ] Relogio de SLA.
- [ ] Status: `aberto`, `em_atendimento`, `aguardando_cliente`, `escalado_klasse`, `resolvido`.
- [ ] Escalonamento L2/L3 para KLASSE.
- [ ] Anexos e prints.

### Entrega

- Suporte deixa de ser informal.
- SLA vira metrica contratual.

### Criterios de Aceite

- [ ] Ticket calcula vencimento automaticamente.
- [ ] SLA atrasado fica visivel.
- [ ] Escalonamento gera historico.
- [ ] Relatorio mensal mostra cumprimento.

## Sprint 7 - Comissoes, Penalidades e Payout

### Meta

Fechar o financeiro do parceiro de ponta a ponta.

### Backlog

- [ ] Comissao de ativacao gerada apos aceite validado.
- [ ] Comissao de ativacao corresponde a 100% da taxa.
- [ ] Comissao recorrente corresponde a 25% do valor pago pela escola.
- [ ] Comissao recorrente fica suspensa por inadimplencia.
- [ ] Penalidade SLA: se mais de 15% dos chamados validos ficarem fora do SLA, reduzir 5% da comissao recorrente da carteira afetada.
- [ ] Solicitacao de payout.
- [ ] Upload de fatura/recibo.
- [ ] Status: `disponivel`, `solicitado`, `aprovado`, `pago`, `rejeitado`.
- [ ] Extrato mensal.
- [ ] Export CSV/PDF.

### Entrega

- Parceiro sabe quanto tem a receber e por que.
- KLASSE tem evidencia para pagar, bloquear ou aplicar penalidade.

### Criterios de Aceite

- [ ] Payout nao abre sem fatura/recibo.
- [ ] Comissao recorrente nao aprova se escola nao pagou.
- [ ] Penalidade aparece discriminada.
- [ ] Pagamento muda comissao para `paid`.

## Sprint 8 - Biblioteca Operacional e Painel de Carteira

### Meta

Consolidar a operacao diaria numa tela unica.

### Backlog

- [ ] Criar biblioteca de POPs dentro do CRM.
- [ ] Organizar POPs por fase: comercial.
- [ ] Organizar POPs por fase: onboarding.
- [ ] Organizar POPs por fase: setup.
- [ ] Organizar POPs por fase: treinamento.
- [ ] Organizar POPs por fase: suporte.
- [ ] Organizar POPs por fase: financeiro.
- [ ] Criar painel 360 da escola.
- [ ] Painel 360 mostra lead.
- [ ] Painel 360 mostra contrato.
- [ ] Painel 360 mostra onboarding.
- [ ] Painel 360 mostra checklist.
- [ ] Painel 360 mostra treinamentos.
- [ ] Painel 360 mostra tickets.
- [ ] Painel 360 mostra SLA.
- [ ] Painel 360 mostra comissoes.
- [ ] Painel 360 mostra risco.
- [ ] Criar indicadores por operador.
- [ ] Criar indicadores por escola.
- [ ] Criar alertas de risco.

### Entrega

- Operador tem uma tela unica para trabalhar a carteira.
- Gestor ve gargalos e produtividade.

### Criterios de Aceite

- [ ] Cada escola tem timeline completa.
- [ ] POPs aparecem no contexto da fase.
- [ ] Dashboard mostra pendencias criticas.

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
- [ ] Checklist de implantacao.
- [ ] Termo de aceite.
- [ ] Tickets L1 com SLA.
- [ ] Comissao de ativacao bloqueada por aceite.
- [x] Comissao recorrente visivel.

## 6. Dependencias Tecnicas Provaveis

- [x] Tabelas/RPCs para gestao de membros pelo parceiro.
- [ ] Tabelas de tarefas/agenda.
- [ ] Tabelas de propostas/aceites comerciais.
- [ ] Tabelas de checklist de implantacao.
- [ ] Tabelas de treinamentos/evidencias.
- [ ] Tabelas de tickets e SLAs.
- [ ] Tabelas de payout e anexos financeiros.
- [ ] Extensao do ledger de comissoes para penalidades SLA.
- [ ] UI de biblioteca de POPs no CRM.

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
