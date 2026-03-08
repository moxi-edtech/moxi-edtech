-- Ensure unique matrix rows per curriculum version
CREATE UNIQUE INDEX IF NOT EXISTS curso_matriz_unique_curriculo_idx
  ON curso_matriz (escola_id, curso_id, classe_id, disciplina_id, curso_curriculo_id);

-- Prevent duplicates when curso_curriculo_id is null
CREATE UNIQUE INDEX IF NOT EXISTS curso_matriz_unique_no_curriculo_idx
  ON curso_matriz (escola_id, curso_id, classe_id, disciplina_id)
  WHERE curso_curriculo_id IS NULL;
