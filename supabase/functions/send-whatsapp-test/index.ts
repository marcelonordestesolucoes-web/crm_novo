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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildZApiPayload(stepType: string, config: any, phone: string) {
  let type = "text";
  let message = "";
  let mediaUrl = "";
  let caption = "";

  if (stepType === "send_message" || stepType === "send_options" || stepType === "trigger_start") {
    type = "text";
    message = config.message || "";
    
    // Add options if present
    if (stepType === "send_options" && config.options) {
      const opts = String(config.options).split('\n').filter(Boolean);
      if (opts.length > 0) {
        message += "\n\n" + opts.map((opt, i) => {
          const num = i + 1;
          const spaceBeforeHyphen = num === 1 ? '  ' : ' ';
          return `${num}${spaceBeforeHyphen}- ${opt.trim()}`;
        }).join('\n');
      }
    }
  } else if (stepType === "send_image") {
    type = "image";
    mediaUrl = config.image_link || "";
    caption = config.message || "";
  } else if (stepType === "send_video") {
    type = "video";
    mediaUrl = config.video_link || "";
    caption = config.message || "";
  } else if (stepType === "send_audio") {
    type = "audio";
    mediaUrl = config.audio_link || "";
  } else if (stepType === "send_document") {
    type = "document";
    mediaUrl = config.document_link || "";
  } else if (stepType === "send_link") {
    type = "text";
    message = (config.message ? config.message + "\n\n" : "") + (config.link_url || "");
  }

  // Se não houver mensagem nem mídia, podemos ignorar (ex: trigger_start vazio)
  if (type === "text" && !message.trim()) return null;
  if (type !== "text" && !mediaUrl) return null;

  const endpoint = endpointByType[type] || endpointByType.text;
  const payload: Record<string, string> = { phone };

  if (type === "text") {
    payload.message = message;
  } else if (type === "image") {
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

    const body = await req.json();
    const { flow_id, test_phone, testSteps } = body;

    if (!flow_id) throw new Error("ID do fluxo é obrigatório.");
    if (!test_phone) throw new Error("Número de teste é obrigatório.");
    if (!Array.isArray(testSteps) || testSteps.length === 0) {
      throw new Error("Nenhum passo para simular.");
    }

    // Rate Limiting Seguro: Máximo de 10 passos
    const stepsToProcess = testSteps.slice(0, 10);

    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!instanceId || !instanceToken) {
      throw new Error("Credenciais Z-API não configuradas na Edge Function.");
    }

    // Normaliza o número (reutilizando a lógica existente)
    const rawPhone = String(test_phone).trim();
    const phoneDigits = rawPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      throw new Error("Destino WhatsApp inválido: informe telefone com DDI e DDD.");
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) headers["Client-Token"] = clientToken;

    let successCount = 0;

    for (let i = 0; i < stepsToProcess.length; i++) {
      const step = stepsToProcess[i];
      const zapiData = buildZApiPayload(step.node.type, step.node.config, phoneDigits);
      
      if (!zapiData) continue; // Pula passos vazios (como start_trigger)

      const url = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/${zapiData.endpoint}`;
      
      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(zapiData.payload),
        });

        if (response.ok) {
          successCount++;
        } else {
          console.error(`Erro ao enviar passo ${i} (${step.node.type}):`, await response.text());
        }
      } catch (err) {
        console.error(`Falha de rede ao enviar passo ${i}:`, err);
      }

      // Intervalo seguro de 2 segundos (exceto após a última mensagem)
      if (i < stepsToProcess.length - 1) {
        await delay(2000);
      }
    }

    // Log the test execution securely using Service Role to bypass RLS if necessary, 
    // or anon key since user is authenticated. We use the existing client.
    await supabase.from("automation_flow_logs").insert({
      flow_id,
      event: "test_simulation_sent",
      payload: { 
        test_phone: phoneDigits, 
        messages_sent: successCount, 
        total_steps: stepsToProcess.length 
      },
      level: "info"
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Simulação concluída. ${successCount} mensagens enviadas.` 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Falha ao executar simulação." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
