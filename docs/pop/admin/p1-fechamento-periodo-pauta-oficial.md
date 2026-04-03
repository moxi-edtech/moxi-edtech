# POP-P1-02 - Fechamento de Periodo e Emissao de Pauta Oficial

Versao: 1.0.0
Data: 2026-04-03
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 15-30 minutos por turma/periodo

## 1. Objetivo

Padronizar o fechamento de periodo da turma e a emissao de documentos oficiais (pauta geral e pauta anual) com seguranca operacional.

## 2. Quando usar

- Encerramento de trimestre/periodo letivo.
- Consolidacao de resultados para emissao oficial.
- Auditoria academica de fim de periodo.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel: Secretaria
- Aprovador interno: Coordenacao pedagogica (antes de fechar)
- Escalonamento: Suporte tecnico

## 4. Pre-condicoes

- Acesso a `Admin > Turmas` e detalhe da turma.
- Turma correta selecionada.
- Periodo letivo configurado.
- Lancamentos de notas/frequencias previamente revisados.

## 5. Procedimento A - Abrir detalhe da turma e validar estado

1. Entrar em `Admin > Turmas`.
2. Abrir a turma alvo (`detalhe da turma`).
3. Validar no topo:
- status da turma (`Turma aberta` ou `Turma fechada`)
- ano letivo e classe corretos
4. Se a turma estiver `fechada` e for necessario ajustar dados, usar `Reabrir turma` com aprovacao interna.

## 6. Procedimento B - Fechar periodo de frequencia/notas

1. No separador `Pedagógico`, localizar bloco `Fechamento de Frequência`.
2. Selecionar o periodo no campo `Selecione o período`.
3. Confirmar se o estado atual aparece como `Aberto`.
4. Clicar `Fechar período`.
5. No modal de confirmacao, validar mensagem de irreversibilidade e confirmar.
6. Aguardar retorno `Período fechado com sucesso`.
7. Confirmar badge de estado `Fechado` no bloco.

Regra:
- Nao fechar periodo sem aprovacao interna do fechamento pedagogico.

## 7. Procedimento C - Fechar/reabrir turma (controle macro)

1. No topo da pagina da turma, usar botao:
- `Fechar turma` (quando aberta)
- `Reabrir turma` (quando fechada)
2. Confirmar no modal.
3. Validar mensagem de sucesso (`Turma fechada` ou `Turma reaberta`).
4. Confirmar atualizacao do selo visual no topo.

## 8. Procedimento D - Emitir pauta oficial

1. Ir para separador `Documentos`.
2. Confirmar que o periodo correto foi selecionado no contexto da turma.
3. Para pauta oficial trimestral:
- usar `Pauta Geral Oficial`
- so disponivel quando periodo estiver fechado
4. Aguardar processamento quando necessario (`A processar...`).
5. Fazer download quando disponivel.
6. Para documento anual oficial:
- usar `Pauta Anual Oficial`
- validar download do PDF final

## 9. Procedimento E - Validacao pos-fechamento

1. Confirmar que o periodo permanece `Fechado` apos atualizar a pagina.
2. Confirmar que o ficheiro oficial foi gerado e descarregado sem erro.
3. Registar no controle interno:
- turma
- periodo
- operador
- timestamp
- documento gerado

## 10. Resultado esperado

- Periodo fechado com sucesso e sem pendencia tecnica.
- Turma no estado operacional esperado (aberta/fechada conforme decisao).
- Pauta oficial gerada e armazenada para auditoria.

## 11. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| `Fechar período` indisponivel | Periodo nao selecionado ou ja fechado | Selecionar periodo valido e confirmar estado | Botao indisponivel com periodo aberto |
| Falha ao fechar periodo | Dados pendentes ou erro de processamento | Rever pendencias e tentar novamente | Repetir falha apos revisao |
| `Pauta Geral Oficial` bloqueada | Periodo ainda aberto | Fechar periodo primeiro | Mesmo fechado continuar bloqueado |
| Documento em `A processar...` por muito tempo | Fila/worker pendente | Aguardar janela padrao e tentar novamente | Ultrapassar SLA interno definido |
| Erro no download da pauta | Problema de rede/geracao | Repetir download | Persistir erro em varias tentativas |

## 12. Evidencias obrigatorias

- Print do estado `Fechado` do periodo.
- Print do estado final da turma (`aberta/fechada`).
- Nome do arquivo oficial gerado (pauta geral/anual) e timestamp.
- Registo do operador responsavel.

## 13. KPI operacional

- Tempo medio de fechamento por turma/periodo: ate 30 min.
- Taxa de fechamento sem retrabalho: >= 90%.
- Taxa de emissao oficial sem erro: >= 95%.

## 14. Riscos e controles

- Risco: fechar periodo com dados incompletos.
- Controle: validacao previa pedagogica obrigatoria.

- Risco: emitir documento oficial antes do fechamento.
- Controle: politica de emissao somente com periodo fechado.

- Risco: reabrir turma sem rastreabilidade.
- Controle: registrar justificativa interna de reabertura.

## 15. Revisao e versao

- Ultima revisao: 2026-04-03
- Proxima revisao: 2026-04-17
- Mudancas desta versao: versao inicial P1 de fechamento e pauta oficial.

