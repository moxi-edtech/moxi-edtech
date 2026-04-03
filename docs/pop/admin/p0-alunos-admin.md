# POP-P0-02 - Gestao de Alunos (Admin)

Versao: 1.0.0
Data: 2026-04-03
Modulo: Admin da Escola
Perfil principal: admin_escola
Tempo medio alvo: 15-30 minutos (variavel por volume)

## 1. Objetivo

Padronizar a operacao de consulta, filtro, cadastro rapido, pagamento rapido, arquivamento, restauracao e exportacao de alunos no portal Admin.

## 2. Quando usar

- Atendimento diario de demandas de secretaria/admin.
- Limpeza de base de alunos activos/arquivados.
- Preparacao de relatorios operacionais em Excel/PDF.

## 3. Responsaveis

- Executor: Admin da Escola
- Aprovador interno para acao destrutiva: Coordenacao administrativa
- Escalonamento: Suporte tecnico e gestao escolar

## 4. Pre-condicoes

- Usuario autenticado no modulo `Admin`.
- Acesso a pagina `Gestao de Alunos`.
- Permissao para operacoes de alunos no contexto da escola ativa.

## 5. Procedimento A - Consulta, pesquisa e filtros

1. No menu lateral, aceder `Alunos`.
2. Confirmar cabecalho `Gestao de Alunos`.
3. Usar a caixa `Pesquisar por nome, numero de login ou ID...`.
4. Clicar `Pesquisar`.
5. Abrir `Filtros` e, se necessario, aplicar:
- `Situacao financeira`
- `Turma`
- `Estado de matricula`
6. Clicar `Aplicar`.
7. Validar o contador de filtros activos junto ao titulo e no botao `Filtros`.
8. Para remover filtros, usar `Limpar` no painel ou `Limpar tudo` nos chips activos.
9. Se necessario, clicar `Actualizar` para recarregar os registos.

Resultado esperado:
- Lista coerente com os criterios aplicados.
- Sem erro visual de carregamento.

## 6. Procedimento B - Adicionar aluno (convite)

1. Em `Alunos activos`, clicar `Adicionar aluno`.
2. No formulario `Novo aluno`, preencher:
- `Nome completo`
- `E-mail`
3. Clicar `Adicionar`.
4. Aguardar confirmacao visual de sucesso.
5. Verificar se o aluno aparece na lista de activos.

Regras:
- Nome e email sao obrigatorios.
- Em caso de erro de validacao, corrigir dados e repetir.

## 7. Procedimento C - Registar pagamento rapido

1. Na tabela de alunos activos, localizar aluno com situacao financeira diferente de `Sem registo`.
2. Na coluna `Accoes`, clicar no icone de pagamento (`$`).
3. No painel `Registar Pagamento`, confirmar o aluno.
4. Preencher:
- valor
- metodo (`Numerario`, `Transferencia`, `Multicaixa` ou `Referencia`)
- referencia (quando aplicavel)
5. Confirmar a acao.
6. Validar mensagem de sucesso e actualizacao da lista.

Controlo:
- Nunca confirmar valor sem validacao documental minima interna.

## 8. Procedimento D - Arquivar aluno (individual e lote)

### D.1 Individual
1. Na linha do aluno activo, clicar `Arquivar`.
2. Ler o modal de confirmacao.
3. Clicar `Arquivar` para concluir.

### D.2 Em lote
1. Selecionar alunos via checkbox.
2. Validar barra de seleccao e total selecionado.
3. Clicar `Arquivar` na barra de seleccao.
4. Confirmar em `Arquivar todos`.

Resultado esperado:
- Aluno deixa a aba `Activos`.
- Aluno passa a existir na aba `Arquivados`.

## 9. Procedimento E - Restaurar e eliminar permanentemente

### E.1 Restaurar
1. Mudar para aba `Arquivados`.
2. Na linha do aluno, clicar `Restaurar`.
3. Confirmar no modal.

### E.2 Eliminar permanentemente (acao critica)
1. Em `Arquivados`, clicar no icone de eliminar permanente.
2. Ler alerta de irreversibilidade.
3. Confirmar apenas com aprovacao interna previa.

Regra obrigatoria:
- Hard delete so pode ocorrer com registo de aprovacao operacional.

## 10. Procedimento F - Exportacao

### F.1 Exportar lista filtrada
1. Clicar `Exportar`.
2. Escolher formato:
- `Excel (.xlsx)`
- `PDF oficial`
3. Validar download do ficheiro.

### F.2 Exportar seleccao
1. Selecionar alunos desejados na tabela.
2. Na barra de seleccao, clicar `Exportar`.
3. Validar download do ficheiro de selecionados.

## 11. Resultado esperado (geral)

- Operacoes de alunos executadas sem perda de rastreabilidade.
- Estado final coerente entre abas `Activos` e `Arquivados`.
- Exportacoes geradas com os filtros/seleccao esperados.

## 12. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| Pesquisa nao retorna aluno esperado | Filtros activos ocultos | Limpar filtros e repetir pesquisa | Persistir sem resultado apos limpeza |
| Falha ao adicionar aluno | Email invalido ou conflito de conta | Corrigir email e reenviar | Mensagem tecnica persistente |
| Falha ao arquivar/restaurar | Permissao insuficiente ou estado inconsistente | Recarregar e tentar novamente | Repetir erro em 2 tentativas |
| Exportacao nao inicia | Falha de rede ou bloqueio de popup/download | Tentar novamente e validar browser | Falha continua para ambos formatos |
| Hard delete bloqueado | Regra de seguranca/permissao | Validar perfil e aprovacao | Acao necessaria e perfil autorizado sem sucesso |

## 13. Evidencias obrigatorias

- Identificador do aluno (numero processo/login ou ID curto).
- Print do estado final apos acao (activo, arquivado, restaurado).
- Para hard delete: registo de aprovacao interna.
- Para exportacao: nome do ficheiro gerado e timestamp.

## 14. KPI operacional do procedimento

- Tempo medio de pesquisa e filtragem: ate 5 min.
- Taxa de sucesso em acao de aluno (1a tentativa): >= 95%.
- Taxa de erro em acoes destrutivas: 0% sem aprovacao.

## 15. Riscos e controles

- Risco: arquivar aluno errado por seleccao em lote.
- Controle: dupla validacao de quantidade e nomes antes de confirmar.

- Risco: hard delete sem aprovacao.
- Controle: bloqueio operacional por checklist + aprovador interno.

- Risco: exportacao com filtros indevidos.
- Controle: validar chips de filtro activos antes de exportar.

## 16. Revisao e versao

- Ultima revisao: 2026-04-03
- Proxima revisao: 2026-04-17
- Mudancas desta versao: versao inicial P0 para gestao de alunos.

