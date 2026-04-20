-- ============================================================
--  STITCH CRM — Inteligência Artificial (Phase 2 ELITE)
--  Configuração Cockpit de Decisão e Resiliência
-- ============================================================

-- 1. ADIÇÃO DE CAMPOS DE INSIGHT NO DEAL (ELITE)
alter table deals add column if not exists last_ai_insight jsonb default '{}';
alter table deals add column if not exists ai_confidence numeric default 0;
alter table deals add column if not exists ai_last_updated_at timestamptz;

-- 2. FUNÇÃO DE DISPARO (DATABASE WEBHOOK)
-- Certifique-se de que a extensão pg_net está ativa.
create or replace function public.fn_trigger_ai_analysis()
returns trigger as $$
begin
  perform
    net.http_post(
      url := 'https://' || current_setting('project_ref') || '.functions.supabase.co/ai-interpret-message',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('service_role_key')
      ),
      body := jsonb_build_object('record', row_to_json(new))
    );
  return new;
end;
$$ language plpgsql security definer;

-- 3. GATILHO
drop trigger if exists tr_analyze_message on messages;
create trigger tr_analyze_message
after insert on messages
for each row
when (new.direction = 'inbound')
execute function public.fn_trigger_ai_analysis();
