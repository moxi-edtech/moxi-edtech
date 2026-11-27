# Carga docente e regimes de docência — candidato

## Contrato
- O valor legado em teachers.carga_horaria_maxima permanece em tempos/semana. Não converter automaticamente.
- carga_contratual_minutos: informação contratual total, distinta da carga lectiva.
- carga_lectiva_limite_minutos: limite lectivo opcional em minutos. Quando NULL, a unidade efectiva é tempos.
- Carga atribuída: agregação por turma + disciplina, ano activo, matriz publicada. Não confundir carga prevista com horas efectivamente ministradas.
- Duração: configuração explícita da turma ou slots não-intervalo uniformes do turno. Se não determinável, bloquear novas atribuições em modo minutos.
- Monodocência: todos os vínculos publicados elegíveis numa transacção. Misto: subconjunto explícito para o titular. Pluridocência: manutenção da atribuição por disciplina. Nenhuma substituição implícita.
- O limite contratual é informativo; a comparação efectiva usa o limite lectivo. A validação contratual cruzada para modo tempos depende da duração e de política da escola.

## Curtume
20 tempos = 900 minutos; 20 horas lectivas = 1200 minutos. 21 tempos de 45 min = 945 minutos. Não alterar nenhum dos cadastros sem confirmação da escola.

## Pendências obrigatórias antes do merge
- [ ] Gerar a migração versionada com a CLI, reconciliar a definição das RPCs com a main efectiva e garantir ordem. O SQL está em migration_drafts para não correr inadvertidamente em produção.
- [ ] Executar os casos candidatos em PostgreSQL 17 descartável e adaptar o bootstrap mínimo (horario_slots, turmas.turno, constraints), mais suite completa e testes concorrentes.
- [ ] Integrar configuração no modal de cadastro/edição e atribuição por turma; exibir unidade e projecção consistente nas listas, modal de troca, portal professor e wizard. Os endpoints novos ainda não são consumidos pelo frontend.
- [ ] Implementar leitura/regime por classe com override de turma, duração explícita e troca atómica de titular integral; o candidato actual configura apenas turma.
- [ ] Auditar todos os writers de teachers, turmas, matriz, slots e vínculos, RLS, permissões de coluna, lock comum, revogação de grants e guardas de alterações de carga/regime/duração. Confirmar efeitos de triggers e constraints existentes.
- [ ] Resolver conversão com slots de duração variável (sem inferência silenciosa), alterações de matriz, consistência dos horários publicados, e a troca de titular.
- [ ] Corrigir observabilidade enum evento_tipo e mapear erros de duração/regime em todas as APIs antigas.
- [ ] Verificar CI, homologar com Curtume, sem migrar os limites históricos automaticamente.

Não aplicar o SQL candidato em produção, nem publicar as APIs até promover a migração e concluir os consumidores.
