-- ============================================================
--  STITCH CRM — Inteligência Artificial (Phase 2 Setup)
--  Configuração de Metadados e Gatilhos de IA
-- ============================================================

-- 1. ADIÇÃO DE CAMPOS DE INSIGHT NO DEAL
-- Estes campos armazenam o "Cérebro" do negócio para visualização rápida no front-end.
alter table deals add column if not exists last_ai_insight jsonb default '{}';
alter table deals add column if not exists ai_adherence_score integer default 0;

-- 2. FUNÇÃO DE DISPARO (DATABASE WEBHOOK PARA EDGE FUNCTION)
-- Esta função é chamada pelo trigger para invocar a IA de forma assíncrona.
-- Nota: Requer a extensão pg_net habilitada no seu Supabase.

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

-- 3. O GATILHO (O MOTOR)
-- Só dispara para mensagens RECEBIDAS (inbound) para economizar tokens e focar no cliente.
drop trigger if exists tr_analyze_message on messages;
create trigger tr_analyze_message
after insert on messages
for each row
when (new.direction = 'inbound')
execute function public.fn_trigger_ai_analysis();

-- ============================================================
-- INSTRUÇÃO:
-- 1. Execute este SQL no editor do Supabase.
-- 2. Certifique-se de que a extensão "pg_net" está habilitada.
-- 3. Configure a variável OPENAI_API_KEY no seu dashboard do Supabase Functions.
-- ============================================================
