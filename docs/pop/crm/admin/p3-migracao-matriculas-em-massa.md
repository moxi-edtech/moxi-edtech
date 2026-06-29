# POP-P3-02 - Migracao de Alunos e Matriculas em Massa

Versao: 1.1.0
Data: 2026-06-28
Modulo: Secretaria/Migracao (operacao usada por Admin da Escola)
Perfil principal: admin_escola (com acesso ao fluxo de migracao)
Tempo medio alvo: 30-90 minutos por lote

## 1. Objetivo

Padronizar a importacao de alunos e a matricula automatica por lote, com controlo de validacao, estrutura e erros.

## 2. Quando usar

- Migracao inicial de base legada.
- Entrada em massa de alunos por planilha.
- Regularizacao de cadastro/matricula no inicio do ano letivo.

## 3. Responsaveis

- Executor: Admin da Escola
- Co-responsavel: Secretaria
- Escalonamento: Suporte tecnico

## 4. Pre-condicoes

- Acesso ao wizard em `/escola/{id}/secretaria/migracao/alunos`.
- Alias operacional presente no codigo: `/escola/{id}/operacoes/migracao/alunos`.
- Ficheiro `.csv` ou `.xlsx` pronto.
- Colunas minimas: nome e data de nascimento.
- Para matricula automatica: coluna de codigo de turma preenchida.

## 4.1 Estado fiel ao codigo

- A UI do wizard é implementada por `apps/web/src/app/migracao/alunos/wizard.tsx`.
- O wizard é reutilizado por rotas do portal da escola; o POP deve orientar pelo fluxo exibido, nao por uma unica URL fisica.
- Os titulos reais das etapas sao `Upload`, `Mapeamento`, `Revisão`, `Estrutura`, `Configuração Final` e `Importação Concluída`.

## 5. Procedimento A - Executar wizard de importacao

1. Abrir `Migração de Alunos`.
2. Passo `Upload`: enviar ficheiro e clicar `Continuar para Mapeamento`.
3. Passo `Mapeamento`: mapear colunas e definir `Ano Letivo de Destino`.
4. Clicar `Validar Dados`.
5. Passo `Revisão`: conferir preview e avancar.
6. Passo `Estrutura`: concluir analise/criacao de estrutura academica.
7. Passo `Configuração Final`: ajustar:
- `Modo de Operação` (`migracao` ou `onboarding`)
- opcao `Apenas Cadastro` quando nao quiser matricular no mesmo ciclo
- `Mês de Início` e `Data Base` do financeiro
8. Clicar `Processar Importação`.

## 6. Procedimento B - Tratar resumo e pendencias no passo final

1. No passo `Importação Concluída`, revisar:
- cards de `Importados`, `Criados`, `Ignorados`, `Erros`
- bloco `Resumo Financeiro`
- bloco `Bloqueios de importação` (quando existir)
2. Se houver `Pendências Financeiras`, encaminhar para ajuste no financeiro antes da cobranca.
3. Se houver `Erros de Importação`, extrair lista e tratar por causa raiz.

## 7. Procedimento C - Executar matriculas em massa

1. No bloco `Matrícula Automática`, clicar `Atualizar Lista`.
2. Selecionar apenas lotes com estado `Aguardando`/`ready`.
3. Clicar `Confirmar Matrículas`.
4. Acompanhar:
- barra de progresso
- resumo de sucesso por turma (`OK` e erros)
5. Repetir somente nos lotes pendentes.

## 8. Resultado esperado

- Alunos importados conforme lote.
- Turmas processadas com matriculas aplicadas.
- Pendencias remanescentes identificadas para correcao dirigida.

## 9. Erros comuns e correcao

| Erro observado | Causa provavel | Correcao imediata | Escalar quando |
|---|---|---|---|
| `Mapeie pelo menos Nome e Data de Nascimento.` | Campos minimos nao mapeados | Ajustar mapeamento e revalidar | Validacao falhar com mapeamento correto |
| `PLAN_LIMIT` / limite do plano | Limite contratual excedido | Avaliar upgrade/segmentacao do lote | Operacao bloqueada sem alternativa |
| Turma com `Erro Estrutura` no passo final | Turma/codigo/ano inconsistente | Corrigir estrutura e atualizar lista | Erro persistente apos ajuste |
| `Falha ao matricular grupo` | Erro no processamento do lote | Reexecutar lote especifico | Falha recorrente no mesmo lote |

## 10. Evidencias obrigatorias

- Captura dos passos criticos (mapeamento, revisao, resumo final).
- Captura do resumo de matricula por turma.
- Relatorio de erros/pendencias arquivado.

## 11. Referencia tecnica (fiel ao codigo)

- Upload: `POST /api/migracao/upload`
- Validacao: `POST /api/migracao/alunos/validar`
- Importacao: `POST /api/migracao/alunos/importar`
- Preview de lotes matricula: `GET /api/migracao/{importId}/matricula/preview?escola_id={id}`
- Matricula em massa por turma: `POST /api/matriculas/massa/por-turma`
- Erros de importacao: `GET /api/migracao/{importId}/erros`

## 12. Revisao e versao

- Ultima revisao: 2026-06-28
- Proxima revisao: 2026-07-12
- Mudancas desta versao: adicionado alias `/operacoes/migracao/alunos` e estado fiel ao codigo do wizard.
