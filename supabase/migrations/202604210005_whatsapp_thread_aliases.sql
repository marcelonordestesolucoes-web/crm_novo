-- Canonical WhatsApp threads.
-- A single human/group can appear as phone, @lid, @c.us, or @g.us depending on
-- the callback type. This table keeps those aliases attached to one thread.

create table if not exists public.whatsapp_thread_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  thread_key text not null,
  alias text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, alias)
);

create index if not exists idx_whatsapp_thread_aliases_thread
  on public.whatsapp_thread_aliases(org_id, thread_key);

alter table public.whatsapp_thread_aliases enable row level security;

drop policy if exists "org_tables_select_whatsapp_thread_aliases" on public.whatsapp_thread_aliases;
create policy "org_tables_select_whatsapp_thread_aliases"
  on public.whatsapp_thread_aliases
  for select
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = whatsapp_thread_aliases.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "org_tables_write_whatsapp_thread_aliases" on public.whatsapp_thread_aliases;
create policy "org_tables_write_whatsapp_thread_aliases"
  on public.whatsapp_thread_aliases
  for all
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = whatsapp_thread_aliases.org_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.memberships m
      where m.org_id = whatsapp_thread_aliases.org_id
        and m.user_id = auth.uid()
    )
  );
