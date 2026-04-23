-- Stage 2: safe campaign worker control fields.
-- Keeps the existing schema compatible and only adds execution metadata.

begin;

alter table public.campaigns
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists pause_reason text,
  add column if not exists last_dispatch_at timestamptz,
  add column if not exists next_dispatch_at timestamptz,
  add column if not exists worker_lock_until timestamptz,
  add column if not exists worker_lock_by text,
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists max_consecutive_failures integer not null default 3,
  add column if not exists failure_rate_stop_threshold numeric(5,2) not null default 35.00,
  add column if not exists worker_last_error text;

create index if not exists idx_campaigns_worker_status
  on public.campaigns(org_id, status, next_dispatch_at);

create index if not exists idx_campaign_dispatch_queue_due
  on public.campaign_dispatch_queue(org_id, campaign_id, status, scheduled_for, created_at);

create index if not exists idx_campaign_dispatch_queue_locked
  on public.campaign_dispatch_queue(locked_at, locked_by)
  where status = 'sending';

commit;
