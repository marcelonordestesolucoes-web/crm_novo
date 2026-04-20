-- Adiciona suporte para Armazenamento de Inteligência Global 360°
ALTER TABLE deals ADD COLUMN IF NOT EXISTS ai_global_analysis JSONB DEFAULT '{}';

-- Comentário para auditoria Elite
COMMENT ON COLUMN deals.ai_global_analysis IS 'Armazena o diagnóstico estratégico 360 do Oracle baseado no contexto completo da conversa.';
