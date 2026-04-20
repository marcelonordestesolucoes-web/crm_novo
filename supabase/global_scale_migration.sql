-- ============================================================
--  STITCH CRM — Fase 4: Global Scale & Monetização
--  Schema de Mensagens, Prioridade e Agregação
-- ============================================================

-- 1. EXPANSÃO DE ORGANIZATIONS (Limites Dinâmicos)
alter table public.organizations add column if not exists ai_rate_limit integer default 10;
alter table public.organizations add column if not exists plan_name text default 'basic';

-- 2. EXPANSÃO DE MESSAGES (Fila e Priorização Multi-Fatorial)
alter table public.messages add column if not exists ai_status text default 'pending_ai'; -- pending_ai, processed, failed, rate_limited, retry_scheduled
alter table public.messages add column if not exists priority_score numeric default 0.0;
alter table public.messages add column if not exists priority_level text default 'normal'; -- low, normal, high, critical
alter table public.messages add column if not exists retry_count integer default 0;
alter table public.messages add column if not exists last_retry_at timestamptz;

-- 3. TABELA DE AGREGAÇÃO MENSAL (Performance & Custo)
create table if not exists public.ai_usage_monthly_aggregate (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  month integer not null,
  year integer not null,
  total_processed integer default 0,
  total_noise_filtered integer default 0,
  cost_estimate numeric(10,4) default 0.0, -- Custo real (tokens)
  revenue_generated numeric(10,2) default 0.0, -- Markup para monetização
  last_updated_at timestamptz default now(),
  
  unique(org_id, month, year)
);

-- 4. ÍNDICES DE PERFORMANCE PARA A FILA
create index if not exists idx_messages_ai_status_priority on public.messages(ai_status, priority_score desc) 
where ai_status in ('pending_ai', 'rate_limited', 'retry_scheduled');

create index if not exists idx_messages_org_retry on public.messages(org_id, retry_count);
