-- Stable WhatsApp identity layer.
-- A thread is the durable inbox anchor for one CRM contact inside one org.
-- The connected WhatsApp number is metadata, not the customer identity.

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'zapi',
  instance_id text,
  connected_phone text,
  status text not null default 'active',
  connected_at timestamptz,
  disconnected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, instance_id)
);

create table if not exists public.whatsapp_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'zapi',
  connection_id uuid references public.whatsapp_connections(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  chat_id text,
  customer_phone text,
  connected_phone text,
  is_group boolean not null default false,
  status text not null default 'open',
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, contact_id),
  unique (org_id, provider, chat_id)
);

alter table public.deal_conversations
  add column if not exists thread_id uuid references public.whatsapp_threads(id) on delete set null;

create index if not exists idx_whatsapp_connections_org_status
  on public.whatsapp_connections(org_id, provider, status);

create index if not exists idx_whatsapp_threads_org_contact
  on public.whatsapp_threads(org_id, contact_id);

create index if not exists idx_whatsapp_threads_org_chat
  on public.whatsapp_threads(org_id, chat_id);

create index if not exists idx_deal_conv_thread_created
  on public.deal_conversations(thread_id, created_at desc);

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_threads enable row level security;

drop policy if exists "org_tables_select_whatsapp_connections" on public.whatsapp_connections;
create policy "org_tables_select_whatsapp_connections"
  on public.whatsapp_connections for select
  using (
    exists (
      select 1 from public.memberships m
      where m.org_id = whatsapp_connections.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "org_tables_write_whatsapp_connections" on public.whatsapp_connections;
create policy "org_tables_write_whatsapp_connections"
  on public.whatsapp_connections for all
  using (
    exists (
      select 1 from public.memberships m
      where m.org_id = whatsapp_connections.org_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.org_id = whatsapp_connections.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "org_tables_select_whatsapp_threads" on public.whatsapp_threads;
create policy "org_tables_select_whatsapp_threads"
  on public.whatsapp_threads for select
  using (
    exists (
      select 1 from public.memberships m
      where m.org_id = whatsapp_threads.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "org_tables_write_whatsapp_threads" on public.whatsapp_threads;
create policy "org_tables_write_whatsapp_threads"
  on public.whatsapp_threads for all
  using (
    exists (
      select 1 from public.memberships m
      where m.org_id = whatsapp_threads.org_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.org_id = whatsapp_threads.org_id
        and m.user_id = auth.uid()
    )
  );

insert into public.whatsapp_threads (
  org_id,
  provider,
  contact_id,
  chat_id,
  customer_phone,
  is_group,
  last_message_at
)
select distinct on (dc.org_id, dc.contact_id)
  dc.org_id,
  'zapi',
  dc.contact_id,
  dc.chat_id,
  regexp_replace(coalesce(dc.sender_phone, dc.chat_id, ''), '\D', '', 'g'),
  coalesce(dc.is_group, false),
  dc.created_at
from public.deal_conversations dc
where dc.org_id is not null
  and dc.contact_id is not null
order by dc.org_id, dc.contact_id, dc.created_at desc
on conflict (org_id, provider, contact_id) do update
set
  chat_id = coalesce(excluded.chat_id, public.whatsapp_threads.chat_id),
  customer_phone = coalesce(excluded.customer_phone, public.whatsapp_threads.customer_phone),
  last_message_at = greatest(coalesce(public.whatsapp_threads.last_message_at, excluded.last_message_at), excluded.last_message_at),
  updated_at = now();

insert into public.whatsapp_threads (
  org_id,
  provider,
  chat_id,
  customer_phone,
  is_group,
  last_message_at
)
select distinct on (dc.org_id, dc.chat_id)
  dc.org_id,
  'zapi',
  dc.chat_id,
  regexp_replace(coalesce(dc.sender_phone, dc.chat_id, ''), '\D', '', 'g'),
  coalesce(dc.is_group, false),
  dc.created_at
from public.deal_conversations dc
where dc.org_id is not null
  and dc.contact_id is null
  and dc.chat_id is not null
order by dc.org_id, dc.chat_id, dc.created_at desc
on conflict (org_id, provider, chat_id) do update
set
  customer_phone = coalesce(excluded.customer_phone, public.whatsapp_threads.customer_phone),
  last_message_at = greatest(coalesce(public.whatsapp_threads.last_message_at, excluded.last_message_at), excluded.last_message_at),
  updated_at = now();

update public.deal_conversations dc
set thread_id = wt.id
from public.whatsapp_threads wt
where dc.thread_id is null
  and dc.org_id = wt.org_id
  and wt.provider = 'zapi'
  and (
    (dc.contact_id is not null and dc.contact_id = wt.contact_id)
    or (dc.contact_id is null and dc.chat_id is not null and dc.chat_id = wt.chat_id)
  );
