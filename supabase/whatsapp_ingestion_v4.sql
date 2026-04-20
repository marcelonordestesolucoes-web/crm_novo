-- ============================================================
--  STITCH CRM — WhatsApp Elite Ingestion Schema (v4)
--  Arquitetura 10/10: Idempotência, Ordem e Concorrência
-- ============================================================

-- 1. EXTENSÃO DE CONTATOS
alter table if exists contacts add column if not exists is_auto_created boolean default false;
create index if not exists idx_contacts_phone on contacts(phone);

-- 2. TABELA DE CONVERSAS (Omnichannel Ready)
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  phone text not null,                -- Padrão E.164 bruto da Meta
  source text not null default 'whatsapp',
  contact_id uuid references contacts(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived')),
  last_message_at timestamptz default now(),
  last_inbound_message_at timestamptz,
  last_outbound_message_at timestamptz,
  created_at timestamptz default now()
);

-- Trava de Segurança: Apenas UMA conversa ativa por telefone/canal
create unique index if not exists uniq_active_conversation_per_phone 
on conversations(phone, source) 
where status = 'active';

create index if not exists idx_conversations_phone on conversations(phone);

-- 3. TABELA DE MENSAGENS (Idempotência e Performance)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  contact_id uuid references contacts(id),
  deal_id uuid references deals(id),
  wa_id text not null,                -- ID da Meta
  source text not null default 'whatsapp',
  external_timestamp timestamptz,     -- Ordem cronológica real
  direction text not null check (direction in ('inbound', 'outbound')),
  content text,
  message_type text default 'text',   -- text, image, audio, etc.
  status text default 'received' check (status in ('sent', 'delivered', 'read', 'received', 'failed')),
  metadata jsonb default '{}',         -- Preparado para camada de IA (Phase 2)
  created_at timestamptz default now(),
  unique (wa_id, source)              -- Idempotência Global
);

create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_messages_external_timestamp on messages(external_timestamp);
create index if not exists idx_messages_wa_id_source on messages(wa_id, source);
