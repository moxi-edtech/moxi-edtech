# POP/SOP - Portal do Parceiro Comercial (CRM & Onboarding)

Versao: 1.3.1
Data base: 2026-07-01
Escopo: Equipe operacional e comercial do parceiro (CLARUS AN)

## Objetivo deste pacote

Este pacote documenta os Procedimentos Operacionais Padrao (POP/SOP) para que o Parceiro Comercial utilize o portal `/influencers/[codigo]` de forma segura, eficiente e padronizada. Ele cobre desde o primeiro contato comercial até o monitoramento de comissões e gestão de operadores locais.

## Estado de fidelidade ao codigo

Validado contra `apps/web/src/app/influencers/[codigo]/page.tsx`, `apps/web/src/app/api/influencers/[codigo]` e fluxo de onboarding em 2026-07-01.

- O portal do parceiro permite CRM de leads, proposta comercial, aceite comercial, upload de documento preliminar, conversao para pedido de onboarding, follow-up comercial, visualizacao de uploads, download de arquivos, triagem preliminar documental, leitura de comissoes, simulador de ganhos e solicitação de payout.
- O portal do parceiro possui gestao de equipe com criacao, ativacao/desativacao e reset de PIN em `/api/influencers/[codigo]/team`.
- O portal do parceiro nao possui aprovacao/rejeicao final de uploads nem provisionamento de escola.
- A aprovacao/rejeicao final de uploads existe no Super Admin.
- O parceiro consegue triar uploads (`em_revisao_parceiro`, `pendencia_cliente`, `pronto_para_klasse`), mas isso nao conclui etapa.
- O parceiro pode solicitar payout com fatura/recibo em `/api/influencers/[codigo]/commissions/payouts`; o Super Admin aprova, rejeita, cancela ou marca como pago.
- Quando um botao, rota ou endpoint nao existir no codigo, o POP deve marcar como `NAO OPERACIONAL NO CODIGO ACTUAL` ou mover a responsabilidade para Super Admin.

## Documentos deste pacote

### 1. Prospecção e CRM Pré-Vendas
- [`sop-crm-01-cadastro-leads.md`](sop-crm-01-cadastro-leads.md) - Cadastro e Qualificação de Leads (Escolas) no CRM Comercial.

### 2. Conversão e Moderação de Onboarding
- [`sop-crm-02-conversao-onboarding.md`](sop-crm-02-conversao-onboarding.md) - Conversão de Lead Ganho em Pedido de Onboarding.
- [`sop-crm-03-moderacao-documental.md`](sop-crm-03-moderacao-documental.md) - Triagem e Acompanhamento de Documentos de Onboarding no CRM.

### 3. Gestão Financeira e Equipe
- [`sop-crm-04-gestao-comissoes.md`](sop-crm-04-gestao-comissoes.md) - Gestão de Comissões, Acompanhamento do Ledger e Solicitação de Payout.
- [`sop-crm-05-administracao-membros.md`](sop-crm-05-administracao-membros.md) - Gestão de Operadores Internos (Membros) e PINs de Acesso.

### 4. Guias de Implantação e Suporte L1 (Admin da Escola)
- [`p0-turmas-curriculo.md`](guias-admin/p0-turmas-curriculo.md) - Setup curricular: turmas, disciplinas, estrutura MED.
- [`p0-alunos-admin.md`](guias-admin/p0-alunos-admin.md) - Cadastro/importação e gestão de alunos.
- [`p0-avaliacao-quadro-horario.md`](guias-admin/p0-avaliacao-quadro-horario.md) - Parametrização de avaliações, frequência e horários.
- [`p1-setup-configuracoes.md`](guias-admin/p1-setup-configuracoes.md) - Checklist geral de configuração inicial.
- [`p1-professores-atribuicoes.md`](guias-admin/p1-professores-atribuicoes.md) - Formação e suporte ao corpo docente.
- [`p1-fechamento-periodo-pauta-oficial.md`](guias-admin/p1-fechamento-periodo-pauta-oficial.md) - Suporte L1 em pautas e fechamento.
- [`p2-configuracoes-financeiras.md`](guias-admin/p2-configuracoes-financeiras.md) e [`p2-mensalidades-emolumentos.md`](guias-admin/p2-mensalidades-emolumentos.md) - Configurações financeiras e mensalidades.
- [`p3-documentos-oficiais-lote.md`](guias-admin/p3-documentos-oficiais-lote.md) - Suporte a documentos MED.
- [`p3-operacoes-academicas-monitor.md`](guias-admin/p3-operacoes-academicas-monitor.md) - Monitoramento de jobs e incidentes.

---

## Matriz de Papéis x Processos

| Processo | afiliado_admin (Emanuel) | afiliado_membro (Operadores) |
|---|---|---|
| Cadastrar e gerir leads no CRM | E | E |
| Converter lead ganho em Onboarding | E | E |
| Visualizar documentos de onboarding | E | E |
| Aprovar/rejeitar documentos de onboarding | NA | NA |
| Visualizar comissões e financeiro | E | V |
| Solicitar payout / emitir recibo | E | NA |
| Cadastrar novos membros / resetar PINs | E | NA |

*Legenda: `E` = Executa diretamente; `V` = Visualiza/Acompanha; `NA` = Não Aplicável.*

---

## SLA e Regras de Negócio Importantes

1. **Período de Degustação (Trial):** O limite máximo negociável pelo parceiro com cada escola é de **30 dias**. O valor padrão do sistema é de 15 dias, mas o operador pode ajustar conforme a negociação.
2. **Taxa de Ativação/Instalação:** 100% repassada ao parceiro. O valor de tabela é de **50.000 Kz a 100.000 Kz**, variando conforme a dimensão e complexidade de infraestrutura do colégio.
3. **Documentos de Onboarding:** O parceiro acompanha uploads, baixa arquivos, faz triagem preliminar e cobra pendencias da escola. A decisao formal de aprovar/rejeitar documentos continua no Super Admin.
4. **Workflow Real:** Upload de planilhas move a etapa para `em_progresso`; triagem do parceiro encaminha; provisionamento e go-live seguem o fluxo actual de 6 etapas (`diagnostico`, `planilhas`, `validacao`, `config`, `treinamento`, `live`).
