begin;

create table if not exists public.automation_flows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'geral',
  channel text not null default 'whatsapp',
  status text not null default 'inactive',
  flow_json jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_flow_logs (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.automation_flows(id) on delete cascade,
  level text not null default 'info',
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_flows_org_status_updated
  on public.automation_flows(org_id, status, updated_at desc);

create index if not exists idx_automation_flows_org_channel
  on public.automation_flows(org_id, channel);

create index if not exists idx_automation_flow_logs_flow_created
  on public.automation_flow_logs(flow_id, created_at desc);

alter table public.automation_flows enable row level security;
alter table public.automation_flow_logs enable row level security;

drop policy if exists "automation_flows_select_by_membership" on public.automation_flows;
create policy "automation_flows_select_by_membership"
  on public.automation_flows
  for select
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = automation_flows.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "automation_flows_insert_by_membership" on public.automation_flows;
create policy "automation_flows_insert_by_membership"
  on public.automation_flows
  for insert
  with check (
    exists (
      select 1
      from public.memberships m
      where m.org_id = automation_flows.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "automation_flows_update_by_membership" on public.automation_flows;
create policy "automation_flows_update_by_membership"
  on public.automation_flows
  for update
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = automation_flows.org_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.memberships m
      where m.org_id = automation_flows.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "automation_flows_delete_by_membership" on public.automation_flows;
create policy "automation_flows_delete_by_membership"
  on public.automation_flows
  for delete
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = automation_flows.org_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "automation_flow_logs_select_by_membership" on public.automation_flow_logs;
create policy "automation_flow_logs_select_by_membership"
  on public.automation_flow_logs
  for select
  using (
    exists (
      select 1
      from public.automation_flows f
      join public.memberships m
        on m.org_id = f.org_id
      where f.id = automation_flow_logs.flow_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "automation_flow_logs_insert_by_membership" on public.automation_flow_logs;
create policy "automation_flow_logs_insert_by_membership"
  on public.automation_flow_logs
  for insert
  with check (
    exists (
      select 1
      from public.automation_flows f
      join public.memberships m
        on m.org_id = f.org_id
      where f.id = automation_flow_logs.flow_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "automation_flow_logs_delete_by_membership" on public.automation_flow_logs;
create policy "automation_flow_logs_delete_by_membership"
  on public.automation_flow_logs
  for delete
  using (
    exists (
      select 1
      from public.automation_flows f
      join public.memberships m
        on m.org_id = f.org_id
      where f.id = automation_flow_logs.flow_id
        and m.user_id = auth.uid()
    )
  );

commit;
