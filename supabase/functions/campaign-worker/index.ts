import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

type Campaign = {
  id: string;
  org_id: string;
  status: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
  min_delay_seconds: number | null;
  max_delay_seconds: number | null;
  per_minute_limit: number | null;
  per_hour_limit: number | null;
  campaign_limit: number | null;
  total_sent: number | null;
  total_failed: number | null;
  total_eligible: number | null;
  consecutive_failures: number | null;
  max_consecutive_failures: number | null;
  failure_rate_stop_threshold: number | null;
};

type QueueItem = {
  id: string;
  org_id: string;
  campaign_id: string;
  campaign_contact_id: string;
  phone: string;
  normalized_phone: string;
  final_message: string;
  retry_count: number | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeRecipientPhone(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("@g.us")) return raw.replace("@g.us", "");
  if (raw.includes("@lid")) return raw;

  const digits = raw.split("@")[0].replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new Error("Destino WhatsApp invalido: informe telefone com DDI e DDD.");
  }
  return digits;
}

function nowInTimezoneParts(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour")?.value || "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value || "0");
  return hour * 60 + minute;
}

function timeToMinutes(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(":").map((part) => Number(part));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function isInsideWindow(campaign: Campaign) {
  const start = timeToMinutes(campaign.start_time);
  const end = timeToMinutes(campaign.end_time);
  if (start === null || end === null) return true;

  const current = nowInTimezoneParts(campaign.timezone || "America/Sao_Paulo");
  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end;
}

function randomDelaySeconds(campaign: Campaign) {
  const min = Math.max(1, Number(campaign.min_delay_seconds || 30));
  const max = Math.max(min, Number(campaign.max_delay_seconds || min));
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sendWhatsApp(phoneValue: string, message: string) {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN");
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

  if (!instanceId || !instanceToken) {
    throw new Error("Credenciais Z-API nao configuradas na Edge Function.");
  }

  const phone = normalizeRecipientPhone(phoneValue);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;

  const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone, message }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || "Erro na Z-API.");
  }

  return data;
}

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  campaign: Campaign,
  event: string,
  message: string,
  payload: Record<string, unknown> = {},
  level = "info",
  queueId: string | null = null,
) {
  await supabase.from("campaign_logs").insert({
    org_id: campaign.org_id,
    campaign_id: campaign.id,
    queue_id: queueId,
    level,
    event,
    message,
    payload,
  });
}

async function getMembershipOrg(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) throw new Error("Nao autenticado.");

  const { data: membership, error: membershipError } = await userClient
    .from("memberships")
    .select("org_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership?.org_id) throw new Error("Usuario sem organizacao.");
  return { orgId: membership.org_id as string, userId: userData.user.id };
}

async function getCampaign(supabase: ReturnType<typeof createClient>, orgId: string, campaignId: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", campaignId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Campanha nao encontrada.");
  return data as Campaign;
}

async function getDueCampaigns(supabase: ReturnType<typeof createClient>) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("status", "running")
    .or(`next_dispatch_at.is.null,next_dispatch_at.lte.${now}`)
    .order("next_dispatch_at", { ascending: true, nullsFirst: true })
    .limit(5);

  if (error) throw error;
  return (data || []) as Campaign[];
}

async function refreshTotals(supabase: ReturnType<typeof createClient>, campaign: Campaign) {
  const { data: queue, error } = await supabase
    .from("campaign_dispatch_queue")
    .select("status")
    .eq("org_id", campaign.org_id)
    .eq("campaign_id", campaign.id);

  if (error) throw error;

  const rows = queue || [];
  const totalSent = rows.filter((item) => ["sent", "delivered"].includes(item.status)).length;
  const totalDelivered = rows.filter((item) => item.status === "delivered").length;
  const totalFailed = rows.filter((item) => item.status === "failed").length;
  const totalSkipped = rows.filter((item) => ["skipped", "blocked_by_rule", "cancelled"].includes(item.status)).length;
  const pending = rows.filter((item) => ["pending", "scheduled", "sending"].includes(item.status)).length;

  const updates: Record<string, unknown> = {
    total_sent: totalSent,
    total_delivered: totalDelivered,
    total_failed: totalFailed,
    total_skipped: totalSkipped,
    updated_at: new Date().toISOString(),
  };

  if (pending === 0 && campaign.status === "running") {
    updates.status = "completed";
    updates.completed_at = new Date().toISOString();
    updates.next_dispatch_at = null;
  }

  const { error: updateError } = await supabase
    .from("campaigns")
    .update(updates)
    .eq("org_id", campaign.org_id)
    .eq("id", campaign.id);

  if (updateError) throw updateError;

  return { totalSent, totalDelivered, totalFailed, totalSkipped, pending };
}

