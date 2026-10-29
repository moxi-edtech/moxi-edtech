# Curtume — resultados académicos calculados para 2025/2026

**Data da auditoria:** 29/10/2026  
**Escola:** Complexo Escolar Privado Advetista de Curtume  
**Fonte:** Supabase KLASSE e `public.gradeengine_calcular_situacao(matricula_id)`.  
**Natureza:** relatório de conferência académica, **não uma pauta oficial, não substitui a direção e não confirma aprovação/reprovação**.

## Resultados efetivamente gerados

O GradeEngine foi executado em transação de leitura com uma sessão autenticada da escola, cobrindo **564 matrículas de 2025**. Nenhuma nota, matrícula ou histórico foi alterado.

| Medida | Quantidade |
|---|---:|
| Matrículas analisadas | 564 |
| Matrículas de 2025 ainda pendentes | 550 |
| Das pendentes, GradeEngine = `incompleto` | 550 |
| Decisões antigas já registadas como `aprovado` | 12 |
| Decisões antigas já registadas como `reprovado` | 2 |
| Das 14 com decisão antiga, GradeEngine = `incompleto` | 14 |
| Resultados com fecho legal e oficialmente publicáveis | **0** |
| Matrículas pendentes com alguma nota lançada | 5 |
| Pendentes com matrícula ativa em 2026/2027 | 306 |
| Pendentes com transição explicitamente vinculada e destino ativo | 300 |

> **Motivo retornado pelo motor para todas as 564:** «Não há disciplinas oficiais avaliadas. Confirme matriz curricular, pautas ou decisão académica documentada.»

A matrícula ativa do ano seguinte prova **continuidade administrativa**, não a decisão pedagógica do ano anterior. O estado `elegivel` na coorte `CURTUME_2025_SEM_PAUTAS` também **não representa aprovação**.

## Distribuição das 550 pendências

| Classe | Matrículas sem decisão verificada | Com notas | Com transição vinculada e destino ativo |
|---|---:|---:|---:|
| Pré-Escolar | 14 | 0 | 7 |
| 1.ª | 28 | 2 | 7 |
| 2.ª | 43 | 0 | 22 |
| 3.ª | 41 | 0 | 24 |
| 4.ª | 44 | 0 | 31 |
| 5.ª | 58 | 0 | 37 |
| 6.ª | 54 | 0 | 31 |
| 7.ª | 125 | 3 | 66 |
| 8.ª | 83 | 0 | 52 |
| 9.ª | 60 | 0 | 23 |
| **Total** | **550** | **5** | **300** |

## Fonte individual detalhada

`supabase/ops/scripts/relatorio_resultados_academicos_preliminares.sql` emite a relação individual com matrícula, aluno, classe, turma, notas existentes, cálculo GradeEngine, decisão antiga, status do snapshot, transição e próxima ação. A consulta **não grava ou publica** resultados e exige sessão escolar autenticada; não é para executar como um usuário anónimo.

## Processo operacional legítimo

1. **Rever as 550 pendências:** recolher pauta, ata ou declaração oficial da escola identificada por referência documental; para dados completos, permitir o cálculo automático do GradeEngine.
2. **Registrar a decisão de cada aluno:** usar o fluxo autorizado de reconciliação histórica, mantendo ator, documento e motivo auditáveis.
3. **Ratificar as 14 decisões já registadas:** confrontar as aprovações e reprovações antigas com os documentos escolares, sem as substituir por resultados calculados a partir de matrículas de destino.
4. **Fechar históricos somente após ratificação:** utilizar a RPC de snapshot legal, mediante as pré-condições de integridade, e só então expor o resultado como oficial nos portais.
5. **Homologar nos três canais:** Secretaria/Balcão, portal do aluno e portal do professor, assegurando estados claros de «pendente de avaliação», «decisão registada», «em validação» e «resultado oficial».

**Importante:** não gerar números de nota artificiais, não promover todos os alunos automaticamente e não ativar o módulo fiscal, AGT ou SAF-T.

## Verificações

A query individual foi validada no banco instalado, em transação revertida, resultando em **564 linhas, 564 cálculos incompletos, 14 decisões históricas registadas e 0 resultados oficiais**. A validação não substitui o ato pedagógico documentado.
