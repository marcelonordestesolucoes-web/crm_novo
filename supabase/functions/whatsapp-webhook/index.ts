import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- HELPERS ---

function normalizeBrazilPhone(value: any) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length === 12) {
    return `${digits.slice(0, 4)}9${digits.slice(4)}`;
  }
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10) {
    return `55${digits.slice(0, 2)}9${digits.slice(2)}`;
  }
  return `55${digits}`;
}

function getBrazilPhoneVariants(value: any) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return [];

  const variants = new Set<string>([digits]);
  const normalized = normalizeBrazilPhone(digits);
  if (normalized) variants.add(normalized);

  if (digits.startsWith("55")) {
    variants.add(digits.slice(2));
  } else {
    variants.add(`55${digits}`);
  }

  for (const phone of Array.from(variants)) {
    if (phone.startsWith("55") && phone.length === 13 && phone[4] === "9") {
      variants.add(`${phone.slice(0, 4)}${phone.slice(5)}`);
      variants.add(`${phone.slice(2, 4)}${phone.slice(5)}`);
      variants.add(phone.slice(2));
    }
    if (phone.startsWith("55") && phone.length === 12) {
      const withNine = `${phone.slice(0, 4)}9${phone.slice(4)}`;
      variants.add(withNine);
      variants.add(withNine.slice(2));
      variants.add(phone.slice(2));
    }
    if (!phone.startsWith("55") && phone.length === 11 && phone[2] === "9") {
      variants.add(`55${phone}`);
      variants.add(`${phone.slice(0, 2)}${phone.slice(3)}`);
      variants.add(`55${phone.slice(0, 2)}${phone.slice(3)}`);
    }
    if (!phone.startsWith("55") && phone.length === 10) {
      const withNine = `${phone.slice(0, 2)}9${phone.slice(2)}`;
      variants.add(withNine);
      variants.add(`55${phone}`);
      variants.add(`55${withNine}`);
    }
  }

  return [...variants].filter((item) => item.length >= 10);
}

function phoneVariantsMatch(left: any, right: any) {
  const leftVariants = getBrazilPhoneVariants(left);
  const rightVariants = getBrazilPhoneVariants(right);
  return leftVariants.some((leftItem) =>
    rightVariants.some((rightItem) => leftItem === rightItem || leftItem.endsWith(rightItem) || rightItem.endsWith(leftItem))
  );
}

