-- ============================================================
--  STITCH CRM — Oracle v5.0: Playbook Automático (Aprendizado)
--  Infraestrutura para rastreamento de conversão por estratégia
-- ============================================================

-- 1. EXPANDIR RASTREAMENTO COMPORTAMENTAL
ALTER TABLE public.user_events 
ADD COLUMN IF NOT EXISTS ai_strategy_category text,
ADD COLUMN IF NOT EXISTS ai_outcome text DEFAULT 'pending';

-- 2. INDEXAR PARA ANALYTICS RÁPIDO
CREATE INDEX IF NOT EXISTS idx_user_events_strategy ON public.user_events(ai_strategy_category);
CREATE INDEX IF NOT EXISTS idx_user_events_outcome ON public.user_events(ai_outcome);

-- 3. COMENTÁRIOS DE ESTRUTURA
COMMENT ON COLUMN public.user_events.ai_strategy_category IS 'Categorias fixas: URGENCY, ROI, SOCIAL_PROOF, OBJECTION_HANDLING, NEXT_STEP';
COMMENT ON COLUMN public.user_events.ai_outcome IS 'Resultados: success, no_effect, pending';
