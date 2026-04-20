-- 1. CORREÇÃO DA TABELA DE CONTATOS (Para Webhook WhatsApp)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_auto_created boolean DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- 2. GARANTIR QUE OS DEALS TAMBÉM TENHAM ORG_ID (Caso não tenham)
-- ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- 3. CRIAR ÍNDICE DE PERFORMANCE PARA O INBOX (DISTINCT ON)
CREATE INDEX IF NOT EXISTS idx_deal_conversations_org_deal_created 
ON public.deal_conversations (org_id, deal_id, created_at DESC);