function isValidCpf(value: string) {
  const cpf = String(value || "").replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

function isValidCnpj(value: string) {
  const cnpj = String(value || "").replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calcDigit = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, weight, index) => acc + Number(base[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const first = calcDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calcDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}

function isValidCpfOrCnpj(value: string) {
  const numbersOnly = String(value || "").replace(/\D/g, "");
  if (numbersOnly.length === 11) return isValidCpf(numbersOnly);
  if (numbersOnly.length === 14) return isValidCnpj(numbersOnly);
  return false;
}

async function findContactByPhone(supabase: any, orgId: string, rawPhone: string, cleanPhone: string) {
  const variants = [...new Set([...getBrazilPhoneVariants(rawPhone), ...getBrazilPhoneVariants(cleanPhone)])];
  const exactVariants = variants.filter((item) => !/[%,() -]/.test(item));

  if (exactVariants.length) {
    const { data: exactContact } = await supabase.from("contacts").select("*")
      .eq("org_id", orgId)
      .in("phone", exactVariants)
      .limit(1)
      .maybeSingle();
    if (exactContact) return exactContact;
  }

  return null;
}

async function upsertWhatsAppThread(
  supabase: any,
  orgId: string,
  contact: any,
  chatId: string,
  customerPhone: string,
  connectedPhone: string,
) {
  const now = new Date().toISOString();
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID") ?? "default";
  const normalizedConnected = normalizeBrazilPhone(connectedPhone);

  const { data: connection } = await supabase.from("whatsapp_connections").upsert({
    org_id: orgId,
    provider: "zapi",
    instance_id: instanceId,
    connected_phone: normalizedConnected || null,
    status: "active",
    connected_at: now,
    updated_at: now,
  }, { onConflict: "org_id,provider,instance_id" }).select("id").single();

  const { data: thread, error } = await supabase.from("whatsapp_threads").upsert({
    org_id: orgId,
    provider: "zapi",
    connection_id: connection?.id ?? null,
    contact_id: contact.id,
    chat_id: chatId,
    customer_phone: customerPhone,
    connected_phone: normalizedConnected || null,
    is_group: chatId.includes("@g.us"),
    status: "open",
    last_message_at: now,
    updated_at: now,
  }, { onConflict: "org_id,provider,contact_id" }).select("*").single();

  if (error) throw error;
  return thread;
}

function injectVariables(text: string, contact: any) {
  if (!text) return "";
  let result = text;
  if (contact) {
    const name = contact.name || "Cliente";
    const phone = contact.phone || "";
    const empresa = contact.company_name || "";
    result = result.replace(/\{nome\}/g, name).replace(/\{contato\.nome\}/g, name);
    result = result.replace(/\{telefone\}/g, phone).replace(/\{contato\.telefone\}/g, phone);
    result = result.replace(/\{empresa\}/g, empresa);
  }
  return result;
}

function buildZApiPayload(node: any, phone: string, contact: any) {
  const stepType = node.type;
  const config = node.config || {};

  // Delay controlado pela Z-API (máx 15s)
  const rawSeconds = parseInt(config.typing_seconds || config.recording_seconds || "0", 10);
  const delaySeconds = Math.min(15, Math.max(0, rawSeconds));

  const endpointByType: Record<string, string> = {
    text: "send-text", image: "send-image", audio: "send-audio",
    video: "send-video", document: "send-document",
  };

  let type = "text";
  let message = "";
  let mediaUrl = "";
  let caption = "";

  if (stepType === "send_message" || stepType === "send_options") {
    type = "text";
    message = injectVariables(config.message || "", contact);
    if (stepType === "send_options" && config.options) {
      const opts = String(config.options).split('\n').filter(Boolean);
      if (opts.length > 0) {
        message += "\n\n" + opts.map((opt, i) => `${i + 1} - ${opt.trim()}`).join('\n');
      }
    }
  } else if (stepType === "send_image") {
    type = "image"; mediaUrl = config.image_url || config.image_link || "";
    caption = injectVariables(config.message || "", contact);
  } else if (stepType === "send_video") {
    type = "video"; mediaUrl = config.video_url || config.video_link || "";
    caption = injectVariables(config.message || "", contact);
  } else if (stepType === "send_audio") {
    type = "audio"; mediaUrl = config.audio_url || config.audio_link || "";
  } else if (stepType === "send_document") {
    type = "document"; mediaUrl = config.document_url || config.document_link || "";
  } else if (stepType === "send_link") {
    type = "text";
    message = injectVariables(config.message ? config.message + "\n\n" : "", contact) + (config.link_url || "");
  } else {
    return null;
  }

  const endpoint = endpointByType[type] || "send-text";
  const payload: any = { phone };

  if (type === "text") {
    payload.message = message;
    if (delaySeconds > 0) { payload.delayMessage = delaySeconds; payload.delayTyping = delaySeconds; }
    if (config.mark_as_forwarded) payload.markAsForwarded = true;
  } else if (type === "image") {
    payload.image = mediaUrl; payload.caption = caption;
    if (delaySeconds > 0) payload.delayMessage = delaySeconds;
    if (config.mark_as_forwarded) payload.markAsForwarded = true;
  } else if (type === "audio") {
    payload.audio = mediaUrl;
    if (delaySeconds > 0) payload.delayMessage = delaySeconds;
  } else if (type === "video") {
    payload.video = mediaUrl; payload.caption = caption;
    if (delaySeconds > 0) payload.delayMessage = delaySeconds;
  } else {
    payload.document = mediaUrl;
    if (delaySeconds > 0) payload.delayMessage = delaySeconds;
  }

  return { endpoint, payload };
}

async function sendToZApi(zapiData: any) {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID") ?? "";
  const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN") ?? "";
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";
  if (!instanceId || !instanceToken) {
    console.error("[Z-API] Credenciais não configuradas.");
    return { error: "No credentials" };
  }
  const url = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/${zapiData.endpoint}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(zapiData.payload) });
  const result = await response.json().catch(() => ({}));
  console.log(`[Z-API] ${zapiData.endpoint} → status ${response.status}`, JSON.stringify(result));
  return result;
}

