# Roadmap de Construcao do POP - Portal Admin da Escola

Data: 2026-04-03
Base: inventario tecnico em `docs/inventario-portal-admin-escola-2026-04-03.md`
Objetivo: produzir POP completo, operacional e validado para usuario final do modulo admin.

## 1) Objetivo operacional do roadmap

Entregar um POP que permita a um usuario admin executar processos de ponta a ponta sem apoio tecnico:
- com passos claros por tela
- com pre-condicoes e criterios de sucesso
- com tratamento de erro e contingencia
- com papeis e responsabilidades explicitos

## 2) Premissas de execucao

- O POP sera guiado pela jornada funcional e nao por namespace tecnico de API.
- Cada procedimento tera dono de processo (papel), SLA e evidencias obrigatorias.
- Fluxos com idempotencia/commit serao documentados com checkpoints explicitos.
- Tudo que estiver em pagina proxy/redirect sera mapeado para o destino funcional final.

## 3) Macro-fases do roadmap

## Fase 0 - Baseline e modelo de documento (D+2)

Objetivo:
- padronizar o formato unico do POP para todo modulo admin.

Entregaveis:
- template master POP admin (`docs/pop/admin/_template-pop.md`)
- glossario operacional (`docs/pop/admin/_glossario.md`)
- matriz de papeis x permissoes (`docs/pop/admin/_rbac-operacional.md`)
- matriz de evidencias (print, csv, protocolo, auditoria)

Criterio de saida:
- template aprovado com seccoes fixas: Objetivo, Pre-condicoes, Passos, Resultado esperado, Erros comuns, Escalonamento, Evidencias, Riscos.

## Fase 1 - POP P0 (operacao diaria critica) (Semana 1)

Escopo P0:
1. Dashboard admin (leitura e interpretacao de KPIs)
2. Alunos (pesquisa, edicao, arquivar, restaurar, hard-delete controlado)
3. Turmas e curriculo (publicar curriculo, gerar turmas, tratar pendencias)

Entregaveis:
- `docs/pop/admin/p0-dashboard-admin.md`
- `docs/pop/admin/p0-alunos-admin.md`
- `docs/pop/admin/p0-turmas-curriculo.md`

Dependencias tecnicas que devem aparecer no POP:
- controles de permissao (`resolveEscolaIdForUser` + `user_has_role_in_school`)
- pontos de auditoria
- pontos sem retorno (acoes destrutivas em alunos)

Criterio de saida:
- usuario piloto executa os 3 processos sem ajuda, em ambiente de homologacao.

## Fase 2 - POP P1 (configuracao academica e setup) (Semana 2)

Escopo P1:
1. Hub de configuracoes
2. Calendario e periodos letivos
3. Avaliacao e frequencia
4. Setup state/impact/preview/commit

Entregaveis:
- `docs/pop/admin/p1-configuracoes-hub.md`
- `docs/pop/admin/p1-calendario-periodos.md`
- `docs/pop/admin/p1-avaliacao-frequencia.md`
- `docs/pop/admin/p1-setup-commit.md`

Pontos obrigatorios no POP:
- diferenca entre `preview` e `commit`
- uso de `Idempotency-Key` onde aplicavel
- rollback operacional (o que fazer quando commit falhar)

Criterio de saida:
- runbook de setup executado do inicio ao fim para 1 escola teste.

## Fase 3 - POP P2 (financeiro administrativo) (Semana 3)

Escopo P2:
1. Configuracoes financeiras da escola
2. Mensalidades e emolumentos (servicos)
3. Dependencias com financeiro (impacto em cobranca)

Entregaveis:
- `docs/pop/admin/p2-configuracoes-financeiras.md`
- `docs/pop/admin/p2-mensalidades-emolumentos.md`

Pontos obrigatorios no POP:
- quais campos impactam cobranca futura
- validacoes minimas antes de salvar
- como verificar consistencia apos alteracao

Criterio de saida:
- simulacao com alteracao de parametros + verificacao de impacto aprovada.

## Fase 4 - POP P3 (fechamento, documentos, auditoria) (Semana 4)

Escopo P3:
1. Fechamento de periodo (frequencias/notas)
2. Geracao de pauta oficial
3. Avisos e eventos
4. Relatorios e auditoria admin

Entregaveis:
- `docs/pop/admin/p3-fechamento-periodo.md`
- `docs/pop/admin/p3-documentos-oficiais.md`
- `docs/pop/admin/p3-avisos-eventos.md`
- `docs/pop/admin/p3-relatorios-auditoria.md`

Pontos obrigatorios no POP:
- pre-condicoes de fechamento
- como confirmar sucesso de geracao de PDF oficial
- trilha de auditoria para conformidade

Criterio de saida:
- equipe de operacao conclui fechamento completo sem suporte de engenharia.

## Fase 5 - Validacao assistida e homologacao final (Semana 5)

Atividades:
- walkthrough com usuarios reais (admin escolar)
- coleta de gaps de linguagem/processo
- ajuste de screenshots e de termos locais

Entregaveis:
- pacote final POP v1 (`docs/pop/admin/index.md`)
- changelog POP v1
- checklist de treinamento

Criterio de saida:
- taxa de sucesso >= 90% nos testes guiados por POP
- sem bloqueio critico em processo P0/P1

## Fase 6 - Governanca continua (pos-go-live)

Atividades recorrentes:
- revisao mensal de aderencia do POP com codigo
- revisao a cada release que altere fluxo admin
- controle de versao do POP por modulo

Entregaveis:
- `docs/pop/admin/CHANGELOG.md`
- `docs/pop/admin/controle-revisoes.md`

SLA de manutencao:
- alteracao critica de fluxo: atualizar POP em ate 48h
- alteracao nao critica: atualizar em ate 5 dias uteis

## 4) Ordem de execucao recomendada (curva de risco)

Ordem:
1. Alunos
2. Turmas/Curriculo
3. Setup/Configuracoes
4. Fechamento
5. Financeiro admin
6. Avisos/Eventos/Relatorios

Racional:
- prioriza maior volume de uso e maior risco operacional primeiro.

## 5) Estrutura padrao de cada POP

Cada arquivo POP deve conter:
1. Objetivo
2. Perfil responsavel
3. Pre-condicoes
4. Passo a passo numerado
5. Resultado esperado
6. Erros comuns e acao corretiva
7. Quando escalar e para quem
8. Evidencias obrigatorias
9. KPIs operacionais do processo

## 6) Riscos de execucao do roadmap e mitigacoes

Risco: divergencia entre fluxo de tela e endpoint real compartilhado com secretaria.
Mitigacao: sempre validar o passo com comportamento em runtime e nao apenas com URL.

Risco: mudancas frequentes em telas grandes (alunos, turmas, configuracoes/turmas).
Mitigacao: congelar baseline por versao e manter revisao quinzenal nesses 3 arquivos.

Risco: linguagem tecnica demais para usuario final.
Mitigacao: revisao editorial com operador escolar antes da versao final.

## 7) Definicao de pronto (DoD) do POP admin v1

POP admin v1 so e considerado pronto quando:
- 100% dos fluxos P0/P1/P2/P3 documentados
- todos os POPs possuem evidencias e checklist de erro
- validacao com usuarios reais concluida
- indice unico publicado em `docs/pop/admin/index.md`

