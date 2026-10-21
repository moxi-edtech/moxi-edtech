# KLASSE IA · Inventário e decisões de inteligência escolar (21-10-2026)

## Partida e conflito

A branch `feature/klasse-ai-school-intelligence-20261021` deriva do HEAD remoto `2ab48b9b` do PR #212 (`feature/klasse-ai-inventory-consolidation-20261020`). O PR é empilhado **sobre #212** para não repetir nem sobrescrever alterações de `klasse-brain`, permissões ou widget; não inclui alterações locais não publicadas do outro espaço de trabalho. Nenhum merge/deploy autorizado.

## Ferramentas de leitura existentes (9 no registry, incluindo o recorte por aluno)

| Ferramenta | Fonte canónica | Resposta atual e limitação |
|---|---|---|
| `school-daily-briefing` | Encadeia outras 6 ferramentas | 3 prioridades e cobertura; não faz contagem nova |
| `finance-debt-by-class` | `turmas`, `vw_radar_inadimplencia` | Dívida por turma; pesquisa de turma e amostra; não é caixa |
| `finance-risk-summary` | `vw_financeiro_inadimplencia_top_ano` | Devedores e atraso; não é fluxo mensal |
| `admissions-pending` | `vw_admissoes_counts_por_status` | Candidaturas em análise; **não equivale a matrículas pendentes** |
| `academic-pedagogical-risk` | `vw_risco_pedagogico_aluno` | Sinais preditivos/heurísticos; **não é uma regra de reprovação RAA** |
| `academic-grade-gaps` | `vw_professor_pendencias` | Contava linhas com pendência; **não conta docentes distintos nem prazo vencido**, e não selecionava trimestre |
| `academic-low-attendance` | `vw_frequencia_resumo_aluno`, `matriculas` | Taxa agregada no histórico, não faltas do mês |
| `academic-calendar-operations` | `anos_letivos`, `periodos_letivos`, `calendario_eventos` | Ano/períodos/eventos, inclui prazo de notas `trava_notas_em` no esquema |
| `student-enrollment-context` | `alunos`, `matriculas` | Leitura do aluno selecionado, depende do PR #212 |

## Mapeamento das dez perguntas (sem pressupor resultados)

| # | Pergunta | Abordagem | Regra para resposta segura |
|---|---|---|---|
| 1 | Quantos professores não lançaram as notas deste trimestre? | Corrigir `academic-grade-gaps` com `vw_professor_pendencias` + `periodos_letivos` + `vw_turmas_para_matricula` | `professor_id` distinto, denominador, prazo; sem prazo/atribuição = recusa |
| 2 | Quais docentes têm avaliações pendentes e em que turmas? | Mesma ferramenta com variação de lista nominal limitada | Só docentes de escolas permitidas, com turma e disciplina; paginação/cap |
| 3 | Quantos alunos estão sem notas em Matemática? | Extensão da mesma fonte por `disciplina_nome` e `pendentes` | Não inventar estudantes únicos somando pendências em vários instrumentos; sem view adequada, recusa explícita |
| 4 | Quantos alunos faltaram mais de N vezes este mês? | `academic-low-attendance` + possível extensão mensal | A `vw_frequencia_resumo_aluno` não tem mês: recusar agregado mensal até view canónica |
| 5 | Quantas matrículas pendentes de conclusão? | Nova leitura canónica necessária | `vw_admissoes_counts_por_status` é candidatura, não matrícula: recusa sem view validada |
| 6 | Quais turmas ainda têm vagas? | Reusar `vw_turmas_para_matricula` | Ano letivo + capacidade > ocupação + status, só turmas com capacidade conhecida |
| 7 | Quanto deveria receber este mês e quanto recebeu? | `vw_financeiro_kpis_mes_ano` | `previsto_total` (competência por vencimento) e `realizado_total` (pagamento liquidado em caixa). MV pode estar defasada |
| 8 | Mensalidades vencidas há mais de N dias | `vw_financeiro_inadimplencia_top_ano` ou outra view | View existente agrega devedores; sem nível de mensalidade não atribuir mensalidades individualmente |
| 9 | Alunos com documentos em falta | Lacuna de view oficial consolidada | Sem critério canónico por documento obrigatório e aluno elegível, recusa |
| 10 | Turmas com maior risco de reprovação | `vw_risco_pedagogico_aluno` **não é RAA** | Recusa de classificação de reprovação sem resolvedor oficial; só sinalizadores factuais, sem inferência do LLM |

## Segurança / polo

`escola_users` tem `escola_id`, `user_id` e `papel`, **não `polo_id`** no snapshot versionado. Nem `vw_professor_pendencias` nem `vw_turmas_para_matricula` expõem `polo_id`. Portanto **não existe prova de isolamento por polo nesta base**. Uma pergunta com polo explícito deve falhar fechada; um escopo de Secretaria que exigiria isolamento por polo fica bloqueado enquanto não existir vínculo canónico polo↔utilizador↔recurso. Não simular visão por polo com filtros de texto; não enfraquecer RLS.

## Outras lacunas e decisões

- Não criar nova view/MV nem job recorrente nesta entrega sem evidência e validação Postgres descartável. O catálogo registará recusas inequívocas onde o read-model ainda não prova a resposta.
- Prazos de lançamento são `periodos_letivos.trava_notas_em`, não o tempo corrente do LLM; falta desse prazo ou atribuições completas impede um número categórico.
- `vw_professor_pendencias` vem de MV cronificada e agrega pares `(turma_disciplina,tipo,trimestre)`, incluindo avaliações que ainda não foram criadas. A ferramenta tem de distinguir não exigível / pendente / incompleto e revelar cobertura e atualização.
- `vw_financeiro_kpis_mes_ano` é MV por ano e mês e `realizado_total` contabiliza estados de liquidação; não substituir por montante de cobranças aprovadas.
- `vw_risco_pedagogico_aluno` indica risco de intervenção pela frequência/notas, não resultado do algoritmo RAA (`raa-progression-server.ts`). Proibido renomeá-lo como "risco de reprovação".
- Backend da consulta sempre `supabaseServerTyped()` (sessão autenticada; RLS); nunca `service_role`, SQL livre ou LLM com PII.
- O número de linhas da view de notas pode exceder limites de consulta: recusar a contagem se incompleta, em vez de somar apenas uma página.
