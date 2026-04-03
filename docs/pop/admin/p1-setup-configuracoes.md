# POP-P1-01 - Setup e Configuracoes do Sistema (Admin)

Versao: 1.0.0
Data: 2026-04-03
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 30-60 minutos

## 1. Objetivo

Garantir que o setup academico e as configuracoes estruturantes da escola sejam concluídos e publicados corretamente antes da operacao plena.

## 2. Quando usar

- Implantacao inicial da escola.
- Reconfiguracao de ano letivo.
- Ajuste de calendario, avaliacao, turmas e regras de operacao.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel: Secretaria/Coordenacao
- Escalonamento: Suporte tecnico

## 4. Pre-condicoes

- Acesso a `Admin > Configuracoes`.
- Escola correta selecionada.
- Janela de alteracao autorizada (fora de horario critico, quando possivel).

## 5. Procedimento A - Abertura do hub de configuracoes

1. Entrar em `Configurações`.
2. Verificar o estado geral:
- percentual de progresso
- bloco `Ação necessária` (quando existir)
- checklist de pendencias (`Ver o que falta`)
3. Se o setup estiver incompleto, usar `Iniciar Assistente` para concluir lacunas principais.

## 6. Procedimento B - Navegacao por modulos de configuracao

1. No menu interno, revisar em ordem:
- `Calendário Acadêmico`
- `Avaliação & Notas`
- `Turmas & Currículo`
- `Financeiro`
- `Fluxos de Aprovação`
- `Avançado`
2. Em cada modulo, confirmar se o estado visual indica `configurado/revisado`.

## 7. Procedimento C - Calendario academico e periodos

1. Abrir `Calendário Acadêmico`.
2. Confirmar `Ano Letivo Ativo` correto.
3. Para cada periodo:
- validar datas de inicio/fim
- validar `Peso na Nota Final`
- definir `Travar Notas Em` quando aplicavel
4. Validar `Total: 100%` nos pesos.
5. Clicar `Salvar Alterações`.
6. Confirmar mensagem de sucesso.

## 8. Procedimento D - Estado do sistema e proximas acoes

1. Abrir `Configurações > Sistema` (quando disponivel no fluxo interno).
2. Revisar:
- percentual concluido
- `Sugestão do Sistema` (proximo passo)
- `Atenção Necessária` (blockers)
3. Tratar primeiro os blockers criticos.
4. Acessar cada modulo pendente pelo botao `Configurar/Continuar Configuração`.

## 9. Procedimento E - Publicacao final das alteracoes

1. Ao terminar os ajustes, executar acao de salvar/publicar no shell do modulo.
2. Quando houver fluxo de validacao previa, seguir ordem:
- revisar estado atual
- revisar impacto
- confirmar publicacao
3. Validar retorno de sucesso e persistencia dos dados apos refresh da pagina.

## 10. Resultado esperado

- Setup sem pendencias bloqueantes.
- Periodos e pesos validos.
- Regras essenciais publicadas e ativas.
- Hub com progresso concluido ou em nivel aceitavel acordado.

## 11. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| Progresso nao avanca | Item obrigatorio nao concluido | Abrir checklist e corrigir item pendente | Item marcado como concluido mas sem efeito |
| Peso total diferente de 100% | Soma incorreta por periodo | Ajustar pesos e salvar novamente | Persistir erro apos ajuste |
| Falha ao salvar calendario | Dados invalidos ou conflito de validacao | Revisar campos de periodo e repetir | Erro tecnico recorrente |
| Blocker critico recorrente | Dependencia nao resolvida em modulo anterior | Tratar modulo raiz antes de continuar | Blocker permanece sem causa clara |

## 12. Evidencias obrigatorias

- Print do percentual final de setup.
- Print da configuracao de periodos com total valido.
- Registo das alteracoes publicadas (data/hora e operador).

## 13. KPI operacional

- Tempo de setup inicial completo: ate 60 min.
- Taxa de setup aprovado sem retrabalho: >= 85%.
- Ocorrencia de blockers no go-live: 0 blockers criticos.

## 14. Riscos e controles

- Risco: publicar configuracoes incompletas.
- Controle: checklist obrigatoria com validacao final.

- Risco: alterar regras academicas em momento inadequado.
- Controle: executar em janela operacional definida.

## 15. Revisao e versao

- Ultima revisao: 2026-04-03
- Proxima revisao: 2026-04-17
- Mudancas desta versao: versao inicial P1 de setup e configuracoes.