async function startCampaign(supabase: ReturnType<typeof createClient>, campaign: Campaign) {
  if (!["draft", "paused", "scheduled"].includes(campaign.status)) {
    throw new Error("A campanha nao pode ser iniciada neste status.");
  }

  const { count, error: countError } = await supabase
    .from("campaign_dispatch_queue")
    .select("id", { count: "exact", head: true })
    .eq("org_id", campaign.org_id)
    .eq("campaign_id", campaign.id)
    .in("status", ["pending", "scheduled", "failed"]);

  if (countError) throw countError;
  if (!count) throw new Error("A campanha nao possui fila pendente.");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("campaigns")
    .update({
      status: "running",
      started_at: campaign.status === "draft" ? now : undefined,
      paused_at: null,
      pause_reason: null,
      worker_last_error: null,
      next_dispatch_at: now,
      updated_at: now,
    })
    .eq("org_id", campaign.org_id)
    .eq("id", campaign.id);

  if (error) throw error;
  await logEvent(supabase, campaign, "campaign.started", "Campanha iniciada com fila segura.");
}

async function pauseCampaign(supabase: ReturnType<typeof createClient>, campaign: Campaign, reason = "Pausa manual.") {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("campaigns")
    .update({
      status: "paused",
      paused_at: now,
      pause_reason: reason,
      next_dispatch_at: null,
      updated_at: now,
    })
    .eq("org_id", campaign.org_id)
    .eq("id", campaign.id);

  if (error) throw error;
  await logEvent(supabase, campaign, "campaign.paused", reason, {}, "warning");
}

