ALTER TABLE public.deal_conversations ADD COLUMN IF NOT EXISTS sender_phone text;
CREATE INDEX IF NOT EXISTS idx_deal_conv_sender_phone ON public.deal_conversations(sender_phone);
