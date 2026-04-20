-- ============================================================
--  STITCH CRM — Oracle v5.0 Master Setup
--  Cria a infraestrutura de rastreamento e aprendizado (Playbook)
-- ============================================================

-- 1. TABELA DE EVENTOS COMPORTAMENTAIS (TRACKING)
CREATE TABLE IF NOT EXISTS public.user_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
    event_type text NOT NULL, -- ai_action_suggested, ai_action_clicked, ai_message_copied, etc
    
    -- Metrificação V5 (Aprendizado)
    ai_strategy_category text, -- URGENCY, ROI, SOCIAL_PROOF, etc
    ai_outcome text DEFAULT 'pending', -- success, no_effect, pending
    
    -- Metrificação Financeira (Upsell)
    previous_value numeric(12,2),
    new_value numeric(12,2),
    value_delta numeric(12,2),
    influenced_by_ai boolean DEFAULT false,

    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 2. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_user_events_org_id_type ON public.user_events(org_id, event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_deal_id ON public.user_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_user_events_strategy ON public.user_events(ai_strategy_category);

-- 3. RLS & POLICIES (SEGURANÇA)
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org events" ON public.user_events;
CREATE POLICY "Users can view org events" ON public.user_events FOR SELECT 
USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert org events" ON public.user_events;
CREATE POLICY "Users can insert org events" ON public.user_events FOR INSERT 
WITH CHECK (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

-- 4. COMENTÁRIOS DE ESTRUTURA
COMMENT ON TABLE public.user_events IS 'Motor de aprendizado e rastreamento comportamental do Oráculo';
COMMENT ON COLUMN public.user_events.ai_strategy_category IS 'Categorias fixas: URGENCY, ROI, SOCIAL_PROOF, OBJECTION_HANDLING, NEXT_STEP';
