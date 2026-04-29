begin;

create table if not exists public.automation_flow_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  flow_id uuid not null references public.automation_flows(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  current_node_id text not null,
  status text not null default 'active', -- active, paused, completed, cancelled
  variables jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists unique_active_session_per_contact on public.automation_flow_sessions(contact_id) where (status = 'active');

create index if not exists idx_flow_sessions_org_status on public.automation_flow_sessions(org_id, status);
create index if not exists idx_flow_sessions_contact on public.automation_flow_sessions(contact_id);

alter table public.automation_flow_sessions enable row level security;

drop policy if exists "automation_flow_sessions_select_by_membership" on public.automation_flow_sessions;
create policy "automation_flow_sessions_select_by_membership"
  on public.automation_flow_sessions
  for select
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = automation_flow_sessions.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "automation_flow_sessions_insert_by_membership" on public.automation_flow_sessions;
create policy "automation_flow_sessions_insert_by_membership"
  on public.automation_flow_sessions
  for insert
  with check (
    exists (
      select 1
      from public.memberships m
      where m.org_id = automation_flow_sessions.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "automation_flow_sessions_update_by_membership" on public.automation_flow_sessions;
create policy "automation_flow_sessions_update_by_membership"
  on public.automation_flow_sessions
  for update
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = automation_flow_sessions.org_id
        and m.user_id = auth.uid()
    )
  );

commit;
