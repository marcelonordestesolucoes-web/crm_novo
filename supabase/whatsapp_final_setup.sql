-- ============================================================
--  STITCH CRM — WhatsApp Final Integration Setup (Z-API)
--  Segurança, Idempotência e Smart Deal Matching
-- ============================================================

-- 1. SEGURANÇA: Token de Autenticação para Webhook
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS whatsapp_token text UNIQUE;

COMMENT ON COLUMN public.organizations.whatsapp_token IS 'Token secreto para validar requisições da Z-API (Bearer Token)';

-- 2. INFRAESTRUTURA DE CONVERSAS: Idempotência e Multi-tenancy
ALTER TABLE public.deal_conversations
ADD COLUMN IF NOT EXISTS external_message_id text,
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 3. ÍNDICE DE IDEMPOTÊNCIA (Evita duplicados por re-envio da API)
-- Garantimos que para a mesma organização, IDs de mensagens externas não se repitam.
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_conv_idempotency 
ON public.deal_conversations (org_id, external_message_id) 
WHERE external_message_id IS NOT NULL;

-- 4. ÍNDICES DE PERFORMANCE PARA SMART MATCHING
CREATE INDEX IF NOT EXISTS idx_deal_conv_org_id ON public.deal_conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_deals_smart_match ON public.deals(status, created_at DESC);

-- Exemplo de uso:
-- UPDATE public.organizations SET whatsapp_token = 'SUA_CHAVE_SECRETA_AQUI' WHERE id = 'ID_DA_ORGA';
