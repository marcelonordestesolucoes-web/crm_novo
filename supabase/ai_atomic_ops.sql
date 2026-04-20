-- ============================================================
--  STITCH CRM — Operações Atômicas de IA (Nível Elite)
--  Garante consistência de métricas e rate limit em escala.
-- ============================================================

-- 1. INCREMENTO DE USO E KPI (ATÔMICO)
-- Garante que ai_used e ai_processed cresçam juntos sem race condition.
create or replace function public.increment_ai_usage(org_id uuid)
returns void as $$
begin
  update organizations
  set 
    ai_used = ai_used + 1,
    ai_processed = ai_processed + 1
  where id = org_id;
end;
$$ language plpgsql security definer;

-- 2. INCREMENTO DE ECONOMIA (FILTRO DE RUÍDO)
create or replace function public.increment_ai_saved_by_filter(org_id uuid)
returns void as $$
begin
  update organizations
  set ai_saved_by_filter = ai_saved_by_filter + 1
  where id = org_id;
end;
$$ language plpgsql security definer;

-- 3. RATE LIMIT POR JANELA (ATÔMICO + VALIDAÇÃO)
-- Tenta incrementar o contador na janela atual. 
-- Retorna TRUE se permitido, FALSE se bloqueado.
create or replace function public.check_and_increment_ai_rate_limit(p_org_id uuid)
returns boolean as $$
declare
  allowed boolean;
  v_now timestamptz := now();
begin
  -- Tenta atualizar com lógica de reset de janela integrada
  update organizations
  set 
    ai_calls_in_window = case 
      when (v_now - ai_window_started_at > interval '1 minute') then 1
      else ai_calls_in_window + 1
    end,
    ai_window_started_at = case 
      when (v_now - ai_window_started_at > interval '1 minute') then v_now
      else ai_window_started_at
    end
  where id = p_org_id
    and (
      (v_now - ai_window_started_at > interval '1 minute') -- Se a janela venceu, sempre permite reset
      or ai_calls_in_window < ai_rate_limit           -- Usa o limite dinâmico da organização
    )
  returning true into allowed;

  return coalesce(allowed, false);
end;
$$ language plpgsql security definer;

-- 4. DESBLOQUEIO DE DEALS (TRIGGER DE RESET)
-- Limpa o status de bloqueio comercial quando a quota reseta.
create or replace function public.fn_unblock_org_deals()
returns trigger as $$
begin
  -- Se o ai_used foi zerado, limpa os bloqueios dos deals vinculados
  if (old.ai_used > 0 and new.ai_used = 0) then
    update deals
    set 
      ai_blocked = false,
      ai_blocked_reason = null
    where org_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_unblock_deals on organizations;
create trigger tr_unblock_deals
after update of ai_used on organizations
for each row
execute function public.fn_unblock_org_deals();
