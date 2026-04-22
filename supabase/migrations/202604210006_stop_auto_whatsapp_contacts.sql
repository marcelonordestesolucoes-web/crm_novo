-- Stop treating every WhatsApp conversation as a CRM contact/company.
-- WhatsApp-only identities stay in deal_conversations/whatsapp_thread_aliases.
-- Contacts are created only when the user qualifies the lead into pipeline.

delete from public.contacts c
where c.is_auto_created = true
  and not exists (
    select 1 from public.deal_contacts dc where dc.contact_id = c.id
  )
  and not exists (
    select 1 from public.campaign_leads cl where cl.contact_id = c.id
  );
