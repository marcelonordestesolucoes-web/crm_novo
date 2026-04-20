-- ============================================================
--  STITCH CRM — Fase 5: Validação e Aprendizado Contínuo (Elite)
--  Observabilidade, Feedback Estruturado e Upsell
-- ============================================================

-- 1. FLAG DE ROLLOUT E CONFIGURAÇÃO
alter table public.organizations add column if not exists ai_feature_enabled boolean default true;
alter table public.organizations add column if not exists influence_window_hours integer default 6;

-- 2. TABELA DE EVENTOS COMPORTAMENTAIS (TRACKING DE IMPACTO)
create table if not exists public.user_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    org_id uuid references public.organizations(id) on delete cascade,
    deal_id uuid references public.deals(id) on delete cascade,
    event_type text not null, -- ai_insight_viewed, ai_action_clicked, ai_message_copied, ai_ignored, ai_upsell
    
    -- Colunas de Metrificação Financeira (Upsell)
    previous_value numeric(12,2),
    new_value numeric(12,2),
    value_delta numeric(12,2),
    influenced_by_ai boolean default false,

    metadata jsonb default '{}',
    created_at timestamptz default now() not null
);

-- 3. TABELA DE FEEDBACK ESTRUTURADO (FEEDBACK LOOP)
create table if not exists public.ai_feedback (
    id uuid primary key default gen_random_uuid(),
    message_id uuid references public.messages(id) on delete cascade,
    deal_id uuid references public.deals(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    org_id uuid references public.organizations(id) on delete cascade,
    
    feedback_type text not null check (feedback_type in ('positive', 'negative')),
    error_type text, -- context_mismatch, bad_strategy, low_quality, wrong_timing (Para feedback 'negative')
    comment text,
    
    created_at timestamptz default now() not null
);

-- 4. ÍNDICES DE PERFORMANCE PARA ANALYTICS
create index if not exists idx_user_events_org_id_type on public.user_events(org_id, event_type);
create index if not exists idx_user_events_created_at on public.user_events(created_at);
create index if not exists idx_ai_feedback_message_id on public.ai_feedback(message_id);

-- 5. RLS & POLICIES
alter table public.user_events enable row level security;
alter table public.ai_feedback enable row level security;

-- Policies (Garantindo que usuários vejam apenas dados de suas organizações)
drop policy if exists "Users can view org events" on public.user_events;
create policy "Users can view org events" on public.user_events for select 
using (org_id in (select org_id from public.memberships where user_id = auth.uid()));

drop policy if exists "Users can insert org events" on public.user_events;
create policy "Users can insert org events" on public.user_events for insert 
with check (org_id in (select org_id from public.memberships where user_id = auth.uid()));

drop policy if exists "Users can view org feedback" on public.ai_feedback;
create policy "Users can view org feedback" on public.ai_feedback for select 
using (org_id in (select org_id from public.memberships where user_id = auth.uid()));

drop policy if exists "Users can insert org feedback" on public.ai_feedback;
create policy "Users can insert org feedback" on public.ai_feedback for insert 
with check (org_id in (select org_id from public.memberships where user_id = auth.uid()));

-- 6. RPC: MÉTRICAS HIERÁRQUICAS ATUALIZADAS (Fase 5 Elite)
create or replace function public.get_ai_validation_metrics_v2(p_org_id uuid)
returns jsonb as $$
declare
    v_total_insights bigint;
    v_total_clicks bigint;
    v_total_positive bigint;
    v_total_negative bigint;
    v_total_upsells bigint;
    v_total_value_delta numeric;
    v_seller_stats jsonb;
begin
    -- 1. Totais da Organização
    select count(*) into v_total_insights from public.user_events where org_id = p_org_id and event_type = 'ai_insight_viewed';
    select count(*) into v_total_clicks from public.user_events where org_id = p_org_id and event_type = 'ai_action_clicked';
    
    select count(*) filter (where event_type = 'ai_upsell'),
           coalesce(sum(value_delta) filter (where event_type = 'ai_upsell'), 0.0)
    into v_total_upsells, v_total_value_delta
    from public.user_events where org_id = p_org_id;

    select count(case when feedback_type = 'positive' then 1 end),
           count(case when feedback_type = 'negative' then 1 end)
    into v_total_positive, v_total_negative
    from public.ai_feedback where org_id = p_org_id;

    -- 2. Stats por Vendedor (Tracking de Performance Individual)
    select jsonb_agg(t) into v_seller_stats
    from (
        select 
            u.id as user_id,
            u.email,
            count(e.id) filter (where e.event_type = 'ai_insight_viewed') as views,
            count(e.id) filter (where e.event_type = 'ai_action_clicked') as clicks,
            count(f.id) filter (where f.feedback_type = 'positive') as positive_feedbacks,
            coalesce(sum(e.value_delta) filter (where e.event_type = 'ai_upsell'), 0.0) as revenue_contribution
        from auth.users u
        join public.memberships m on m.user_id = u.id
        left join public.user_events e on e.user_id = u.id and e.org_id = p_org_id
        left join public.ai_feedback f on f.user_id = u.id and f.org_id = p_org_id
        where m.org_id = p_org_id
        group by u.id, u.email
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
        'seller_stats', v_seller_stats
    );
end;
$$ language plpgsql security definer;
