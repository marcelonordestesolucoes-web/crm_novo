-- ============================================================
--  STITCH CRM — Reparo de Infraestrutura (Health Check)
--  Garante que todas as colunas de IA existam na tabela organizations.
-- ============================================================

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS ai_quota integer DEFAULT 500,
ADD COLUMN IF NOT EXISTS ai_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_processed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_saved_by_filter integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_reset_at timestamptz DEFAULT (now() + interval '30 days'),
ADD COLUMN IF NOT EXISTS ai_rate_limit integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS plan_name text DEFAULT 'Pro',
ADD COLUMN IF NOT EXISTS ai_calls_in_window integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_window_started_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS ai_feature_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS influence_window_hours integer DEFAULT 6;

-- Garantir que os contadores não sejam nulos para evitar erros matemáticos no JS
UPDATE public.organizations SET 
    ai_used = COALESCE(ai_used, 0),
    ai_processed = COALESCE(ai_processed, 0),
    ai_saved_by_filter = COALESCE(ai_saved_by_filter, 0),
    ai_calls_in_window = COALESCE(ai_calls_in_window, 0);

-- Comentário para Auditoria
COMMENT ON COLUMN public.organizations.ai_used IS 'Uso total no ciclo atual de 30 dias';
COMMENT ON COLUMN public.organizations.ai_calls_in_window IS 'Contador para rate limit de 1 minuto';
