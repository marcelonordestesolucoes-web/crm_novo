import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID") ?? "";
    const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN") ?? "";
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";

    if (!instanceId || !instanceToken) {
      return json({ error: "Credenciais Z-API não configuradas." }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Não autenticado." }, 401);

    const { data: membership } = await supabaseAuth
      .from("memberships")
      .select("org_id")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.org_id) return json({ error: "Usuário sem organização." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");
    const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) headers["Client-Token"] = clientToken;

    async function zapi(path: string, init: RequestInit = {}) {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers || {}) },
      });
      const text = await response.text();
      let payload: any = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = { value: text };
      }

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `Z-API retornou status ${response.status}.`);
      }
      return payload;
    }

    if (action === "status") {
      const status = await zapi("/status");
      let device = null;
      if (status?.connected) {
        device = await zapi("/device").catch(() => null);
      }

      return json({
        connected: Boolean(status?.connected),
        smartphoneConnected: Boolean(status?.smartphoneConnected),
        message: status?.error || null,
        instanceId,
        phone: device?.phone || null,
        name: device?.name || null,
        imageUrl: device?.imgUrl || null,
        isBusiness: device?.isBusiness ?? null,
        device: device?.device || null,
      });
    }

    if (action === "qr") {
      const status = await zapi("/status");
      if (status?.connected) {
        return json({ connected: true, message: status?.error || "Instância já conectada." });
      }

      const qr = await zapi("/qr-code/image").catch(() => zapi("/qr-code"));
      const qrCode = qr?.value || qr?.qrCode || qr?.qr || qr?.image || qr?.base64 || null;
      return json({
        connected: false,
        qrCode: qrCode && !String(qrCode).startsWith("data:")
          ? `data:image/png;base64,${qrCode}`
          : qrCode,
        raw: qrCode ? undefined : qr,
      });
    }

    if (action === "phone-code") {
      const phone = String(body.phone || "").replace(/\D/g, "");
      if (phone.length < 10 || phone.length > 15) {
        return json({ error: "Informe o telefone com DDI e DDD." }, 400);
      }

      const result = await zapi(`/phone-code/${phone}`);
      return json({ code: result?.value || null });
    }

    if (action === "sync-webhook") {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const { data: org, error: orgError } = await supabaseAdmin
        .from("organizations")
        .select("id, whatsapp_token")
        .eq("id", membership.org_id)
        .single();

      if (orgError || !org) throw orgError || new Error("Organização não encontrada.");

      const token = org.whatsapp_token || randomToken();
      if (!org.whatsapp_token) {
        const { error: updateError } = await supabaseAdmin
          .from("organizations")
          .update({ whatsapp_token: token, updated_at: new Date().toISOString() })
          .eq("id", org.id);
        if (updateError) throw updateError;
      }

      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?token=${encodeURIComponent(token)}`;
      await zapi("/update-webhook-received", {
        method: "PUT",
        body: JSON.stringify({ value: webhookUrl }),
      });
      await zapi("/update-notify-sent-by-me", {
        method: "PUT",
        body: JSON.stringify({ notifySentByMe: true }),
      }).catch(() => null);

      return json({ ok: true, webhookUrl });
    }

    if (action === "disconnect") {
      const result = await zapi("/disconnect");
      return json({ ok: true, result });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (err: any) {
    return json({ error: err.message || "Falha ao conversar com a Z-API." }, 400);
  }
});
