# Curtume — runbook de correcção de turmas (GATED)

**Não executar em produção antes da revisão e aprovação explícita do PR, CI completo e aplicação autorizada da migration.** Nunca incluir nomes ou identificadores reais em tickets, logs ou capturas.

## Antes (secretaria + direcção)
- [ ] Identificar internamente alunos e matrículas afectados, sem exportar dados pessoais para o repositório.
- [ ] Registar turma actual, turma pretendida, ano, classe, curso, sessão e motivo individual.
- [ ] Conferir autorização do operador, capacidade, avaliações já lançadas e pendências financeiras.
- [ ] Se classe, curso, ano ou sessão diferirem: **parar** e encaminhar para rectificação académica separada.
- [ ] Aprovar janela de operação e plano de recuperação; guardar contagens e evidências internamente.

## Execução (gated)
1. Aprovar revisão do PR e confirmar CI verde no HEAD; **não fazer merge automaticamente**.
2. Autorizar e aplicar a migration pendente em janela controlada; validar permissões e auditoria em ambiente descartável primeiro.
3. Abrir Secretaria → Matrículas → Transferir; seleccionar a turma compatível, indicar motivo e rever a confirmação.
4. Confirmar uma única vez; em erro, consultar estado actual e auditoria antes de tentar novamente.
5. Repetir individualmente para cada aluno aprovado; não executar SQL de escrita manual.

## Depois
- [ ] Matrícula mantém o mesmo ID; turma actual é a aprovada.
- [ ] Quantidade e valores de notas, cobranças, pagamentos, recibos e presenças não mudaram.
- [ ] Existe exactamente um evento de auditoria com origem, destino, motivo, responsável e data.
- [ ] Conferir portal aluno/professor, boletim e lotação; documentar divergências sem expor dados pessoais.

## SQL somente leitura (executar em sessão autorizada, com UUID de matrícula fornecido internamente)
```sql
BEGIN READ ONLY;
SELECT m.id AS matricula_id, m.escola_id, m.aluno_id, m.turma_id,
       m.status, m.ano_letivo, m.session_id
FROM public.matriculas m
WHERE m.id = :matricula_id::uuid AND m.escola_id = :escola_id::uuid;
SELECT a.created_at, a.actor_id, a.action, a.before, a.after,
       a.details->>'motivo' AS motivo
FROM public.audit_logs a
WHERE a.escola_id = :escola_id::uuid
  AND a.entity = 'matriculas'
  AND a.entity_id = :matricula_id::text
  AND a.action = 'MATRICULA_TRANSFERIDA'
ORDER BY a.created_at DESC;
COMMIT;
```
Compare os totais académicos e financeiros em consultas read-only próprias antes/depois, respeitando RLS; não exporte dados pessoais.
