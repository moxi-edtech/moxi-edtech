-- Migration: Automação de Promoção Staging -> Oficial
-- Data: 11/04/2026

-- 1. Função de Promoção
CREATE OR REPLACE FUNCTION public.fn_formacao_promote_staging_to_official()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_inscricao_id UUID;
BEGIN
    -- Só age quando o status muda para APROVADA
    IF (NEW.status = 'APROVADA' AND (OLD.status = 'PENDENTE' OR OLD.status IS NULL)) THEN
        
        -- 1. Tentar encontrar o user_id pelo email
        SELECT id INTO v_user_id FROM auth.users WHERE email = NEW.email;
        
        IF v_user_id IS NULL THEN
            -- Se não houver email, tenta pelo telefone/BI se necessário, mas o email é o padrão auth
            RAISE EXCEPTION 'Usuário com email % não encontrado no auth.users. A API deve criar o usuário antes de aprovar.', NEW.email;
        END IF;

        -- 2. Upsert no Perfil (Garante que os dados do staging reflitam no perfil oficial)
        -- Usamos a função existente do projeto
        PERFORM public.formacao_upsert_formando_profile(
            NEW.escola_id,
            v_user_id,
            NEW.nome_completo,
            NEW.email,
            NEW.bi_passaporte,
            NEW.telefone
        );

        -- 3. Criar Inscrição Oficial
        -- Nota: A RPC formacao_create_inscricao lida com lotação e snapshot de dados
        SELECT public.formacao_create_inscricao(
            NEW.escola_id,
            NEW.cohort_id,
            v_user_id,
            'self_service', -- Origem
            'presencial',   -- Modalidade padrão para admissões web (pode ser parametrizada)
            NULL,           -- created_by
            NEW.nome_completo,
            NEW.email,
            NEW.bi_passaporte,
            NEW.telefone,
            0               -- valor_cobrado (considerado pago via staging/comprovativo)
        ) INTO v_inscricao_id;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar o Trigger
DROP TRIGGER IF EXISTS tr_formacao_promote_staging ON public.formacao_inscricoes_staging;
CREATE TRIGGER tr_formacao_promote_staging
AFTER UPDATE ON public.formacao_inscricoes_staging
FOR EACH ROW
WHEN (NEW.status = 'APROVADA' AND OLD.status IS DISTINCT FROM 'APROVADA')
EXECUTE FUNCTION public.fn_formacao_promote_staging_to_official();
