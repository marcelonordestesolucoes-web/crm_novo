-- ============================================================
--  STITCH CRM — Fase: Identidade Real (Chat ID)
--  Separação definitiva entre Conversa e Remetente.
-- ============================================================

-- 1. ADICIONA A COLUNA CHAT_ID PARA SER A ÂNCORA DA CONVERSA
ALTER TABLE public.deal_conversations 
ADD COLUMN IF NOT EXISTS chat_id TEXT;

-- 2. CRIA UM ÍNDICE PARA VELOCIDADE DE BUSCA
CREATE INDEX IF NOT EXISTS idx_deal_conv_chat_id ON public.deal_conversations(chat_id);

-- 3. REPARO RETROATIVO: Popula o chat_id baseado no sender_phone para não perder histórico
UPDATE public.deal_conversations 
SET chat_id = sender_phone 
WHERE chat_id IS NULL AND sender_phone IS NOT NULL;

-- 4. COMENTÁRIO DE AUDITORIA
COMMENT ON COLUMN public.deal_conversations.chat_id IS 'Identificador único da conversa (from/remoteJid do WhatsApp)';
