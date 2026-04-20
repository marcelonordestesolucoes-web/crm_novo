-- ============================================================
--  STITCH CRM — Gestão de Quotas e Custo IA (Nível Elite 10/10)
--  Arquitetura SaaS Enterprise: Rate Limit, Reset e Métricas
-- ============================================================

-- 1. TABELA DE ORGANIZAÇÕES (Workspaces)
-- Esta tabela centraliza o faturamento e limites de uso.
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_type text not null default 'basic', -- basic, pro, enterprise
  
  -- Controle de Quotas
  ai_enabled boolean default false,
  ai_quota integer default 100,           -- Limite total do ciclo
  ai_used integer default 0,              -- Consumo atual
  ai_processed integer default 0,         -- Métricas de sucesso (KPI)
  ai_saved_by_filter integer default 0,   -- Métricas de economia (KPI)
  
  -- Ciclo de Reset
  ai_reset_at timestamptz default (now() + interval '30 days'),
  
  -- Rate Limit (Janela de 1 minuto)
  ai_calls_in_window integer default 0,
  ai_window_started_at timestamptz default now(),
  
  created_at timestamptz default now()
);

-- 2. VÍNCULOS DE IDENTIDADE
-- Garantir que mensagens saibam a qual organização pertencem para controle de quota.
alter table messages add column if not exists org_id uuid references organizations(id);

-- 3. INTERFACE DE BLOQUEIO NO DEAL
-- Permite que o cockpit de decisão saiba por que a IA não está agindo.
alter table deals add column if not exists ai_blocked boolean default false;
alter table deals add column if not exists ai_blocked_reason text; -- quota_exceeded | rate_limited | failed

-- ============================================================
-- INSTRUÇÃO:
-- 1. Execute este SQL no editor do Supabase.
-- 2. Vincule suas mensagens às organizações via Business Logic.
-- ============================================================
