-- PASSO 2: Persistência de Conversas com Suporte a IA
-- Este script cria a estrutura necessária para salvar conversas coladas manualmente vinculadas aos deals.

create table if not exists deal_conversations (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  content text not null,
  sender_type text default 'client', -- cliente, vendedor, sistema
  source text default 'manual',      -- manual, whatsapp, etc
  metadata jsonb default '{}',       -- Armazenará análises da IA futuramente
  created_at timestamptz default now()
);

-- Índice para performance de busca por negócio
create index if not exists idx_deal_conversations_deal_id on deal_conversations(deal_id);

-- Comentários para documentação do schema
comment on table deal_conversations is 'Armazena trechos de conversas (WhatsApp/Link) vinculados a um negócio para análise de IA.';
comment on column deal_conversations.sender_type is 'Define quem enviou a mensagem (client, sales, system).';
