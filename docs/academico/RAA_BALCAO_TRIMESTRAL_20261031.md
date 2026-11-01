# Rematrícula no Balcão — Contexto trimestral (PR #311)

A lista de pendências da matrícula de **origem** apresenta o período oficial, quando está associado à evidência. Não deriva o período da data de uma ausência. A matrícula, a escola e o ano letivo de origem continuam a ser validados no servidor.

- **Todos:** visão de todas as evidências disponíveis nesse processo.
- **1.º / 2.º / 3.º Trim.:** apenas casos cujo período foi confirmado por `periodo_letivo_id` da frequência, associado a um trimestre publicado do ano letivo de origem.
- **Outros:** pedidos, exames e ocorrências de âmbito anual ou sem trimestre explícito, e notas pendentes cujo RAA fornece apenas a disciplina, sem o período exato.
- Um trimestre não é inventado para eventos anuais, pautas incompletas ou justificações sem `periodo_letivo_id`.
- O editor de notas continua a exigir a seleção de período autorizado pelo calendário MED. Um trimestre inicial, quando fornecido, é apenas uma sugestão e é conferido com a API oficial.
- Em caso de falha de leitura de um dos serviços, o Balcão apresenta «Consulta parcial»; não trata a ausência de resposta como «sem pendências».
- Os filtros são puramente visuais e não alteram resultados académicos, pagamentos, horários ou RLS.
- A decisão oficial do RAA continua a determinar se a rematrícula pode prosseguir, independentemente do contador de registos resolvidos.

## Limitações deliberadas

O resolvedor de notas pendentes do RAA fornece `disciplina_ids_pendentes`, mas **não fornece períodos de nota em falta por disciplina**. Até existir uma fonte canónica por `matricula_id + disciplina_id + periodo_letivo_id`, essas notas ficam em «Outros» (trimestre por confirmar), sem falsos positivos no 1.º, 2.º ou 3.º. A avaliação final anual e os exames/recursos também não recebem um trimestre com base apenas na data.

## Verificações necessárias

- Três justificações em trimestres diferentes da mesma matrícula.
- Uma justificação sem período identificado.
- Registos de outros anos e outras escolas não podem aparecer.
- EJA, matérias lecionadas apenas num trimestre e ofertas com calendário próprio.
- Edição de notas em período encerrado, futuro ou sem reconciliação MED.
- Ecrãs mobile e Light/Dark.
