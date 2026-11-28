# Homologação física — editor matemático mobile (PR #505)

Estado: **PENDENTE**. Testes Chromium e WebKit com viewport simulado não comprovam comportamento do teclado, toque ou Safari/Chrome em aparelhos físicos. Não houve acesso autorizado a dispositivos reais nesta rodada.

## Ambiente
- Usar o preview da PR (não produção) com escola de teste e professor autorizado; nunca usar dados de alunos reais.
- Registar URL/commit, modelo de aparelho, versão iOS/Android, versão do navegador, orientação e evidências anonimizadas.
- Executar Safari num iPhone físico e Chrome num Android físico. Repetir em portrait e landscape.

| Caso | Procedimento | Resultado esperado | iPhone | Android |
| --- | --- | --- | --- | --- |
| Foco | Abrir uma fracção; tocar no numerador | Campo focado com teclado adequado; sem zoom involuntário ou elemento encoberto | Pendente | Pendente |
| Sinais | Alternar 7 para -7 e voltar; testar expoente -2 e base negativa | Preview imediato; base (-2)^3 não perde parênteses; sinais conservados após reabertura | Pendente | Pendente |
| Agrupamento | Em 2+3+4, seleccionar 3 e 4; desagrupar após confirmação | 2+(3+4), depois 2+3+4; desfazer/refazer correctos | Pendente | Pendente |
| Estruturas | Editar célula, radicando, expoente e numerador aninhado | Selecção directa sem navegar em menus de profundidade | Pendente | Pendente |
| Importação | Abrir fórmula com `\\left(2+\\frac{3}{4}\\right)`; editar valor; cancelar; reabrir e confirmar | Cancelar preserva original; alteração conserva estrutura; sem duplicação | Pendente | Pendente |
| Rascunho | Apagar valor e tentar inserir; corrigir | Bloqueia gravação inválida; restauro e foco funcionam | Pendente | Pendente |
| Viewport | Com teclado aberto, tocar e alternar números, rodar dispositivo, fechar teclado | Sem deslocamento horizontal da página; expressão ampla rola apenas na sua área | Pendente | Pendente |
| Persistência | Guardar prova de teste, reabrir, visualizar A4 | Fórmula mantém notação e valores; edição não altera outras perguntas | Pendente | Pendente |

## Gate
Não declarar homologação física aprovada sem registo dos dois aparelhos, evidência e identificação do commit ensaiado. CI e homologação física são gates distintos.
