-- ============================================================
--  STITCH CRM — Fase 4: Lógica de Prioridade e Worker (Elite)
-- ============================================================

-- 1. CÁLCULO DE PRIORIDADE MULTI-FATORIAL
create or replace function public.calculate_message_priority(p_deal_id uuid, p_content text)
returns table (score numeric, level text) as $$
declare
  v_deal_value numeric;
  v_urgency_score numeric := 0.0;
  v_intent_score numeric := 0.0;
  v_value_score numeric := 0.0;
  v_final_score numeric;
begin
  -- 1. Buscar Valor do Deal
  select coalesce(value, 0) into v_deal_value from public.deals where id = p_deal_id;
  
  -- 2. Score por Valor (Normalized: R$ 100k = 0.6)
  v_value_score := least(0.6, (v_deal_value / 160000.0));

  -- 3. Detecção Rápida de Intenção (Keywords)
  if p_content ~* '(fechar|contrato|proposta|assinar|pagamento|comprar)' then
    v_intent_score := 0.4;
  elsif p_content ~* '(preço|valor|como funciona|tenho interesse)' then
    v_intent_score := 0.1;
  end if;

  -- 4. Final Score
  v_final_score := v_value_score + v_intent_score;

  -- 5. Definição de Nível
  return query select 
    v_final_score,
    case 
      when v_final_score >= 0.8 then 'critical'
      when v_final_score >= 0.5 then 'high'
      else 'normal'
    end;
end;
$$ language plpgsql security definer;

-- 2. WORKER DE REPROCESSAMENTO (pg_cron Ready)
-- Esta função reinjeta mensagens travadas no fluxo de análise.
create or replace function public.reprocess_ai_queue()
returns void as $$
declare
  v_msg_record record;
begin
  -- Busca mensagens rate_limited ou failed (com menos de 3 tentativas)
  for v_msg_record in 
    select * from public.messages 
    where ai_status in ('rate_limited', 'failed')
      and retry_count < 3
      and (last_retry_at is null or last_retry_at < now() - interval '1 minute')
    order by priority_score desc
    limit 20 -- Batch size para evitar sobrecarga
  loop
    -- Marca como retry_scheduled
    update public.messages 
    set 
      ai_status = 'retry_scheduled',
      retry_count = retry_count + 1,
      last_retry_at = now()
    where id = v_msg_record.id;

    -- Dispara o webhook novamente (Re-injeção no orquestrador)
    perform public.fn_trigger_ai_analysis_row(v_msg_record);
  end loop;
end;
$$ language plpgsql security definer;

-- 3. AUXILIAR: FN_TRIGGER_AI_ANALYSIS_ROW
-- Versão que aceita um registro completo para re-uso.
create or replace function public.fn_trigger_ai_analysis_row(p_record public.messages)
returns void as $$
begin
  perform
    net.http_post(
      url := 'https://' || current_setting('project_ref') || '.functions.supabase.co/ai-interpret-message',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('service_role_key')
      ),
      body := jsonb_build_object('record', row_to_json(p_record))
    );
end;
$$ language plpgsql security definer;
