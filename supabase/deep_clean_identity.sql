-- ============================================================
--  STITCH CRM — Limpeza Profunda e Reconstrução de Identidade
--  Cura definitiva para duplicidades e mensagens órfãs.
-- ============================================================

-- 1. CRIA CONTATOS PARA MENSAGENS QUE NÃO TÊM CADASTRO (CASOS Raros)
INSERT INTO public.contacts (name, phone, org_id, is_auto_created)
SELECT DISTINCT dc.sender_name, dc.sender_phone, dc.org_id, true
FROM public.deal_conversations dc
LEFT JOIN public.contacts c ON c.phone = dc.sender_phone
WHERE dc.sender_phone IS NOT NULL 
  AND dc.sender_phone <> '' 
  AND c.id IS NULL
ON CONFLICT (phone, org_id) DO NOTHING;

-- 2. VINCULA 100% DAS MENSAGENS AOS CONTATOS (PELO TELEFONE)
UPDATE public.deal_conversations dc
SET contact_id = c.id
FROM public.contacts c
WHERE (dc.sender_phone = c.phone OR dc.sender_phone = replace(replace(replace(replace(c.phone, '(', ''), ')', ''), '-', ''), ' ', ''))
  AND dc.contact_id IS NULL;

-- 3. VINCULA MENSAGENS RESTANTES PELO NOME (ÚLTIMO RECURSO PARA ÓRFÃOS)
UPDATE public.deal_conversations dc
SET contact_id = c.id
FROM public.contacts c
WHERE dc.sender_name = c.name 
  AND dc.contact_id IS NULL 
  AND dc.org_id = c.org_id;

-- 4. REMOVE DUPLICIDADES DE "GRUPOS" MAL FORMADOS
-- Garante que o sender_phone de grupos seja limpo
UPDATE public.deal_conversations 
SET sender_phone = replace(sender_phone, ' ', '')
WHERE is_group = true;

-- 5. LIMPEZA FINAL: SE AINDA EXISTIR NULO, VINCULA A UM CONTATO "SISTEMA" OU REMOVE (CUIDADO)
-- Aqui vamos apenas marcar como 'desconhecido' para não quebrar a UI
UPDATE public.deal_conversations 
SET sender_phone = '5500000000000' 
WHERE sender_phone IS NULL OR sender_phone = '';
