-- ETAPA 1: Corrigir a arquitetura da tabela de auditoria
-- Removemos a chave estrangeira pois ela impede o registro de exclusões (logs de "DELETE")
ALTER TABLE turmas_auditoria
DROP CONSTRAINT IF EXISTS turmas_auditoria_turma_id_fkey;

-- ETAPA 2: Limpar referências antigas (se houver) dos registros duplicados na auditoria
DELETE FROM turmas_auditoria
WHERE turma_id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY escola_id, curso_id, classe_id, ano_letivo, nome, turno
             ORDER BY id DESC
           ) as row_num
    FROM turmas
  ) t
  WHERE t.row_num > 1
);

-- ETAPA 3: Agora sim, apagar as turmas duplicadas
DELETE FROM turmas
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY escola_id, curso_id, classe_id, ano_letivo, nome, turno
             ORDER BY id DESC
           ) as row_num
    FROM turmas
  ) t
  WHERE t.row_num > 1
);