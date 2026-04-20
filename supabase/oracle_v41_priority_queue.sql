-- ============================================================
--  STITCH CRM — Oracle v4.1: Priorização Inteligente
--  Suporte para Fila de Ação Imediata e Ranking de Deals
-- ============================================================

-- 1. ADICIONAR COLUNAS DE SCORE E TEMPO
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS ai_priority_score numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz DEFAULT now();

-- 2. INDEXAR PARA PERFORMANCE NO DASHBOARD
CREATE INDEX IF NOT EXISTS idx_deals_priority ON public.deals(ai_priority_score DESC);

-- 3. INICIALIZAR DADOS EXISTENTES (Para não começar vazio)
UPDATE public.deals 
SET last_interaction_at = COALESCE(ai_last_analysis_at, created_at) 
WHERE last_interaction_at IS NULL;

-- 4. COMENTÁRIO DE AUDITORIA
COMMENT ON COLUMN public.deals.ai_priority_score IS 'Ranking elite que combina Probabilidade, Valor e Recência (0-100)';
