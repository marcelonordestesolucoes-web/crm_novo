-- ============================================================
--  STITCH CRM — Projeto Identidade Permanente
--  Cria o vínculo definitivo entre Mensagens e Contatos/Grupos.
-- ============================================================

-- 1. ADIÇÃO DO CAMPO CONTACT_ID NA TABELA DE CONVERSAS
-- Isso permite joins rápidos e precisos, independente de Negócios (Deals).

ALTER TABLE public.deal_conversations 
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deal_conv_contact_id ON public.deal_conversations(contact_id);

-- 2. REPARO RETROATIVO: VINCULAR MENSAGENS AOS CONTATOS PELO TELEFONE
-- Esse script vai "unir" as conversas que estão soltas aos seus donos.

UPDATE public.deal_conversations dc
SET contact_id = c.id
FROM public.contacts c
WHERE (dc.sender_phone = c.phone OR dc.sender_phone = replace(replace(replace(replace(c.phone, '(', ''), ')', ''), '-', ''), ' ', ''))
  AND dc.contact_id IS NULL;

-- 3. REPARO OPCIONAL: VINCULAR MENSAGENS PELO DEAL_CONTACTS (Caso o telefone falhe)
UPDATE public.deal_conversations dc
SET contact_id = dcl.contact_id
FROM public.deal_contacts dcl
WHERE dc.deal_id = dcl.deal_id AND dc.contact_id IS NULL;

-- 4. COMENTÁRIO DE AUDITORIA
COMMENT ON COLUMN public.deal_conversations.contact_id IS 'Vínculo direto com a tabela de contatos (Pessoas ou Grupos)';