async function processOne(supabase: ReturnType<typeof createClient>, campaign: Campaign) {
  if (campaign.status !== "running") {
    return { sent: 0, skipped: 0, message: "Campanha nao esta em execucao." };
  }

  if (!isInsideWindow(campaign)) {
    const nextCheckAt = new Date(Date.now() + 60_000).toISOString();
    await supabase
      .from("campaigns")
      .update({
        status: "running",
        next_dispatch_at: nextCheckAt,
        worker_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", campaign.org_id)
      .eq("id", campaign.id);

    await logEvent(supabase, campaign, "campaign.window.waiting", "Fora da janela segura. Campanha mantida em execucao aguardando horario permitido.", {
      start_time: campaign.start_time,
      end_time: campaign.end_time,
      next_check_at: nextCheckAt,
    }, "info");

    return { sent: 0, skipped: 0, next_dispatch_at: nextCheckAt, message: "Fora da janela segura. Aguardando horario permitido." };
  }

  const now = new Date();
  const sinceMinute = new Date(now.getTime() - 60_000).toISOString();
  const sinceHour = new Date(now.getTime() - 60 * 60_000).toISOString();

  const [{ count: sentMinute }, { count: sentHour }] = await Promise.all([
    supabase
      .from("campaign_dispatch_queue")
      .select("id", { count: "exact", head: true })
      .eq("org_id", campaign.org_id)
      .eq("campaign_id", campaign.id)
      .in("status", ["sent", "delivered"])
      .gte("sent_at", sinceMinute),
    supabase
      .from("campaign_dispatch_queue")
      .select("id", { count: "exact", head: true })
      .eq("org_id", campaign.org_id)
      .eq("campaign_id", campaign.id)
      .in("status", ["sent", "delivered"])
      .gte("sent_at", sinceHour),
  ]);

  if ((sentMinute || 0) >= Number(campaign.per_minute_limit || 1)) {
    return { sent: 0, skipped: 0, message: "Limite por minuto atingido." };
  }

  if ((sentHour || 0) >= Number(campaign.per_hour_limit || 60)) {
    return { sent: 0, skipped: 0, message: "Limite por hora atingido." };
  }

  if (campaign.campaign_limit && Number(campaign.total_sent || 0) >= campaign.campaign_limit) {
    await pauseCampaign(supabase, campaign, "Limite total da campanha atingido.");
    return { sent: 0, skipped: 0, message: "Limite total atingido." };
  }

  const { data: candidateItems, error: itemError } = await supabase
    .from("campaign_dispatch_queue")
    .select("*")
    .eq("org_id", campaign.org_id)
    .eq("campaign_id", campaign.id)
    .in("status", ["pending", "scheduled"])
    .order("scheduled_for", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(20);

  if (itemError) throw itemError;
  const item = (candidateItems || []).find((candidate) => {
    if (!candidate.scheduled_for) return true;
    return new Date(candidate.scheduled_for).getTime() <= now.getTime();
  });

  if (!item) {
    const totals = await refreshTotals(supabase, campaign);
    return { sent: 0, skipped: 0, message: totals.pending ? "Aguardando proximo horario." : "Fila concluida." };
  }

  const queueItem = item as QueueItem;
  const workerId = crypto.randomUUID();

  const { data: locked, error: lockError } = await supabase
    .from("campaign_dispatch_queue")
    .update({
      status: "sending",
      locked_at: now.toISOString(),
      locked_by: workerId,
      updated_at: now.toISOString(),
    })
    .eq("id", queueItem.id)
    .eq("org_id", campaign.org_id)
    .in("status", ["pending", "scheduled"])
    .select()
    .maybeSingle();

  if (lockError) throw lockError;
  if (!locked) return { sent: 0, skipped: 0, message: "Item ja foi capturado por outro worker." };

  try {
    const providerPayload = await sendWhatsApp(queueItem.phone || queueItem.normalized_phone, queueItem.final_message);
    const sentAt = new Date().toISOString();
    const providerMessageId = providerPayload?.messageId || providerPayload?.id || providerPayload?.zaapId || null;
    const delaySeconds = randomDelaySeconds(campaign);
    const nextDispatchAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

    const { error: sentError } = await supabase
      .from("campaign_dispatch_queue")
      .update({
        status: "sent",
        sent_at: sentAt,
        locked_at: null,
        locked_by: null,
        provider_message_id: providerMessageId,
        provider_payload: providerPayload,
        updated_at: sentAt,
      })
      .eq("id", queueItem.id)
      .eq("org_id", campaign.org_id);

    if (sentError) throw sentError;

    await supabase
      .from("campaigns")
      .update({
        total_sent: Number(campaign.total_sent || 0) + 1,
        consecutive_failures: 0,
        last_dispatch_at: sentAt,
        next_dispatch_at: nextDispatchAt,
        worker_last_error: null,
        updated_at: sentAt,
      })
      .eq("org_id", campaign.org_id)
      .eq("id", campaign.id);

    await logEvent(supabase, campaign, "campaign.message.sent", "Mensagem enviada pela fila segura.", {
      phone: queueItem.normalized_phone,
      next_dispatch_at: nextDispatchAt,
      delay_seconds: delaySeconds,
    }, "info", queueItem.id);

    await refreshTotals(supabase, campaign);
    return { sent: 1, skipped: 0, next_dispatch_at: nextDispatchAt, message: "Mensagem enviada." };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : "Falha desconhecida.";
    const consecutiveFailures = Number(campaign.consecutive_failures || 0) + 1;

    await supabase
      .from("campaign_dispatch_queue")
      .update({
        status: "failed",
        failed_at: failedAt,
        locked_at: null,
        locked_by: null,
        error_message: errorMessage,
        retry_count: Number(queueItem.retry_count || 0) + 1,
        updated_at: failedAt,
      })
      .eq("id", queueItem.id)
      .eq("org_id", campaign.org_id);

    await supabase
      .from("campaigns")
      .update({
        total_failed: Number(campaign.total_failed || 0) + 1,
        consecutive_failures: consecutiveFailures,
        worker_last_error: errorMessage,
        updated_at: failedAt,
      })
      .eq("org_id", campaign.org_id)
      .eq("id", campaign.id);

    await logEvent(supabase, campaign, "campaign.message.failed", errorMessage, {
      phone: queueItem.normalized_phone,
      consecutive_failures: consecutiveFailures,
    }, "error", queueItem.id);

    if (consecutiveFailures >= Number(campaign.max_consecutive_failures || 3)) {
      await pauseCampaign(supabase, campaign, "Pausa automatica por falhas consecutivas.");
    }

    return { sent: 0, skipped: 0, failed: 1, message: errorMessage };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Service role nao configurado para o worker.");

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body.campaign_id || body.campaignId || "");
    const action = String(body.action || "process");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (action === "tick") {
      const schedulerSecret = Deno.env.get("CAMPAIGN_WORKER_SECRET") ?? "";
      const requestSecret = req.headers.get("x-campaign-worker-secret") ?? String(body.secret || "");

      if (!schedulerSecret || requestSecret !== schedulerSecret) {
        return json({ ok: false, error: "Scheduler nao autorizado." }, 401);
      }

      const campaigns = await getDueCampaigns(supabase);
      const results = [];

      for (const campaign of campaigns) {
        const result = await processOne(supabase, campaign);
        results.push({
          campaign_id: campaign.id,
          name: campaign.name,
          ...result,
        });
      }

      return json({ ok: true, action, processed: results.length, results });
    }

    const { orgId } = await getMembershipOrg(req);
    if (!campaignId) throw new Error("campaign_id e obrigatorio.");
    const campaign = await getCampaign(supabase, orgId, campaignId);

    if (action === "start" || action === "resume") {
      await startCampaign(supabase, campaign);
      const runningCampaign = await getCampaign(supabase, orgId, campaignId);
      const result = await processOne(supabase, runningCampaign);
      return json({ ok: true, action, ...result });
    }

    if (action === "pause") {
      await pauseCampaign(supabase, campaign, "Pausa manual.");
      return json({ ok: true, action, message: "Campanha pausada." });
    }

    if (action === "process") {
      const result = await processOne(supabase, campaign);
      return json({ ok: true, action, ...result });
    }

    throw new Error("Acao invalida.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no worker de campanhas.";
    return json({ ok: false, error: message }, message.includes("autentic") ? 401 : 400);
  }
});
