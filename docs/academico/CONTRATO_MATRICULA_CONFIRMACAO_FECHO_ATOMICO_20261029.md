# KLASSE — contrato transacional de matrícula, confirmação e finalização

**29/10/2026 · PR #290 · Base #289 → #288 → #282**

## Decisão de arquitetura

**Uma matrícula identifica a relação aluno ↔ turma ↔ ano letivo; a turma oficial é a fonte dos seus vínculos de classe e curso.**
O `session_id` da matrícula referencia exatamente o `anos_letivos.id` da turma, e `ano_letivo` coincide com `anos_letivos.ano`. Não inferir a classe/curso a partir dos campos opcionais do cliente e não assumir o ano civil como ano letivo. A identidade do estudante e da turma pertence à mesma escola.

Fluxos:
1. **Nova matrícula**: `POST /api/escolas/[id]/matriculas/novo`, com `aluno_id`, `turma_id`, `classe_id`, `ano_letivo_id` e opcional `course_id`. A API valida autenticação, RBAC e ano ativo, e delega a uma única RPC.
2. **Admissões**: continuam em `admissao_finalizar_matricula`, que usa a turma oficial; não reimplementamos preços, pagamentos ou candidaturas.
3. **Confirmação de rematrícula**: continua em `finalizar_rematricula_balcao`, com RAA, reserva, pagamento e recibo. `matricula_criar_confirmar_por_turma_v1` rejeita todas as reservas existentes, inclusive pendentes.
4. **Retificação/transferência**: somente RPCs auditadas, como `retificar_classe_matricula`; a API de nova matrícula não pode deslocar uma matrícula já existente para outra turma.
5. **Finalização anual**: `finalizar_matricula_blindada` + GradeEngine, sem dropdown de aprovação/reprovação. O resultado fica bloqueado se não houver dados académicos suficientes. Overrides administrativos próprios não equivalem a resultados escolares.

## Proteções por camada

### Base de dados
- `trg_klasse_guard_matricula_turma_context`: valida turma, escola, classe, curso, ano letivo e estudante em qualquer INSERT ou UPDATE relevante de `matriculas`. Completa ano/sessão omitidos apenas quando existe uma turma oficial inequívoca; rejeita valores conflitantes.
- `matricula_criar_confirmar_por_turma_v1`: autentica e autoriza na escola, valida o ano ativo e a turma aberta, curso e classe esperados, vagas, serializa por escola/aluno/ano, devolve matrícula existente idêntica e falha se existir uma reserva/decisão a rever. A única chamada ao `confirmar_matricula_core` insere a matrícula e o número na mesma transação.
- `create_or_confirm_matricula` permanece para jobs internos `service_role`, mas não pode ser chamado diretamente pelo papel `authenticated` sem validação.
- Triggers financeiros e de documentos pré-existentes permanecem inalterados.

### API e interface
- Removeu-se o `service_role` da rota HTTP de nova matrícula, bem como o `UPDATE` posterior que poderia deixar a operação parcialmente concluída.
- O ano letivo enviado como número é primeiro resolvido para um `anos_letivos.id` da escola; a ausência ou fecho do ano interrompe a operação.
- `FinalizarMatriculaButton` já não permite escolher "Concluído" ou "Reprovado" nem emite comprovante de matrícula como efeito colateral do fecho anual.
- `POST /api/secretaria/matriculas/[matriculaId]/finalizar` devolve 422 com motivos do GradeEngine quando incompleto, 409 quando outro bloqueio, e sucesso apenas quando a RPC devolveu `ok:true`.

## Evidência verificada no Supabase live

- Migração remota `20261029112728_enrollment_context_atomic_authorized_create_20261029` executada.
- 1.114 matrículas inspecionadas, **0** inconsistências turma/escola/ano/sessão.
- Acesso direto à RPC legada pelo papel `authenticated`: **revogado**.
- Nova RPC acessível a `authenticated`, porém exige `auth.uid()` e papel autorizado na escola.
- Guard ativo; três testes transacionais negativos de ano incompatível, turma de outro tenant e chamada sem sessão/autorização passaram com rollback.
- Zero modificações em notas e decisões escolares. Os 550 casos de 2025 ainda pendentes no Curtume exigem documentos e ratificação; não são resolvidos por metadados de matrícula.

## Não abrangido

Sem alteração em AGT, SAF-T, fiscal, mensalidades, cobranças, recibos ou emissão de documentos. A qualidade da implementação é verificada por CI e testes de integridade, mas a homologação autenticada ponta a ponta no Balcão e portais antes de publicar em produção continua necessária.
