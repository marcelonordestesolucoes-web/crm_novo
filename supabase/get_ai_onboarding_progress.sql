-- ============================================================
--  STITCH CRM — Smart Dash v6.2: Onboarding Optimizer
--  Otimização de Performance para Tracker de Ativação
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_ai_onboarding_progress(p_org_id uuid)
RETURNS TABLE (
    step1_done boolean,
    step2_done boolean,
    step3_done boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) > 0 FROM public.deal_conversations WHERE org_id = p_org_id) as step1_done,
        (SELECT EXISTS (
            SELECT 1 FROM public.deal_timeline dt
            JOIN public.deals d ON d.id = dt.deal_id
            WHERE d.org_id = p_org_id AND dt.type = 'stage_change'
        )) as step2_done,
        (SELECT EXISTS (
            SELECT 1 FROM public.user_events 
            WHERE org_id = p_org_id AND event_type = 'ai_action_suggested'
        )) as step3_done;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_ai_onboarding_progress IS 'Retorna o progresso de ativação da IA em uma única chamada otimizada';
