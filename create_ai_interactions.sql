CREATE TABLE IF NOT EXISTS public.ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created_task', 'completed_task')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org interactions"
ON public.ai_interactions
FOR SELECT
USING (
    org_id IN (
        SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert org interactions"
ON public.ai_interactions
FOR INSERT
WITH CHECK (
    org_id IN (
        SELECT org_id FROM public.memberships WHERE user_id = auth.uid()
    )
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_ai_interactions_org_id 
ON public.ai_interactions(org_id);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_id 
ON public.ai_interactions(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_deal_id 
ON public.ai_interactions(deal_id);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_action 
ON public.ai_interactions(action);
