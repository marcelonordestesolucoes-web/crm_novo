-- ============================================================
--  STITCH CRM — Oracle v4.0 Persistence Fix
--  Garante que o Oráculo consiga gravar dados de IA e o vendedor salve a qualificação.
-- ============================================================

-- 1. ADICIONAR COLUNAS DE QUALIFICAÇÃO E IA NA TABELA DE NEGÓCIOS
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS qualification jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ai_closing_probability numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_probability_delta numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_temperature text DEFAULT 'neutral',
ADD COLUMN IF NOT EXISTS ai_objection_pattern text,
ADD COLUMN IF NOT EXISTS ai_next_step_timing text,
ADD COLUMN IF NOT EXISTS ai_last_analysis_at timestamptz;

-- 2. ÍNDICES DE PERFORMANCE PARA AS NOVAS COLUNAS
CREATE INDEX IF NOT EXISTS idx_deals_ai_closing_probability ON public.deals(ai_closing_probability);
CREATE INDEX IF NOT EXISTS idx_deals_ai_last_analysis_at ON public.deals(ai_last_analysis_at);

-- 3. COMENTÁRIOS PARA AUDITORIA
COMMENT ON COLUMN public.deals.qualification IS 'Dados do questionário de qualificação estruturado';
COMMENT ON COLUMN public.deals.ai_closing_probability IS 'Score preditivo de fechamento (0-100)';
COMMENT ON COLUMN public.deals.ai_temperature IS 'Status de clima do negócio (hot, warm, cool, risk)';
