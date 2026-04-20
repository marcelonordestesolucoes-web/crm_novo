-- ============================================================
--  STITCH CRM — Histórico de Uso de IA (Nível Elite)
-- ============================================================

-- 1. TABELA DE HISTÓRICO
create table if not exists public.ai_usage_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  usage_date date default current_date,
  calls_count integer default 0,
  noise_filtered_count integer default 0,
  created_at timestamptz default now(),
  
  -- Um registro por dia por organização
  unique(org_id, usage_date)
);

-- 2. ATUALIZAÇÃO DO RPC DE INCREMENTO (AGORA COM HISTÓRICO)
create or replace function public.increment_ai_usage_with_history(p_org_id uuid)
returns void as $$
begin
  -- Incremento principal na organização
  update organizations
  set 
    ai_used = ai_used + 1,
    ai_processed = ai_processed + 1
  where id = p_org_id;

  -- Incremento ou inserção no histórico diário
  insert into ai_usage_history (org_id, usage_date, calls_count)
  values (p_org_id, current_date, 1)
  on conflict (org_id, usage_date) 
  do update set calls_count = ai_usage_history.calls_count + 1;
end;
$$ language plpgsql security definer;

-- 3. ATUALIZAÇÃO DO RPC DE ECONOMIA (AGORA COM HISTÓRICO)
create or replace function public.increment_ai_saved_by_filter_with_history(p_org_id uuid)
returns void as $$
begin
  -- Incremento principal na organização
  update organizations
  set ai_saved_by_filter = ai_saved_by_filter + 1
  where id = p_org_id;

  -- Incremento ou inserção no histórico diário
  insert into ai_usage_history (org_id, usage_date, noise_filtered_count)
  values (p_org_id, current_date, 1)
  on conflict (org_id, usage_date) 
  do update set noise_filtered_count = ai_usage_history.noise_filtered_count + 1;
end;
$$ language plpgsql security definer;
