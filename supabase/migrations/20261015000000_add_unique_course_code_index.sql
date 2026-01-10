begin;

-- Adiciona um índice único para garantir que não haja mais de um curso 'aprovado'
-- com o mesmo `course_code` para a mesma escola.
-- Cursos em estado 'rascunho' ou outro status não são afetados, permitindo
-- que existam rascunhos duplicados até que um seja aprovado.
CREATE UNIQUE INDEX IF NOT EXISTS unique_approved_course_code
ON public.cursos (escola_id, course_code)
WHERE (status_aprovacao = 'aprovado');

commit;
