-- ============================================================
--  STITCH CRM — Oracle v6.0: Adaptive Revenue Intelligence
--  Infraestrutura de Memória Estratégica e Aprendizado Local
-- ============================================================

-- 1. TABELA DE PERFORMANCE ESTRATÉGICA (MEMÓRIA CACHE POR ORG)
CREATE TABLE IF NOT EXISTS public.ai_strategy_performance (
    org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    strategy_category text NOT NULL, -- URGENCY, ROI, SOCIAL_PROOF, etc
    success_count integer DEFAULT 0,
    total_count integer DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (org_id, strategy_category)
);

-- 2. VIEW DE PERFORMANCE GLOBAL (SABEDORIA COLETIVA)
CREATE OR REPLACE VIEW public.v_global_strategy_performance AS
SELECT 
    ai_strategy_category,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE ai_outcome = 'success') as success_count,
    ROUND(COALESCE(COUNT(*) FILTER (WHERE ai_outcome = 'success')::numeric / NULLIF(COUNT(*), 0), 0) * 100, 2) as success_rate
FROM public.user_events
WHERE ai_strategy_category IS NOT NULL
GROUP BY ai_strategy_category;

-- 3. RPC PARA INCREMENTO ATÔMICO DE PARTICIPAÇÃO (TOTAL)
CREATE OR REPLACE FUNCTION public.increment_strategy_total(p_org_id uuid, p_category text)
RETURNS void AS $$
BEGIN
    INSERT INTO public.ai_strategy_performance (org_id, strategy_category, total_count)
    VALUES (p_org_id, p_category, 1)
    ON CONFLICT (org_id, strategy_category)
    DO UPDATE SET 
        total_count = public.ai_strategy_performance.total_count + 1,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- 4. RPC PARA INCREMENTO ATÔMICO DE SUCESSO
CREATE OR REPLACE FUNCTION public.increment_strategy_success(p_org_id uuid, p_category text)
RETURNS void AS $$
BEGIN
    UPDATE public.ai_strategy_performance
    SET 
        success_count = ai_strategy_performance.success_count + 1,
        updated_at = now()
    WHERE org_id = p_org_id AND strategy_category = p_category;
END;
$$ LANGUAGE plpgsql;

-- 5. SEGURANÇA (RLS)
ALTER TABLE public.ai_strategy_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org strategy performance" ON public.ai_strategy_performance;
CREATE POLICY "Users can view org strategy performance" ON public.ai_strategy_performance FOR SELECT 
USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

-- 6. COMENTÁRIOS
COMMENT ON TABLE public.ai_strategy_performance IS 'Memória estratégica local da organização para otimização da IA';
