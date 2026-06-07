-- Create aluno_push_subscriptions table
CREATE TABLE IF NOT EXISTS public.aluno_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    escola_id UUID NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.aluno_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own subscriptions"
    ON public.aluno_push_subscriptions
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_aluno_push_subscriptions_user_id ON public.aluno_push_subscriptions(user_id);
CREATE INDEX idx_aluno_push_subscriptions_escola_id ON public.aluno_push_subscriptions(escola_id);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_aluno_push_subscriptions
    BEFORE UPDATE ON public.aluno_push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Comment
COMMENT ON TABLE public.aluno_push_subscriptions IS 'Stores Web Push subscriptions for students and parents.';
