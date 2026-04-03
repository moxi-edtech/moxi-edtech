# POP-P0-01 - Operar Dashboard Admin

Versao: 1.0.0
Data: 2026-04-03
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
5. Se existir alerta de `Horarios incompletos`, abrir `Ajustar curriculo` e encaminhar para responsavel academico.
6. Se existir alerta de `Avaliacao incompleta`, abrir `Configurar avaliacao` e encaminhar correcao.
7. Se existir alerta de `Tabelas de preco pendentes`, abrir `Configurar precos` e alinhar com financeiro.
8. Ler os KPIs gerais (alunos, turmas, professores, avaliacoes e blocos financeiros disponiveis).
9. No bloco `Previsao de receita`, verificar:
- valor realizado
- valor previsto
- percentual do periodo actual
10. Ler `Entradas de Hoje`:
- confirmar novos pagamentos
- observar metodo de pagamento e status
11. Ler `Atencao Prioritaria`:
- identificar alunos com atraso
- priorizar os casos com maior valor e maior dias em atraso
12. Verificar `Quick Actions`, `Notices` e `Operational Feed`.
13. Registrar o resumo operacional do turno com 3 itens:
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

- Ultima revisao: 2026-04-03
- Proxima revisao: 2026-04-17
- Mudancas desta versao: versao inicial P0 para dashboard admin.

