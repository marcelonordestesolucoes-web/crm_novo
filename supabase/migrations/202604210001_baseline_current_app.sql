-- Stitch CRM consolidated baseline schema.
-- Goal: one compatible source of truth for the current React/Supabase app.
-- This migration is intentionally additive/idempotent: no destructive drops.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Identity / tenant core
-- ---------------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp_token text unique,
  ai_enabled boolean default true,
  ai_feature_enabled boolean default true,
  ai_used integer default 0,
  ai_quota integer default 500,
  ai_processed integer default 0,
  ai_saved_by_filter integer default 0,
  ai_rate_limit integer default 10,
  ai_calls_in_window integer default 0,
  ai_window_start timestamptz default now(),
  ai_reset_at timestamptz default (now() + interval '30 days'),
  influence_window_hours integer default 6,
  plan_name text default 'basic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_org_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select m.org_id
  from public.memberships m
  where m.user_id = auth.uid()
  order by m.created_at asc
  limit 1
$$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
  )
$$;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CRM master data
-- ---------------------------------------------------------------------------

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade default public.current_org_id(),
  user_id uuid references auth.users(id) on delete set null,
  responsible_id uuid references auth.users(id) on delete set null,
  name text not null,
  stage text default 'Cliente Ativo',
  sector text,
  segment text,
  tax_id text,
  cnpj text,
  score integer not null default 0,
  logo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade default public.current_org_id(),
  user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  avatar text,
  avatar_url text,
  role text,
  company text,
  email text,
  phone text,
  owner text,
  owner_avatar text,
  is_auto_created boolean default false,
  is_blocked boolean not null default false,
  blocked_at timestamptz,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade default public.current_org_id(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  label text not null,
  color text default 'bg-slate-500',
  sort_order integer not null default 10,
  created_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade default public.current_org_id(),
  organization_id uuid references public.organizations(id) on delete cascade,
  pipeline_id uuid references public.pipelines(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  responsible_id uuid references auth.users(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  company text,
  value numeric(14,2) not null default 0,
  stage text not null default 'lead',
  status text not null default 'open',
  tags text[],
  product jsonb default '[]'::jsonb,
  qualification jsonb default '{}'::jsonb,
  is_qualified boolean default true,
  last_interaction_at timestamptz,
  ai_closing_probability integer default 0,
  ai_probability_delta integer default 0,
  ai_temperature text default 'neutral',
  ai_objection_pattern text,
  ai_next_step_timing text,
  ai_priority_score integer default 0,
  ai_global_analysis jsonb,
  ai_last_analysis_at timestamptz,
  last_ai_insight jsonb default '{}'::jsonb,
  last_ai_insight_at timestamptz,
  last_ai_message_id uuid,
  ai_confidence numeric default 0,
  ai_last_updated_at timestamptz,
  ai_blocked boolean default false,
  ai_blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_contacts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (deal_id, contact_id)
);

-- ---------------------------------------------------------------------------
-- Activity, tasks, notes, attachments
-- ---------------------------------------------------------------------------

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade default public.current_org_id(),
  user_id uuid references auth.users(id) on delete set null,
  deal_id uuid references public.deals(id) on delete cascade,
  title text not null,
  status text not null default 'pending',
  priority text not null default 'medium',
  type text not null default 'task',
  due_date date,
  due_time text,
  assigned_to_avatars text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_notes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_attachments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  url text not null,
  file_type text,
  size bigint,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.deal_timeline (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Messaging
-- deal_conversations is the active inbox/chat model used by the frontend.
-- conversations/messages are retained as legacy AI queue compatibility tables.
-- ---------------------------------------------------------------------------

create table if not exists public.deal_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade default public.current_org_id(),
  deal_id uuid references public.deals(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  chat_id text,
  sender_phone text,
  sender_name text,
  content text not null,
  sender_type text not null default 'client',
  source text not null default 'manual',
  external_message_id text,
  is_group boolean default false,
  message_type text default 'text',
  media_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade default public.current_org_id(),
  phone text not null,
  source text not null default 'whatsapp',
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  status text not null default 'active',
  last_message_at timestamptz default now(),
  last_inbound_message_at timestamptz,
  last_outbound_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade default public.current_org_id(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  contact_id uuid references public.contacts(id),
  deal_id uuid references public.deals(id),
  wa_id text,
  source text not null default 'whatsapp',
  external_timestamp timestamptz,
  direction text check (direction in ('inbound', 'outbound')),
  content text,
  message_type text default 'text',
  status text default 'received',
  metadata jsonb default '{}'::jsonb,
  ai_status text default 'pending_ai',
  priority_score numeric default 0,
  priority_level text default 'normal',
  retry_count integer default 0,
  last_retry_at timestamptz,
  created_at timestamptz not null default now(),
  unique (wa_id, source)
);

-- ---------------------------------------------------------------------------
-- Campaigns and goals
-- ---------------------------------------------------------------------------

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade default public.current_org_id(),
  name text not null,
  message_template text not null,
  min_delay integer default 30,
  max_delay integer default 90,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  status text not null default 'pending',
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.org_goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  amount numeric(14,2) not null default 0,
  month integer not null check (month between 1 and 12),
  year integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, month, year)
);

create table if not exists public.member_goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null default 0,
  month integer not null check (month between 1 and 12),
  year integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, month, year)
);

