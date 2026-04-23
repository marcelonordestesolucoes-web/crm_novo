import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const endpointByType: Record<string, string> = {
  text: "send-text",
  image: "send-image",
  audio: "send-audio",
  video: "send-video",
  document: "send-document",
};

function buildPayload(body: Record<string, unknown>) {
  const type = String(body.type || "text");
  const phone = normalizeRecipientPhone(body.phone);
  const message = String(body.message || "");
  const mediaUrl = String(body.mediaUrl || "");
  const caption = String(body.caption || "");

  if (!phone) throw new Error("Destino WhatsApp obrigatório.");

  if (type === "text") {
    if (!message.trim()) throw new Error("Mensagem obrigatória.");
    return { endpoint: endpointByType.text, payload: { phone, message } };
  }

  const endpoint = endpointByType[type] || endpointByType.document;
  if (!mediaUrl) throw new Error("URL de mídia obrigatória.");

  const payload: Record<string, string> = { phone };
  if (type === "image") {
    payload.image = mediaUrl;
    payload.caption = caption;
  } else if (type === "audio") {
    payload.audio = mediaUrl;
  } else if (type === "video") {
    payload.video = mediaUrl;
    payload.caption = caption;
  } else {
    payload.document = mediaUrl;
  }

  return { endpoint, payload };
}

function normalizeRecipientPhone(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.includes("@g.us")) {
    return raw.replace("@g.us", "");
  }

  if (raw.includes("@lid")) {
    return raw;
  }

  const withoutJid = raw.split("@")[0];
  const digits = withoutJid.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
    throw new Error("Destino WhatsApp invalido: informe telefone com DDI e DDD.");
  }

  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.org_id) {
      return new Response(JSON.stringify({ error: "Usuário sem organização." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!instanceId || !instanceToken) {
      throw new Error("Credenciais Z-API não configuradas na Edge Function.");
    }

    const body = await req.json();
    const { endpoint, payload } = buildPayload(body);
    const url = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/${endpoint}`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) headers["Client-Token"] = clientToken;

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.error || "Erro na Z-API.");
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Falha ao enviar WhatsApp." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
