-- ============================================================
--  STITCH CRM — Fase: Identidade Blindada
--  Observabilidade total e trava de segurança no banco.
-- ============================================================

-- 1. TABELA DE LOGS (CAIXA-PRETA DO WEBHOOK)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid REFERENCES public.organizations(id),
    payload jsonb,
    status text,
    error_message text,
    sender_phone text,
    created_at timestamptz DEFAULT now()
);

-- 2. LIMPEZA DE DUPLICIDADES EM CONTACTS
-- Antes de aplicar a trava, precisamos garantir que não existam dois contatos com o mesmo telefone por organização.
-- Vamos deletar os mais antigos que possuem telefone duplicado.
DELETE FROM public.contacts c1
USING public.contacts c2
WHERE c1.id > c2.id 
  AND c1.phone = c2.phone 
  AND c1.org_id = c2.org_id
  AND c1.phone IS NOT NULL 
  AND c1.phone <> '';

-- 3. ADIÇÃO DE RESTRIÇÃO DE UNICIDADE
-- Garante que o erro de "troca de nomes" nunca mais aconteça.
ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_phone_org_id_unique UNIQUE (phone, org_id);

-- 4. REMOÇÃO DO NÚMERO FANTASMA (REMENDO ANTERIOR)
-- Desvincula as mensagens que foram "jogadas" na Juliana indevidamente.
UPDATE public.deal_conversations 
SET sender_phone = NULL, contact_id = NULL 
WHERE sender_phone = '5500000000000';

-- 5. ÍNDICE DE BUSCA POR JID (ELITE)
CREATE INDEX IF NOT EXISTS idx_deal_conv_ext_msg_id ON public.deal_conversations(external_message_id);
