-- ============================================================
--  STITCH CRM — Fix WhatsApp Group Persistence & Schema Sync
--  Corrige o problema de grupos aparecendo duplicados e mensagens sumindo.
-- ============================================================

-- 1. ADIÇÃO DE COLUNAS ESSENCIAIS NA TABELA DEAL_CONVERSATIONS
-- Essas colunas são necessárias para o Webhook e para o Inbox Elite funcionarem.

ALTER TABLE public.deal_conversations 
ADD COLUMN IF NOT EXISTS sender_phone text,
ADD COLUMN IF NOT EXISTS sender_name text,
ADD COLUMN IF NOT EXISTS is_group boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text',
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_mime text;

-- 2. ÍNDICES DE PERFORMANCE (TURBO INBOX)
-- Garante que o agrupamento por telefone/grupo e por organização seja instantâneo.

CREATE INDEX IF NOT EXISTS idx_deal_conv_sender_phone ON public.deal_conversations(sender_phone);
CREATE INDEX IF NOT EXISTS idx_deal_conv_is_group ON public.deal_conversations(is_group);
CREATE INDEX IF NOT EXISTS idx_deal_conv_org_created ON public.deal_conversations(org_id, created_at DESC);

-- 3. COMENTÁRIOS DE AUDITORIA
COMMENT ON COLUMN public.deal_conversations.sender_phone IS 'ID do Agrupador (Telefone E.164 ou ID do Grupo @g.us)';
COMMENT ON COLUMN public.deal_conversations.sender_name IS 'Nome do remetente original (mesmo em grupos)';
COMMENT ON COLUMN public.deal_conversations.is_group IS 'Flag para identificar se a mensagem pertence a um grupo';

-- 4. VINCULAÇÃO RETROATIVA (OPCIONAL/BOA PRÁTICA)
-- Tenta preencher org_id em mensagens que podem estar sem (se houver).
-- UPDATE public.deal_conversations dc
-- SET org_id = d.org_id
-- FROM public.deals d
-- WHERE dc.deal_id = d.id AND dc.org_id IS NULL;
