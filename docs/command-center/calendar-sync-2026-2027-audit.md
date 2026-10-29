# Auditoria de sincronização MED — ano letivo 2026/2027

Estado em 29/10/2026. Consulta real do projecto Supabase KLASSE, limitada a metadados académicos agregados. **Sem alteração de histórico escolar, datas financeiras, datas do ano ou matrícula de alunos.**

## Contrato de fonte

- A referência normativa é o decreto/calendário MED do ano. O catálogo `calendario_templates` representa as versões importadas por subsistema; `school_education_offerings.calendar_profile_id` associa cada oferta ao perfil correto.
- `anos_letivos` contém os limites do ano por escola; `periodos_letivos` contém trimestres; `calendario_eventos` contém provas, pausas e eventos. Esses registos devem concordar com o perfil oficial publicado.
- O ano `2026` na coluna `ano` representa o letivo **2026/2027**, não o calendário civil 2026.
- Rastreabilidade: `source_template_id`, `source_item_id` e `source_version`. A ausência desses campos impede chamar a aplicação de **totalmente verificada**, mesmo que as datas coincidam.
- O catálogo tem quatro perfis oficiais de 2026/2027, com `estado=PUBLICADO`, `versao_documento=FINAL-ACTUALIZADO`. **Todos têm `fonte_documento_url` e `publicado_em` vazios**: a origem documental e a publicação legal têm de ser confirmadas antes de declarar conformidade com o decreto integral.

## Resultado no banco

| Dimensão | Curtume | Escola KLASSE |
|---|---:|---:|
| Ano 2026/2027 activo | Sim | Sim |
| Limites do ano | 01/09/2026–31/08/2027 | 01/08/2026–31/07/2027 |
| Limites do catálogo MED | 01/09/2026–31/08/2027 | 01/09/2026–31/08/2027 |
| Trimestres | 3, datas alinhadas | 3, datas divergentes |
| Eventos oficiais esperados pelas ofertas | 31 | 35 |
| Eventos oficiais encontrados | 31 | 0 |
| Trimestres sem proveniência | 0 (corrigido) | 3 |
| Turmas do ano | 22 | 25 |
| Matrículas do ano | 512 | 17 |
| Matrículas com turma de outro ano | 0 | 0 |

- A verificação agregada encontrou 17 candidaturas **já matriculadas** na Escola KLASSE com `turma_preferencial_id` histórico do ano 2025, mas os vínculos da `matriculas` estão corretos em 2026. Não reescrever preferências históricas de candidatos nem mover alunos como solução para calendário.
- Há competências de mensalidades em 2026 anteriores a setembro para 17 matrículas da Escola KLASSE. Corrigir o ano de agosto para setembro sem análise pode afetar o financeiro; não foi feito.
- Curtume: os três períodos com datas coincidentes com o perfil `REGULAR_ADULTOS` foram vinculados à fonte importada, apenas nos campos de proveniência, em transação auditada. Nenhuma data, peso ou matrícula foi alterada.

## Causa técnica e correcção

1. O POST de `/api/secretaria/operacoes-academicas/virada/sessions-target` enviava os períodos ao RPC sem `source_template_id`, `source_item_id` ou `source_version`.
2. O RPC `upsert_bulk_periodos_letivos` ignorava essas colunas. A correção implantada no Supabase aceita a proveniência **somente quando corresponde ao item do modelo oficial publicado, ao ano e às datas enviadas**. Chamadas legadas sem fonte continuam válidas; se houver alteração manual de datas, a proveniência antiga é anulada, e não reaproveitada indevidamente.
3. Uma migração complementar preserva a compatibilidade do modelo legada 2025/2026, que usa `PROVA_TRIMESTRAL` como origem de períodos, apenas quando não há itens `PERIODO_LETIVO`.
4. O POST de preparação de ano agora transporta e verifica a proveniência no banco e não altera um ano já ativo nem mistura anos/trimestres de perfis divergentes.
5. A rota legada de aplicação de um único modelo recusa aplicar sobre uma escola de múltiplos subsistemas e não reescreve automaticamente um ano ativo divergente.
6. A API canónica de conversão de admissões `/api/secretaria/admissoes/convert` faz verificação de leitura do decreto/ano/turma antes da transação financeira quando o ano base é 2026 ou posterior. Se houver divergência operacional, devolve `ACADEMIC_CALENDAR_NOT_CONFIGURED` ou `ACADEMIC_CALENDAR_YEAR_MISMATCH`, preservando a candidatura; não executa a RPC de matrícula nem cria a cobrança. Respostas idempotentes para matrículas já finalizadas continuam acessíveis.
7. O modelo legado 2025/2026 mantém o contrato anterior; as verificações de múltiplos subsistemas aplicam-se apenas aos modelos novos (ano base 2026+).


## Verificação contínua

A rota autorizada, de leitura apenas, `GET /api/secretaria/operacoes-academicas/calendario/decreto-health?ano=2026`, confronta:
- ano e limites do catálogo;
- oferta educativa e perfil de subsistema publicado;
- trimestres e sua proveniência;
- eventos oficiais e datas de provas;
- integridade da referência documental.

A resposta separa `operationally_aligned` (sem divergência de datas ou eventos) de `healthy` (origem documental e rastreabilidade completas). Retorna códigos de desvio explícitos; não faz escrituras.

## Bloqueios que permanecem

**Escola KLASSE:** a conversão de novas candidaturas para 2026/2027 deverá ficar bloqueada pelo preflight de sincronização até a divergência ser resolvida e o novo código estar em produção. É necessária conciliação do início financeiro de 17 matrículas antes de mudar o início do ano. Em seguida, aplicar os perfis oficiais às ofertas, reconciliar trimestres e sincronizar 35 eventos sem duplicações nem sobrescrever históricos. Homologar com perfis de direção/secretaria e verificar 2026/2027 em todas as turmas.

**Fonte oficial:** importar URL/referência do decreto de 2026/2027 e data real de publicação para cada um dos quatro perfis após confirmação jurídica. `FINAL-ACTUALIZADO` não substitui uma referência verificável ao diploma.

**Produção:** estas mudanças de código estão na PR #299. As duas alterações da função foram aplicadas ao Supabase e verificadas com leitura; a API de auditoria e os guards do código só entrarão em produção após CI, revisão e merge. Não declarar o sistema completamente sincronizado até esses bloqueios serem resolvidos.

## Protocolo de homologação

1. Testar auditoria em ano 2026 no Curtume: `operationally_aligned=true`, `healthy=false` até completar a fonte documental.
2. Testar Escola KLASSE: `operationally_aligned=false` com `YEAR_RANGE_MISMATCH`, `TRIMESTER_DATES_MISMATCH`, `OFFICIAL_EVENT_MISSING` / `EXAM_EVENT_MISSING`.
3. Homologar origem documental do decreto por subsistema.
4. Conciliar efeitos financeiros e efectuar a regularização académica de forma autorizada, não pelo Balcão.
5. Reexecutar o GET e conferir, por escola, 3 trimestres, todos eventos oficiais, proveniência completa, nenhuma divergência em ano, turmas ou matrículas.
6. Verificar idempotência da sincronização (repetir não duplica provas/eventos) e workflows de CI.
