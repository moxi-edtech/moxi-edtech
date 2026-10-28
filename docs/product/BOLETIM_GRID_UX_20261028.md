# Boletim do Aluno — Trimestres, disciplinas e classificações

## Problema

O KLASSE precisa respeitar disciplinas que só são lecionadas num ou dois trimestres. A pauta do aluno deve mostrar a classificação trimestral, não vários números de avaliações como se fossem o resultado final.

## UX implementada na PR #278

- **Por trimestre (padrão):** três escolhas simples (1.º/2.º/3.º); apenas disciplinas configuradas para o período selecionado, com **uma classificação trimestral** por disciplina, quando apurada e disponibilizada.
- **Por disciplina:** escolhe uma disciplina do ano e consulta os três trimestres, distinguindo disciplinas não lecionadas, períodos por confirmar, classificação em apuramento e classificação disponível.
- **Detalhes opcionais:** clicar numa disciplina/trimestre apresenta provas e avaliações individuais realmente lançadas, sem fabricar componentes, notas anuais ou médias.
- **Exibir/Ocultar:** proteção visual para notas já autorizadas; nunca desbloqueia notas ou PDFs protegidos.
- **Imprimir / PDF:** permanece o PDF existente, acessível apenas após checkBoletimAccess; o modo de consulta não muda a autorização.
- **Correção/melhoria:** só em disciplina com avaliações autorizadas, ano académico atual; histórico é apenas leitura.

## Contratos das APIs

A rota autorizada `/api/aluno/disciplinas` continua **sem acesso à tabela notas**. Ela passa a expor `periodos_ativos` a partir da atribuição da turma, usando a matriz curricular como fallback quando a atribuição não definiu os períodos. `null` não significa todos os trimestres: significa **não configurado**. Configurações ambíguas não podem ser usadas para inventar que a disciplina não foi lecionada.

A rota `/api/aluno/boletim` preserva `disciplinas: []` se o pagamento não liberou as notas. Quando `checkBoletimAccess` autoriza, a lista de avaliações individuais é combinada, por disciplina, com `nota_final` de `vw_boletim_por_matricula`, que segue o motor de cálculo configurado da escola.

**Não se calcula a classificação final no frontend.** Uma linha da vista só é apresentada como conclusão trimestral se não houver `has_missing`, `needs_config`, status impeditivo e se houver notas reais; os demais casos são `Em apuramento` ou `Sem classificação`. Um resultado zero real continua válido.

### Limitação de frescura e histórico

`vw_boletim_por_matricula` lê uma *materialized view* (`internal.mv_boletim_por_matricula`). Notas recém-lançadas podem demorar até à atualização da vista; não fazer fallback para média improvisada. A vista atual está condicionada a matrículas ativas; se o histórico não existir na vista, os detalhes de avaliação registados continuam acessíveis após autorização, mas uma classificação trimestral não é inventada. A evolução do cálculo de notas em tempo real e dos snapshots históricos deve ser tratada separadamente.

## Homologação necessária

1. Disciplina apenas no primeiro trimestre desaparece dos outros dois, mas é visível no histórico anual como «Não lecionada».
2. Disciplina não configurada para qualquer período identificável aparece com «Período por confirmar», não com falso valor ou uma ausência presumida.
3. Boletim bloqueado mostra nomes de disciplinas e períodos, mas nem notas trimestrais nem individuais chegam do servidor.
4. Boletim liberado mostra apenas a classificação trimestral na grelha; avaliações individuais exigem expandir.
5. Classificação incompleta é apresentada como «Em apuramento»; sem qualquer lançamento, «Sem classificação».
6. Zero real é apresentado como 0; seleção de aluno/ano nunca reaproveita notas de outro contexto.
7. Modal de reapreciação e melhoria preserva foco, e o PDF continua protegido.
8. Capturas sintéticas a 360px, 390px e diferentes zooms sem transbordamento.

Sem migração de banco, atualização de estado de pagamento, alteração de RLS ou manipulação da classificação em browser.