-- ---------------------------------------------------------------------------
-- AI observability and usage
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  usage_date date not null default current_date,
  ai_used integer default 0,
  ai_saved_by_filter integer default 0,
  created_at timestamptz not null default now(),
  unique (org_id, usage_date)
);

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  event_type text not null,
  ai_strategy_category text,
  ai_outcome text default 'pending',
  previous_value numeric(14,2),
  new_value numeric(14,2),
  value_delta numeric(14,2),
  influenced_by_ai boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete cascade,
  deal_conversation_id uuid references public.deal_conversations(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('positive', 'negative')),
  error_type text,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_strategy_performance (
  org_id uuid references public.organizations(id) on delete cascade,
  strategy_category text not null,
  success_count integer default 0,
  total_count integer default 0,
  updated_at timestamptz default now(),
  primary key (org_id, strategy_category)
);

create table if not exists public.ai_usage_monthly_aggregate (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  month date not null,
  ai_used integer default 0,
  ai_saved_by_filter integer default 0,
  created_at timestamptz not null default now(),
  unique (org_id, month)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists idx_memberships_user_id on public.memberships(user_id);
create index if not exists idx_memberships_org_id on public.memberships(org_id);
create index if not exists idx_companies_org_id on public.companies(org_id);
create index if not exists idx_contacts_org_phone on public.contacts(org_id, phone);
create index if not exists idx_pipelines_org_id on public.pipelines(org_id);
create index if not exists idx_pipeline_stages_pipeline on public.pipeline_stages(pipeline_id, sort_order);
create index if not exists idx_deals_org_stage on public.deals(org_id, stage);
create index if not exists idx_deals_responsible on public.deals(responsible_id);
create index if not exists idx_deal_contacts_deal on public.deal_contacts(deal_id);
create index if not exists idx_tasks_org_user on public.tasks(org_id, user_id);
create index if not exists idx_deal_notes_deal on public.deal_notes(deal_id);
create index if not exists idx_deal_attachments_deal on public.deal_attachments(deal_id);
create index if not exists idx_deal_timeline_deal_created on public.deal_timeline(deal_id, created_at desc);
create index if not exists idx_deal_conv_org_created on public.deal_conversations(org_id, created_at desc);
create index if not exists idx_deal_conv_chat_id on public.deal_conversations(chat_id);
create index if not exists idx_deal_conv_deal_created on public.deal_conversations(deal_id, created_at desc);
create index if not exists idx_deal_conv_sender_phone on public.deal_conversations(sender_phone);
create index if not exists idx_messages_ai_status_priority on public.messages(ai_status, priority_score desc);
create index if not exists idx_messages_org_retry on public.messages(org_id, retry_count);
create index if not exists idx_user_events_org_type on public.user_events(org_id, event_type);
create index if not exists idx_user_events_strategy on public.user_events(ai_strategy_category);
create index if not exists idx_ai_feedback_org on public.ai_feedback(org_id);
create unique index if not exists uniq_deal_conv_org_external_message
  on public.deal_conversations(org_id, external_message_id)
  where external_message_id is not null;
create unique index if not exists uniq_active_conversation_per_phone
  on public.conversations(org_id, phone, source)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- RPCs used by the app/functions
-- ---------------------------------------------------------------------------

create or replace function public.increment_ai_usage_with_history(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organizations
  set ai_used = coalesce(ai_used, 0) + 1,
      ai_processed = coalesce(ai_processed, 0) + 1
  where id = p_org_id;

  insert into public.ai_usage_history (org_id, usage_date, ai_used)
  values (p_org_id, current_date, 1)
  on conflict (org_id, usage_date)
  do update set ai_used = public.ai_usage_history.ai_used + 1;
end;
$$;

create or replace function public.increment_ai_saved_by_filter_with_history(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organizations
  set ai_saved_by_filter = coalesce(ai_saved_by_filter, 0) + 1
  where id = p_org_id;

  insert into public.ai_usage_history (org_id, usage_date, ai_saved_by_filter)
  values (p_org_id, current_date, 1)
  on conflict (org_id, usage_date)
  do update set ai_saved_by_filter = public.ai_usage_history.ai_saved_by_filter + 1;
end;
$$;

create or replace function public.check_and_increment_ai_rate_limit(p_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_calls integer;
  v_window timestamptz;
begin
  select ai_rate_limit, ai_calls_in_window, ai_window_start
  into v_limit, v_calls, v_window
  from public.organizations
  where id = p_org_id
  for update;

  if v_window is null or v_window < now() - interval '1 minute' then
    update public.organizations
    set ai_window_start = now(), ai_calls_in_window = 1
    where id = p_org_id;
    return true;
  end if;

  if coalesce(v_calls, 0) >= coalesce(v_limit, 10) then
    return false;
  end if;

  update public.organizations
  set ai_calls_in_window = coalesce(ai_calls_in_window, 0) + 1
  where id = p_org_id;
  return true;
end;
$$;

create or replace function public.increment_strategy_total(p_org_id uuid, p_category text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_strategy_performance (org_id, strategy_category, total_count)
  values (p_org_id, p_category, 1)
  on conflict (org_id, strategy_category)
  do update set total_count = public.ai_strategy_performance.total_count + 1,
                updated_at = now();
end;
$$;

create or replace function public.increment_strategy_success(p_org_id uuid, p_category text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_strategy_performance (org_id, strategy_category, success_count, total_count)
  values (p_org_id, p_category, 1, 0)
  on conflict (org_id, strategy_category)
  do update set success_count = public.ai_strategy_performance.success_count + 1,
                updated_at = now();
end;
$$;

create or replace function public.get_ai_onboarding_progress(p_org_id uuid)
returns table (step1_done boolean, step2_done boolean, step3_done boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    exists (select 1 from public.deal_conversations where org_id = p_org_id),
    exists (
      select 1
      from public.deal_timeline dt
      join public.deals d on d.id = dt.deal_id
      where d.org_id = p_org_id and dt.type = 'stage_change'
    ),
    exists (
      select 1
      from public.user_events
      where org_id = p_org_id and event_type = 'ai_action_suggested'
    );
end;
$$;

create or replace function public.get_ai_validation_metrics_v2(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_insights bigint;
  v_total_clicks bigint;
  v_total_positive bigint;
  v_total_negative bigint;
  v_total_upsells bigint;
  v_total_value_delta numeric;
  v_seller_stats jsonb;
begin
  select count(*) into v_total_insights
  from public.user_events
  where org_id = p_org_id and event_type = 'ai_insight_viewed';

  select count(*) into v_total_clicks
  from public.user_events
  where org_id = p_org_id and event_type = 'ai_action_clicked';

  select count(*) filter (where event_type = 'ai_upsell'),
         coalesce(sum(value_delta) filter (where event_type = 'ai_upsell'), 0)
  into v_total_upsells, v_total_value_delta
  from public.user_events
  where org_id = p_org_id;

  select count(*) filter (where feedback_type = 'positive'),
         count(*) filter (where feedback_type = 'negative')
  into v_total_positive, v_total_negative
  from public.ai_feedback
  where org_id = p_org_id;

  select jsonb_agg(t) into v_seller_stats
  from (
    select
      p.id as user_id,
      p.full_name,
      count(e.id) filter (where e.event_type = 'ai_insight_viewed') as views,
      count(e.id) filter (where e.event_type = 'ai_action_clicked') as clicks,
      count(f.id) filter (where f.feedback_type = 'positive') as positive_feedbacks,
      coalesce(sum(e.value_delta) filter (where e.event_type = 'ai_upsell'), 0) as revenue_contribution
    from public.memberships m
    left join public.profiles p on p.id = m.user_id
    left join public.user_events e on e.user_id = m.user_id and e.org_id = p_org_id
    left join public.ai_feedback f on f.user_id = m.user_id and f.org_id = p_org_id
    where m.org_id = p_org_id
    group by p.id, p.full_name
    order by clicks desc
    limit 10
  ) t;

  return jsonb_build_object(
    'total_insights', v_total_insights,
    'total_clicks', v_total_clicks,
    'total_positive', v_total_positive,
    'total_negative', v_total_negative,
    'total_upsells', v_total_upsells,
    'total_value_delta', v_total_value_delta,
    'utility_rate', case when (v_total_positive + v_total_negative) > 0
      then (v_total_positive::float / (v_total_positive + v_total_negative)) * 100
      else 0 end,
    'click_rate', case when v_total_insights > 0
      then (v_total_clicks::float / v_total_insights) * 100
      else 0 end,
    'seller_stats', coalesce(v_seller_stats, '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage buckets expected by the frontend.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('deal-attachments', 'deal-attachments', true),
  ('whatsapp_media', 'whatsapp_media', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS. Keep service_role unaffected; authenticated users are scoped by org.
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.deal_contacts enable row level security;
alter table public.tasks enable row level security;
alter table public.deal_notes enable row level security;
alter table public.deal_attachments enable row level security;
alter table public.deal_timeline enable row level security;
alter table public.deal_conversations enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_leads enable row level security;
alter table public.org_goals enable row level security;
alter table public.member_goals enable row level security;
alter table public.ai_usage_history enable row level security;
alter table public.user_events enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.ai_strategy_performance enable row level security;
alter table public.ai_usage_monthly_aggregate enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles for select using (id = auth.uid());
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "memberships_member_select" on public.memberships;
create policy "memberships_member_select" on public.memberships for select using (
  user_id = auth.uid() or public.is_org_member(org_id)
);

drop policy if exists "organizations_member_select" on public.organizations;
create policy "organizations_member_select" on public.organizations for select using (public.is_org_member(id));
drop policy if exists "organizations_member_update" on public.organizations;
create policy "organizations_member_update" on public.organizations for update using (public.is_org_member(id)) with check (public.is_org_member(id));
drop policy if exists "organizations_auth_insert" on public.organizations;
create policy "organizations_auth_insert" on public.organizations for insert with check (auth.uid() is not null);

-- Direct org_id tables.
drop policy if exists "org_tables_select_companies" on public.companies;
create policy "org_tables_select_companies" on public.companies for select using (public.is_org_member(org_id));
drop policy if exists "org_tables_write_companies" on public.companies;
create policy "org_tables_write_companies" on public.companies for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "org_tables_select_contacts" on public.contacts;
create policy "org_tables_select_contacts" on public.contacts for select using (public.is_org_member(org_id));
drop policy if exists "org_tables_write_contacts" on public.contacts;
create policy "org_tables_write_contacts" on public.contacts for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "org_tables_select_pipelines" on public.pipelines;
create policy "org_tables_select_pipelines" on public.pipelines for select using (public.is_org_member(org_id));
drop policy if exists "org_tables_write_pipelines" on public.pipelines;
create policy "org_tables_write_pipelines" on public.pipelines for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "org_tables_select_deals" on public.deals;
create policy "org_tables_select_deals" on public.deals for select using (public.is_org_member(org_id));
drop policy if exists "org_tables_write_deals" on public.deals;
create policy "org_tables_write_deals" on public.deals for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "org_tables_select_tasks" on public.tasks;
create policy "org_tables_select_tasks" on public.tasks for select using (public.is_org_member(org_id));
drop policy if exists "org_tables_write_tasks" on public.tasks;
create policy "org_tables_write_tasks" on public.tasks for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "org_tables_select_deal_conversations" on public.deal_conversations;
create policy "org_tables_select_deal_conversations" on public.deal_conversations for select using (public.is_org_member(org_id));
drop policy if exists "org_tables_write_deal_conversations" on public.deal_conversations;
create policy "org_tables_write_deal_conversations" on public.deal_conversations for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "org_tables_select_campaigns" on public.campaigns;
create policy "org_tables_select_campaigns" on public.campaigns for select using (public.is_org_member(org_id));
drop policy if exists "org_tables_write_campaigns" on public.campaigns;
create policy "org_tables_write_campaigns" on public.campaigns for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- Derived-org tables.
drop policy if exists "pipeline_stages_by_pipeline" on public.pipeline_stages;
create policy "pipeline_stages_by_pipeline" on public.pipeline_stages for all using (
  exists (select 1 from public.pipelines p where p.id = pipeline_id and public.is_org_member(p.org_id))
) with check (
  exists (select 1 from public.pipelines p where p.id = pipeline_id and public.is_org_member(p.org_id))
);

drop policy if exists "deal_child_by_deal_contacts" on public.deal_contacts;
create policy "deal_child_by_deal_contacts" on public.deal_contacts for all using (
  exists (select 1 from public.deals d where d.id = deal_id and public.is_org_member(d.org_id))
) with check (
  exists (select 1 from public.deals d where d.id = deal_id and public.is_org_member(d.org_id))
);

drop policy if exists "deal_child_by_notes" on public.deal_notes;
create policy "deal_child_by_notes" on public.deal_notes for all using (
  exists (select 1 from public.deals d where d.id = deal_id and public.is_org_member(d.org_id))
) with check (
  exists (select 1 from public.deals d where d.id = deal_id and public.is_org_member(d.org_id))
);

drop policy if exists "deal_child_by_attachments" on public.deal_attachments;
create policy "deal_child_by_attachments" on public.deal_attachments for all using (
  exists (select 1 from public.deals d where d.id = deal_id and public.is_org_member(d.org_id))
) with check (
  exists (select 1 from public.deals d where d.id = deal_id and public.is_org_member(d.org_id))
);

drop policy if exists "deal_child_by_timeline" on public.deal_timeline;
create policy "deal_child_by_timeline" on public.deal_timeline for all using (
  exists (select 1 from public.deals d where d.id = deal_id and public.is_org_member(d.org_id))
) with check (
  exists (select 1 from public.deals d where d.id = deal_id and public.is_org_member(d.org_id))
);

drop policy if exists "campaign_leads_by_campaign" on public.campaign_leads;
create policy "campaign_leads_by_campaign" on public.campaign_leads for all using (
  exists (select 1 from public.campaigns c where c.id = campaign_id and public.is_org_member(c.org_id))
) with check (
  exists (select 1 from public.campaigns c where c.id = campaign_id and public.is_org_member(c.org_id))
);

-- Remaining direct org tables share simple policies.
drop policy if exists "org_scoped_all_invitations" on public.invitations;
create policy "org_scoped_all_invitations" on public.invitations for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists "org_scoped_all_conversations" on public.conversations;
create policy "org_scoped_all_conversations" on public.conversations for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists "org_scoped_all_messages" on public.messages;
create policy "org_scoped_all_messages" on public.messages for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists "org_scoped_all_org_goals" on public.org_goals;
create policy "org_scoped_all_org_goals" on public.org_goals for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists "org_scoped_all_member_goals" on public.member_goals;
create policy "org_scoped_all_member_goals" on public.member_goals for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists "org_scoped_all_ai_usage_history" on public.ai_usage_history;
create policy "org_scoped_all_ai_usage_history" on public.ai_usage_history for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists "org_scoped_all_user_events" on public.user_events;
create policy "org_scoped_all_user_events" on public.user_events for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists "org_scoped_all_ai_feedback" on public.ai_feedback;
create policy "org_scoped_all_ai_feedback" on public.ai_feedback for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists "org_scoped_all_ai_strategy_performance" on public.ai_strategy_performance;
create policy "org_scoped_all_ai_strategy_performance" on public.ai_strategy_performance for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists "org_scoped_all_ai_usage_monthly_aggregate" on public.ai_usage_monthly_aggregate;
create policy "org_scoped_all_ai_usage_monthly_aggregate" on public.ai_usage_monthly_aggregate for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- Public read/write storage policies for current frontend behavior.
drop policy if exists "authenticated can read public crm buckets" on storage.objects;
create policy "authenticated can read public crm buckets" on storage.objects
for select to authenticated
using (bucket_id in ('avatars', 'deal-attachments', 'whatsapp_media'));

drop policy if exists "authenticated can upload public crm buckets" on storage.objects;
create policy "authenticated can upload public crm buckets" on storage.objects
for insert to authenticated
with check (bucket_id in ('avatars', 'deal-attachments', 'whatsapp_media'));

drop policy if exists "authenticated can update public crm buckets" on storage.objects;
create policy "authenticated can update public crm buckets" on storage.objects
for update to authenticated
using (bucket_id in ('avatars', 'deal-attachments', 'whatsapp_media'))
with check (bucket_id in ('avatars', 'deal-attachments', 'whatsapp_media'));

drop policy if exists "authenticated can delete public crm buckets" on storage.objects;
create policy "authenticated can delete public crm buckets" on storage.objects
for delete to authenticated
using (bucket_id in ('avatars', 'deal-attachments', 'whatsapp_media'));
