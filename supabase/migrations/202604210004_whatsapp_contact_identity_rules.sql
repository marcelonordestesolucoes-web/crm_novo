-- WhatsApp identity rules:
-- - chats mirror WhatsApp Web identity
-- - groups are identified by group name
-- - unknown direct chats fallback to phone/chat identifier
-- - blocked contacts cannot create inbound messages

alter table public.contacts
  add column if not exists is_blocked boolean not null default false,
  add column if not exists blocked_at timestamptz,
  add column if not exists blocked_reason text;

create index if not exists idx_contacts_org_blocked
  on public.contacts(org_id, is_blocked)
  where is_blocked = true;
