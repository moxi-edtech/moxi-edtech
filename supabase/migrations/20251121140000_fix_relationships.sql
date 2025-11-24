-- Fix relationship between alunos and profiles
ALTER TABLE public.alunos DROP CONSTRAINT IF EXISTS alunos_profile_id_fkey;
ALTER TABLE public.alunos
ADD CONSTRAINT "alunos_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Fix relationship between matriculas and alunos
ALTER TABLE public.matriculas DROP CONSTRAINT IF EXISTS matriculas_aluno_id_fkey;
ALTER TABLE public.matriculas
ADD CONSTRAINT "matriculas_aluno_id_fkey" FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;
