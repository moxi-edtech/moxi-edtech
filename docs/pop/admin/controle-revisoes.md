# Controle de Revisoes - POP Admin da Escola

Versao: 1.0.0
Data base: 2026-04-03
Escopo: revisao continua do pacote POP em sincronia com codigo

## 1) Politica de revisao

- Revisao ordinaria: quinzenal.
- Revisao extraordinaria: em ate 48h para mudanca critica de fluxo.
- Revisao nao critica: em ate 5 dias uteis.
- Toda revisao deve atualizar `CHANGELOG.md`.

## 2) Calendario inicial (2026)

| Ciclo | Janela alvo | Responsavel primario | Status |
|---|---|---|---|
| R01 | 2026-04-17 | Owner POP Admin | Planejado |
| R02 | 2026-05-01 | Owner POP Admin | Planejado |
| R03 | 2026-05-15 | Owner POP Admin | Planejado |
| R04 | 2026-05-29 | Owner POP Admin | Planejado |

## 3) Gatilhos obrigatorios de revisao extraordinaria

- Mudanca em rotas de `Admin` na sidebar.
- Mudanca em endpoint consumido por algum SOP.
- Mudanca de permissao/papel para operacoes do Admin.
- Mudanca de fluxo de fechamento/documentos/migracao.
- Mudanca de texto de acao critica em tela (ex.: botoes de confirmar/fechar/gerar).

## 4) Checklist de revisao por SOP

1. Confirmar rota de entrada.
2. Confirmar passos de UI e labels principais.
3. Confirmar endpoint(s) usados no fluxo.
4. Confirmar pre-condicoes e bloqueios.
5. Confirmar mensagens de sucesso/erro.
6. Confirmar evidencias exigidas.
7. Atualizar versao/data do SOP se houve alteracao.
8. Registrar no `CHANGELOG.md`.

## 5) Registro de execucao das revisoes

| Data revisao | Revisor | Escopo | Resultado | Acoes |
|---|---|---|---|---|
| 2026-04-03 | Codex | Baseline v1.4.0 | Concluido | Publicacao inicial de governanca |

## 6) Convenio de versionamento do pacote

- Alteracao apenas editorial: patch (`1.x.y`).
- Alteracao de passos operacionais sem novo SOP: minor (`1.y.0`).
- Reestruturacao de pacote ou mudanca ampla de ordem/escopo: major (`x.0.0`).