// Envia mensagem com o label "Encaminhada" usando o endpoint /forward-message da Z-API.
// Estratégia: envia primeiro para o próprio número do bot (gera messageId),
// depois reencaminha para o destinatário — o WhatsApp exibe "↩ Encaminhada".
async function sendAsForwarded(recipientPhone: string, message: string, delaySeconds: number): Promise<void> {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID") ?? "";
  const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN") ?? "";
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";
  const botPhone = Deno.env.get("ZAPI_BOT_PHONE") ?? "";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}`;

  if (!botPhone) {
    // Fallback: sem o número do bot, envia normalmente (sem label "Encaminhada")
    console.warn("[Forward] ZAPI_BOT_PHONE não configurado. Enviando sem label de encaminhada.");
    await fetch(`${baseUrl}/send-text`, {
      method: "POST", headers,
      body: JSON.stringify({ phone: recipientPhone, message, delayMessage: delaySeconds || 1, delayTyping: delaySeconds || 1 })
    });
    return;
  }

  // Passo 1: Envia para o próprio número do bot para gerar um messageId real
  const selfSend = await fetch(`${baseUrl}/send-text`, {
    method: "POST", headers,
    body: JSON.stringify({ phone: botPhone, message })
  });
  const selfResult = await selfSend.json().catch(() => ({}));
  const messageId = selfResult.messageId || selfResult.id;

  if (!messageId) {
    console.warn("[Forward] Não foi possível obter messageId. Enviando normalmente.");
    await fetch(`${baseUrl}/send-text`, {
      method: "POST", headers,
      body: JSON.stringify({ phone: recipientPhone, message, delayMessage: delaySeconds || 1, delayTyping: delaySeconds || 1 })
    });
    return;
  }

  // Passo 2: Reencaminha para o destinatário real — aparece como "↩ Encaminhada"
  console.log(`[Forward] Encaminhando messageId ${messageId} para ${recipientPhone}`);
  await fetch(`${baseUrl}/forward-message`, {
    method: "POST", headers,
    body: JSON.stringify({
      phone: recipientPhone,
      messageId,
      messagePhone: botPhone,
      ...(delaySeconds > 0 ? { delayMessage: delaySeconds } : {})
    })
  });
}

async function saveBotMessageToInbox(supabase: any, contact: any, orgId: string, chatId: string, dealId: string | null, messageText: string, flowId: string, threadId: string | null = null) {
  const rawPhone = String(contact.phone || "").replace(/\D/g, "");
  const phone55 = normalizeBrazilPhone(rawPhone);
  await supabase.from("deal_conversations").insert({
    org_id: orgId, deal_id: dealId, contact_id: contact.id, thread_id: threadId, chat_id: chatId,
    sender_phone: phone55, content: messageText, sender_type: "sales", message_type: "text",
    metadata: { flow_id: flowId, automated: true, ai_status: "flow_bot" },
  });
}

// REGRA CENTRAL:
// Blocos que ESPERAM resposta do usuário (send_options, ask_question):
//   → Enviar a mensagem
//   → Salvar current_node_id = ID DESSE BLOCO (para interpretar a resposta)
//   → Parar o loop
//
// Blocos que NÃO esperam resposta (send_message, send_image, etc.):
//   → Enviar a mensagem
//   → Salvar current_node_id = ID DO PRÓXIMO BLOCO
//   → Continuar o loop

async function executeFlowLoop(
  supabase: any, session: any, flowJson: any,
  contact: any, chatId: string, dealId: string | null, threadId: string | null = null
) {
  const nodes = flowJson.nodes || [];
  const edges = flowJson.edges || [];
  let currentNodeId = session.current_node_id;
  const rawPhone = String(contact.phone || "").replace(/\D/g, "");
  const cleanPhone = normalizeBrazilPhone(rawPhone);

  const updateSession = async (nodeId: string) => {
    await supabase.from("automation_flow_sessions")
      .update({ current_node_id: nodeId, updated_at: new Date().toISOString() })
      .eq("id", session.id);
  };

  const markCompleted = async () => {
    await supabase.from("automation_flow_sessions")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", session.id);
  };

  while (true) {
    const currentNode = nodes.find((n: any) => n.id === currentNodeId);
    if (!currentNode) {
      console.log(`[Flow] Nó ${currentNodeId} não encontrado. Encerrando.`);
      break;
    }

    console.log(`[Flow] Processando nó: ${currentNode.type} (${currentNodeId})`);

    // Nó de início: apenas avança para o próximo
    if (currentNode.type === "start" || currentNode.type === "trigger_start") {
      const nextEdge = edges.find((e: any) => e.from === currentNodeId);
      if (!nextEdge) {
        await markCompleted();
        break;
      }
      currentNodeId = nextEdge.to;
      await updateSession(currentNodeId);
      continue;
    }

    // Nó de delay puro
    if (currentNode.type === "action_delay") {
      const dur = parseInt(currentNode.config?.duration || "0", 10);
      const unit = currentNode.config?.unit || "seconds";
      const multipliers: Record<string, number> = { seconds: 1000, minutes: 60000, hours: 3600000 };
      const waitMs = dur * (multipliers[unit] || 1000);
      if (waitMs > 0 && waitMs <= 15000) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      const nextEdge = edges.find((e: any) => e.from === currentNodeId);
      if (!nextEdge) {
        const validationReturnNodeId = session.variables?.__validation_return_node_id;
        if (validationReturnNodeId) {
          await updateSession(validationReturnNodeId);
          break;
        }
        await markCompleted();
        break;
      }
      currentNodeId = nextEdge.to;
      await updateSession(currentNodeId);
      continue;
    }

    // Blocos que enviam mensagem
    if (currentNode.type.startsWith("send_")) {
      const isInteractive = currentNode.type === "send_options" || currentNode.type === "ask_question";
      const outgoingAfterSend = edges.find((e: any) => e.from === currentNodeId);
      const nextNodeAfterSend = outgoingAfterSend ? nodes.find((n: any) => n.id === outgoingAfterSend.to) : null;
      const waitsForValidation = nextNodeAfterSend?.type === "condition_validation" || nextNodeAfterSend?.type === "action_validation";

      const zapiData = buildZApiPayload(currentNode, cleanPhone, contact);
      if (zapiData) {
        if (isInteractive || waitsForValidation) {
          await updateSession(waitsForValidation ? outgoingAfterSend.to : currentNodeId);
        }

        // Envia via Z-API (sendAsForwarded desabilitado: causava loop de webhook)
        await sendToZApi(zapiData);
        
        const msgText = zapiData.payload.message || zapiData.payload.caption || `[${currentNode.type}]`;
        await saveBotMessageToInbox(supabase, contact, session.org_id, chatId, dealId, msgText, session.flow_id, threadId);
      }

      if (isInteractive || waitsForValidation) {
        // Para aqui e espera a resposta do usuário
        console.log(`[Flow] Aguardando resposta do usuário no bloco ${currentNode.type} (${currentNodeId})`);
        break;
      }

      // Não interativo: avança para o próximo nó
      const nextEdge = edges.find((e: any) => e.from === currentNodeId);
      if (!nextEdge) {
        const validationReturnNodeId = session.variables?.__validation_return_node_id;
        if (validationReturnNodeId) {
          await updateSession(validationReturnNodeId);
          break;
        }
        await markCompleted();
        break;
      }
      currentNodeId = nextEdge.to;
      await updateSession(currentNodeId);
      continue;
    }

    // Nó de validação de condição
    if (currentNode.type === "condition_validation" || currentNode.type === "action_validation") {
      const vType = currentNode.config?.validation_type || "cpf_cnpj";
      const exactLen = parseInt(currentNode.config?.exact_length || "0", 10);
      const maxRetriesStr = currentNode.config?.max_retries;
      const maxRetries = maxRetriesStr === "" ? 0 : parseInt(maxRetriesStr || "3", 10);
      
      const lastMessage = session.variables?.last_message || "";
      let isValid = true;
      const trimmed = String(lastMessage).trim();

      if (vType === "number") {
        isValid = /^\d+$/.test(trimmed);
      } else if (vType === "number_length") {
        isValid = /^\d+$/.test(trimmed) && trimmed.length === exactLen;
      } else if (vType === "email") {
        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
      } else if (vType === "cpf_cnpj") {
        isValid = isValidCpfOrCnpj(trimmed);
      }

      const outEdges = edges.filter((e: any) => e.from === currentNodeId);
      let selectedEdge;

      if (isValid) {
        // Formato correto - zera tentativas e vai pelo pino 'true'
        session.variables = session.variables || {};
        session.variables[`retry_count_${currentNodeId}`] = 0;
        delete session.variables.__validation_return_node_id;
        await supabase.from("automation_flow_sessions").update({ variables: session.variables }).eq("id", session.id);
        
        selectedEdge = outEdges.find((e: any) => e.sourceHandle === "true") || outEdges[0];
      } else {
        // Formato incorreto - atualiza contador
        session.variables = session.variables || {};
        let currentRetries = session.variables[`retry_count_${currentNodeId}`] || 0;
        currentRetries += 1;
        session.variables[`retry_count_${currentNodeId}`] = currentRetries;
        await supabase.from("automation_flow_sessions").update({ variables: session.variables }).eq("id", session.id);

        if (maxRetries === 0 || currentRetries < maxRetries) {
          // Tenta novamente
          selectedEdge = outEdges.find((e: any) => e.sourceHandle === "retry");
          if (!selectedEdge) selectedEdge = outEdges[0]; // fallback
          if (selectedEdge?.to) {
            session.variables.__validation_return_node_id = currentNodeId;
            await supabase.from("automation_flow_sessions").update({ variables: session.variables }).eq("id", session.id);
          }
        } else {
          // Limite excedido
          selectedEdge = outEdges.find((e: any) => e.sourceHandle === "false");
          if (!selectedEdge) selectedEdge = outEdges[0]; // fallback
          
          // Reseta para possível uso futuro
          session.variables[`retry_count_${currentNodeId}`] = 0;
          delete session.variables.__validation_return_node_id;
          await supabase.from("automation_flow_sessions").update({ variables: session.variables }).eq("id", session.id);
        }
      }

      if (!selectedEdge) { await markCompleted(); break; }
      currentNodeId = selectedEdge.to;
      await updateSession(currentNodeId);
      continue;
    }

    // Qualquer outro tipo de nó: apenas avança
    const nextEdge = edges.find((e: any) => e.from === currentNodeId);
    if (!nextEdge) { await markCompleted(); break; }
    currentNodeId = nextEdge.to;
    await updateSession(currentNodeId);
  }
}

// --- UTILS ---
function normalizeChatId(body: any) {
  const rawId = body.chatId || body.phone || body.from || body.data?.chatId || body.data?.phone;
  if (!rawId) return null;
  let id = String(rawId);
  if (id.includes("@g.us")) return id;
  if (id.includes("@c.us")) {
    const [phone] = id.split("@");
    return `${normalizeBrazilPhone(phone)}@c.us`;
  }
  if (!id.includes("@")) id += "@c.us";
  if (id.endsWith("@c.us")) {
    const [phone] = id.split("@");
    return `${normalizeBrazilPhone(phone)}@c.us`;
  }
  return id;
}

// --- MAIN SERVER ---
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const audit = url.searchParams.get("audit");

    // Audit: retorna fluxos ativos e configs dos nós para diagnóstico
    if (audit === "true") {
      const { data: flows } = await supabase.from("automation_flows").select("id, name, status, flow_json").eq("status", "active");
      const { data: sessions } = await supabase.from("automation_flow_sessions").select("*").eq("status", "active").order("updated_at", { ascending: false }).limit(10);
      
      // Extrai configs relevantes de cada nó
      const nodeAudit = (flows || []).map((f: any) => ({
        name: f.name,
        nodes: (f.flow_json?.nodes || []).filter((n: any) => n.type?.startsWith("send_")).map((n: any) => ({
          id: n.id, type: n.type,
          typing_seconds: n.config?.typing_seconds,
          recording_seconds: n.config?.recording_seconds,
        }))
      }));
      
      return new Response(JSON.stringify({ nodeAudit, sessions }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const incomingPayload = {
      hasToken: Boolean(token),
      keys: Object.keys(body || {}),
      dataKeys: Object.keys(body?.data || {}),
      chatId: body.chatId ?? body.data?.chatId ?? null,
      phone: body.phone ?? body.data?.phone ?? null,
      from: body.from ?? body.data?.from ?? null,
      fromMe: body.fromMe ?? body.sentByMe ?? body.data?.fromMe ?? null,
      connectedPhone: body.connectedPhone ?? body.data?.connectedPhone ?? body.instancePhone ?? body.data?.instancePhone ?? null,
      senderName: body.senderName ?? body.data?.senderName ?? null,
      type: body.type ?? body.data?.type ?? null,
      text: body.text ?? body.message?.text ?? body.data?.message?.text ?? null,
    };
    const { data: incomingLog } = await supabase.from("webhook_logs").insert({
      status: "incoming",
      headers: Object.fromEntries(req.headers.entries()),
      payload: incomingPayload,
    }).select("id").single();

    const updateWebhookLog = async (status: string, extraPayload: Record<string, any> = {}, errorMessage: string | null = null) => {
      if (!incomingLog?.id) return;
      await supabase.from("webhook_logs")
        .update({ status, error_message: errorMessage, payload: { ...incomingPayload, ...extraPayload } })
        .eq("id", incomingLog.id);
    };

    // Segurança por Token
    const { data: org } = await supabase.from("organizations").select("id").eq("whatsapp_token", token).maybeSingle();
    if (!org) {
      await updateWebhookLog("unauthorized", { tokenLength: token?.length ?? 0 });
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const chatId = normalizeChatId(body);
    if (!chatId) {
      await updateWebhookLog("skipped_no_chat_id");
      return new Response("No ID", { status: 200 });
    }

    if (chatId.includes("@g.us")) {
      await updateWebhookLog("skipped_group", { chatId });
      return new Response("Group ignored", { status: 200 });
    }

    // Ignora mensagens de/para o próprio número do bot (geradas pelo processo de encaminhamento)
    const botPhone = Deno.env.get("ZAPI_BOT_PHONE") ?? "";
    const chatRawPhone = chatId.split("@")[0].replace(/\D/g, "");
    const connectedPhone = String(body.connectedPhone || body.data?.connectedPhone || body.instancePhone || body.data?.instancePhone || "").replace(/\D/g, "");
    const botCandidates = [botPhone, connectedPhone].filter(Boolean).flatMap((phone) => {
      const raw = String(phone).replace(/\D/g, "");
      const normalized = normalizeBrazilPhone(raw);
      return [raw, normalized, raw.replace(/^55/, ""), normalized.replace(/^55/, "")];
    });
    if (botCandidates.some((phone) => chatRawPhone === phone || chatRawPhone === phone.replace(/^55/, ""))) {
      console.log("[Webhook] Mensagem do próprio bot ignorada.");
      await updateWebhookLog("skipped_self_message", { chatId, connectedPhone });
      return new Response("Bot self-message ignored", { status: 200 });
    }

    const rawText = body.text ?? body.message?.text ?? body.data?.message?.text ?? "";
    const content = typeof rawText === "object" ? (rawText?.message ?? "") : String(rawText ?? "");
    const sentByMe = body.fromMe || body.sentByMe || body.data?.fromMe || false;

    const rawPhone = chatId.split("@")[0].replace(/\D/g, "");
    const cleanPhone = normalizeBrazilPhone(rawPhone);

    // Identificar ou criar contato
    let contact = await findContactByPhone(supabase, org.id, rawPhone, cleanPhone);

    if (!contact && !sentByMe) {
      const { data: newContact, error: contactError } = await supabase.from("contacts").insert({
        org_id: org.id, name: body.senderName || "Novo Contato",
        phone: cleanPhone, is_auto_created: true
      }).select().single();
      if (contactError) {
        await updateWebhookLog("contact_error", { chatId, cleanPhone, rawPhone }, contactError.message);
      }
      contact = newContact;
    }

    if (!contact) {
      await updateWebhookLog("skipped_no_contact", { chatId, cleanPhone, rawPhone, sentByMe });
      return new Response("No contact", { status: 200 });
    }

    const thread = await upsertWhatsAppThread(supabase, org.id, contact, chatId, cleanPhone, connectedPhone);
    const threadId = thread?.id ?? null;

    // Thread para associar ao deal
    const { data: existingThread } = await supabase.from("deal_conversations")
      .select("deal_id")
      .eq("org_id", org.id)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const dealId = existingThread?.deal_id || null;

    // Salvar mensagem do cliente
    if (!sentByMe) {
      const { error: messageError } = await supabase.from("deal_conversations").insert({
        org_id: org.id, deal_id: dealId, contact_id: contact.id,
        thread_id: threadId, chat_id: chatId, sender_phone: cleanPhone, content: content,
        sender_type: "client", message_type: "text"
      });
      if (messageError) {
        await updateWebhookLog("message_error", { chatId, cleanPhone, contactId: contact.id }, messageError.message);
        return new Response(JSON.stringify({ error: messageError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await updateWebhookLog("saved_client_message", { chatId, cleanPhone, contactId: contact.id, threadId, content });
    }

    // Busca sessão ativa do fluxo
    const { data: session } = await supabase.from("automation_flow_sessions")
      .select("*, flow:automation_flows(*)")
      .eq("contact_id", contact.id)
      .eq("status", "active")
      .maybeSingle();

    if (session && !sentByMe) {
      const flowJson = session.flow.flow_json;
      const currentNode = flowJson.nodes.find((n: any) => n.id === session.current_node_id);

      console.log(`[Webhook] Sessão encontrada. Nó atual: ${currentNode?.type} (${session.current_node_id})`);

      if (currentNode?.type === "send_options") {
        const options = String(currentNode.config.options || "").split('\n').filter(Boolean);
        const msgNum = parseInt(String(content).trim(), 10);

        console.log(`[Webhook] Usuário digitou: "${content}" | Opções disponíveis: ${options.length}`);

        if (!isNaN(msgNum) && msgNum > 0 && msgNum <= options.length) {
          const outEdges = (flowJson.edges || []).filter((e: any) => e.from === currentNode.id);
          // Tenta achar a aresta da opção específica, senão pega pela posição
          const selectedEdge = outEdges.find((e: any) => e.sourceHandle === `option_${msgNum}`) || outEdges[msgNum - 1];

          if (selectedEdge) {
            console.log(`[Webhook] Opção ${msgNum} selecionada → próximo nó: ${selectedEdge.to}`);

            // Atualiza sessão IMEDIATAMENTE para o próximo nó, ANTES de qualquer envio
            let variables = session.variables || {};
            variables.last_message = String(content).trim();
            
            await supabase.from("automation_flow_sessions")
              .update({ 
                current_node_id: selectedEdge.to, 
                variables: variables,
                updated_at: new Date().toISOString() 
              })
              .eq("id", session.id);
            session.current_node_id = selectedEdge.to;
            session.variables = variables;

            await executeFlowLoop(supabase, session, flowJson, contact, chatId, dealId, threadId);
          } else {
            console.log(`[Webhook] Nenhuma aresta encontrada para opção ${msgNum}`);
          }
        } else {
          console.log(`[Webhook] Entrada inválida: "${content}"`);
          if (currentNode.config?.invalid_message) {
            await sendToZApi({
              endpoint: "send-text",
              payload: { phone: cleanPhone, message: currentNode.config.invalid_message, delayMessage: 1, delayTyping: 1 }
            });
            await saveBotMessageToInbox(supabase, contact, session.org_id, chatId, dealId, currentNode.config.invalid_message, session.flow_id, threadId);
          }
        }
      } else if (currentNode?.type === "ask_question") {
        // Salva a resposta no contexto para os próximos nós de condição
        let variables = session.variables || {};
        variables.last_message = String(content).trim();
        
        const outEdges = (flowJson.edges || []).filter((e: any) => e.from === currentNode.id);
        if (outEdges.length > 0) {
          await supabase.from("automation_flow_sessions")
            .update({ 
              current_node_id: outEdges[0].to, 
              variables: variables,
              updated_at: new Date().toISOString() 
            })
            .eq("id", session.id);
          session.current_node_id = outEdges[0].to;
          session.variables = variables;
          await executeFlowLoop(supabase, session, flowJson, contact, chatId, dealId, threadId);
        }
      } else if (currentNode?.type === "condition_validation" || currentNode?.type === "action_validation") {
        let variables = session.variables || {};
        variables.last_message = String(content).trim();
        variables.last_message_type = body.type ?? body.data?.type ?? null;

        await supabase.from("automation_flow_sessions")
          .update({
            variables: variables,
            updated_at: new Date().toISOString()
          })
          .eq("id", session.id);

        session.variables = variables;
        await executeFlowLoop(supabase, session, flowJson, contact, chatId, dealId, threadId);
      }
    } else if (!sentByMe && !session) {
      // Dispara novo fluxo
      const { data: flows } = await supabase.from("automation_flows")
        .select("*").eq("org_id", org.id).eq("status", "active");

      if (flows && flows.length > 0) {
        const flow = flows[0];
        const startNode = flow.flow_json.nodes.find((n: any) => n.type === "trigger_start" || n.type === "start");

        if (startNode) {
          const { data: newSession } = await supabase.from("automation_flow_sessions").insert({
            org_id: org.id, flow_id: flow.id, contact_id: contact.id,
            current_node_id: startNode.id, status: "active"
          }).select().single();

          if (newSession) {
            console.log(`[Webhook] Novo fluxo iniciado: ${flow.name}`);
            await executeFlowLoop(supabase, newSession, flow.flow_json, contact, chatId, dealId, threadId);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
