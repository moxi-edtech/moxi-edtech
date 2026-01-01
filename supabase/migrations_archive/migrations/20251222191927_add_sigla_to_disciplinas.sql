-- 1. Criar a coluna (Seguro: não apaga dados)
ALTER TABLE public.disciplinas 
ADD COLUMN IF NOT EXISTS sigla TEXT;

-- 2. O Grande Update (Inteligência de Mapeamento)
-- Este comando atualiza apenas quem ainda NÃO tem sigla.
UPDATE public.disciplinas
SET sigla = CASE 
    -- Línguas
    WHEN nome ILIKE 'Língua Portuguesa%' OR nome ILIKE 'Portugues%' OR nome ILIKE 'Português%' THEN 'POR'
    WHEN nome ILIKE 'Língua Inglesa%' OR nome ILIKE 'Inglês%' OR nome ILIKE 'Ingles%' THEN 'ING'
    WHEN nome ILIKE 'Língua Francesa%' OR nome ILIKE 'Francês%' OR nome ILIKE 'Frances%' THEN 'FRA'
    
    -- Ciências Exatas
    WHEN nome ILIKE 'Matemática' OR nome ILIKE 'Matemática Geral' THEN 'MAT'
    WHEN nome ILIKE 'Física%' THEN 'FIS'
    WHEN nome ILIKE 'Química%' THEN 'QUI'
    WHEN nome ILIKE 'Biologia%' THEN 'BIO'
    
    -- Ciências Humanas / Sociais
    WHEN nome ILIKE 'História%' THEN 'HIS'
    WHEN nome ILIKE 'Geografia%' THEN 'GEO'
    WHEN nome ILIKE 'Filosofia%' THEN 'FIL'
    WHEN nome ILIKE 'Psicologia%' THEN 'PSI'
    WHEN nome ILIKE 'Sociologia%' THEN 'SOC'
    
    -- Técnicas e Diversas
    WHEN nome ILIKE 'Informática%' OR nome ILIKE 'Intro%Informática%' THEN 'INF'
    WHEN nome ILIKE 'Empreendedorismo%' THEN 'EMP'
    WHEN nome ILIKE 'Educação Física%' THEN 'EF'
    WHEN nome ILIKE 'Desenho Técnico%' THEN 'DTEC'
    WHEN nome ILIKE 'Desenho e Geometria%' OR nome ILIKE 'DGD%' THEN 'DGD'
    WHEN nome ILIKE 'Educação Moral%' OR nome ILIKE 'EMC%' THEN 'EMC'
    WHEN nome ILIKE 'Organização e Gestão%' OR nome ILIKE 'OGE%' THEN 'OGE'
    WHEN nome ILIKE 'Técnicas de Linguagem%' OR nome ILIKE 'TLP%' THEN 'TLP'
    WHEN nome ILIKE 'Sistema%Apoio%Decisão%' OR nome ILIKE 'SEAC%' THEN 'SEAC'
    
    -- Se não casar com nada, mantém o que já tinha (ou NULL)
    ELSE sigla 
END
WHERE sigla IS NULL; -- Só mexe em quem está vazio

-- 3. Auditoria (Ver o que ficou sem sigla)
-- Rode isso depois para ver quais disciplinas "exóticas" sobraram sem código
-- SELECT nome, sigla FROM disciplinas WHERE sigla IS NULL;

-- 4. Criar Índice de Performance (Opcional, mas recomendado para velocidade)
-- Isso garante que buscar uma disciplina pela sigla seja instantâneo (O(1))
CREATE INDEX IF NOT EXISTS idx_disciplinas_sigla 
ON public.disciplinas (escola_id, sigla);