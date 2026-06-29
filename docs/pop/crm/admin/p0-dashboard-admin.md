# POP-P0-01 - Operar Dashboard Admin

Versao: 1.1.0
Data: 2026-06-28
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 8-12 minutos

## 1. Objetivo

Permitir que o Admin da Escola abra o Dashboard, interprete os indicadores principais, identifique alertas criticos e encaminhe acoes operacionais no mesmo turno.

## 2. Quando usar

- Inicio do turno do admin.
- Antes de reuniao operacional diaria.
- Antes de executar processos de alunos, turmas, curriculo ou financeiro.

## 3. Responsaveis

- Executor: Admin da Escola
- Aprovador interno: Coordenacao administrativa (quando houver acao de impacto)
- Escalonamento: Suporte interno/gestao da plataforma

## 4. Pre-condicoes

- Usuario autenticado no portal da escola.
- Acesso ao modulo `Admin`.
- Escola selecionada corretamente.

## 4.1 Estado fiel ao codigo

- A rota `/escola/{id}/admin` e o alias `/escola/{id}/admin/dashboard` renderizam `EscolaAdminDashboard`.
- O conteudo real vem de `apps/web/src/components/layout/escola-admin/EscolaAdminDashboardContent.tsx`.
- O `Radar Operacional` cria alertas apenas para:
  - turmas pendentes de validacao
  - tabelas de preco pendentes
- Pendencias de avaliacao, curriculo e turmas tambem aparecem no `PostWizardChecklist`, nao necessariamente como alertas do radar.

## 5. Passo a passo (execucao)

1. Na barra lateral, entrar em `Dashboard` do modulo Admin.
2. Validar no topo da pagina:
- titulo `Dashboard`
- saudacao (`Bom dia`/`Boa tarde`/`Boa noite`)
- nome da escola
- selo `Live`
- selo `Ano Letivo ...` (quando disponivel)
3. Ler o bloco `Radar Operacional`.
4. Se existir alerta de `turma(s) pendente(s) de validacao`, abrir `Ver turmas` e criar tarefa de tratativa no mesmo dia.
5. Se existir alerta de `Tabelas de preço pendentes`, abrir `Configurar preços` e alinhar com financeiro.
6. Ler os KPIs gerais (alunos, turmas, professores, avaliacoes e blocos financeiros disponiveis).
7. No bloco `Recebido no Mês (Caixa)`, verificar:
- valor realizado
- valor previsto quando existir meta
- percentual `Realizado Total`
- indicador de cobrança da competência
8. Ler `Fluxo de Caixa`:
- confirmar novos pagamentos
- observar metodo de pagamento e status
9. Ler `Radar Financeiro`:
- identificar alunos com atraso
- priorizar os casos com maior valor e maior dias em atraso
10. Verificar `Quick Actions`, `Notices`, `PostWizardChecklist` e `Operational Feed`.
11. Registrar o resumo operacional do turno com 3 itens:
- risco academico
- risco financeiro
- acao imediata definida

## 6. Resultado esperado

- Dashboard validado sem erros de carregamento.
- Alertas criticos mapeados e encaminhados.
- Prioridades do turno definidas e registadas.

## 7. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| KPIs zerados inesperadamente | Falha de dados ou contexto de escola incorreto | Atualizar pagina e confirmar escola ativa | Se persistir por mais de 15 min |
| Blocos financeiros vazios | Sem movimento no periodo ou falha de carga | Confirmar periodo e tentar novamente | Se houver movimento conhecido sem exibicao |
| Alerta recorrente sem resolucao | Acao nao foi executada no modulo destino | Abrir link do alerta e executar tratativa | Se nao houver permissao para concluir |
| Dashboard nao abre | Sessao expirada ou permissao insuficiente | Reautenticar e verificar perfil | Se continuar apos novo login |

## 8. Evidencias obrigatorias

- Print do Dashboard do inicio do turno.
- Lista de alertas encontrados (ou registo de sem alertas).
- Registo das 3 prioridades operacionais do dia.

## 9. KPI operacional do procedimento

- SLA de leitura inicial do dashboard: ate 12 min.
- Taxa de alerta critico sem encaminhamento no turno: 0%.
- Taxa de incidentes por falha de leitura de dashboard: < 2%.

## 10. Riscos e controles

- Risco: ignorar alerta critico de turma/curriculo.
- Controle: obrigar registo de tratativa no mesmo turno.

- Risco: focar apenas no financeiro e perder risco academico.
- Controle: checklist obrigatoria com 3 categorias (academico, financeiro, operacao).

## 11. Revisao e versao

- Ultima revisao: 2026-06-28
- Proxima revisao: 2026-07-12
- Mudancas desta versao: alinhado aos blocos e alertas reais do `EscolaAdminDashboardContent`.
