import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-flow-secret",
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

function injectVariables(text: string, contact: any) {
  if (!text) return "";
  let result = text;
  
  if (contact) {
    // Suporte a múltiplos formatos de variáveis
    const name = contact.name || "Cliente";
    const phone = contact.phone || "";
    const empresa = contact.company_name || "";
    
    result = result.replace(/\{nome\}/g, name);
    result = result.replace(/\{contato\.nome\}/g, name);
    result = result.replace(/\{telefone\}/g, phone);
    result = result.replace(/\{contato\.telefone\}/g, phone);
    result = result.replace(/\{empresa\}/g, empresa);
  }
  return result;
}

function buildZApiPayload(node: any, phone: string, contact: any) {
  const stepType = node.type;
  const config = node.config || {};
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
        message += "\n\n" + opts.map((opt, i) => {
          const num = i + 1;
          const spaceBeforeHyphen = num === 1 ? '  ' : ' ';
          return `${num}${spaceBeforeHyphen}- ${opt.trim()}`;
        }).join('\n');
      }
    }
  } else if (stepType === "send_image") {
    type = "image";
    mediaUrl = config.image_url || config.image_link || "";
    caption = injectVariables(config.message || "", contact);
  } else if (stepType === "send_video") {
    type = "video";
    mediaUrl = config.video_url || config.video_link || "";
    caption = injectVariables(config.message || "", contact);
  } else if (stepType === "send_audio") {
    type = "audio";
    mediaUrl = config.audio_url || config.audio_link || "";
  } else if (stepType === "send_document") {
    type = "document";
    mediaUrl = config.document_url || config.document_link || "";
  } else if (stepType === "send_link") {
    type = "text";
    message = injectVariables(config.message ? config.message + "\n\n" : "", contact) + (config.link_url || "");
  } else {
    return null; // Not a send message node
  }

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

async function sendToZApi(zapiData: any) {
  // Chamamos a Z-API diretamente para evitar problemas de autenticação de usuário
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID") ?? "";
  const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN") ?? "";
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";

  if (!instanceId || !instanceToken) {
    throw new Error("Credenciais Z-API não configuradas (ZAPI_INSTANCE_ID / ZAPI_INSTANCE_TOKEN).");
  }

  const endpoint = zapiData.endpoint;
  const payload = zapiData.payload;

  const url = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/${endpoint}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;

  console.log(`[Flow Engine] Enviando mensagem via Z-API (${endpoint}) para ${payload.phone}...`);
  console.log(`[Flow Engine] DEBUG Payload:`, JSON.stringify(payload));
  console.log(`[Flow Engine] DEBUG Instance: ${instanceId} | Token final: ...${instanceToken.slice(-4)}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errMsg = (data as any).message || (data as any).error || "Erro na Z-API.";
      console.error(`[Flow Engine] ERRO Z-API (${response.status}):`, errMsg);
      throw new Error(errMsg);
    }

    console.log(`[Flow Engine] Mensagem enviada com sucesso! ID: ${(data as any).messageId || 'N/A'}`);
  } catch (err: any) {
    console.error(`[Flow Engine] Falha crítica no fetch Z-API:`, err.message);
    throw err;
  }
}

// Retorna se um nó deve "parar e esperar" resposta do usuario
function isWaitingNode(nodeType: string) {
  return nodeType === "send_options" || nodeType === "send_action_buttons" || nodeType.startsWith("condition_");
}

function normalizePhone(phone: string) {
  if (!phone) return "";
  const numeric = phone.replace(/\D/g, "");
  // Se não tem DDI, assume Brasil (55)
  if (numeric.length <= 11) return `55${numeric}`;
  return numeric;
}

// Salva a mensagem do bot direto no deal_conversations para aparecer no inbox
async function saveMessageToInbox(supabase: any, contact: any, orgId: string, chatId: string | null, dealId: string | null, messageText: string, flowId: string, threadId: string | null = null) {
  try {
    console.log(`[Flow Engine] Inbox | chat_id: ${chatId} | deal_id: ${dealId} | contact: ${contact.id}`);

    let thread: any = null;

    if (threadId) {
      const { data: stableThread } = await supabase
        .from("whatsapp_threads")
        .select("id, org_id, contact_id, chat_id")
        .eq("id", threadId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (stableThread) {
        thread = {
          thread_id: stableThread.id,
          org_id: stableThread.org_id,
          deal_id: dealId,
          chat_id: stableThread.chat_id || chatId || contact.phone,
        };
      }
    }

    // Estratégia 1: usa deal_id diretamente (mais confiável)
    if (dealId) {
      const { data: dealThread } = await supabase
        .from("deal_conversations")
        .select("deal_id, org_id, thread_id, chat_id")
        .eq("org_id", orgId)
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dealThread) {
        thread = dealThread;
        console.log(`[Flow Engine] Thread via deal_id ${dealId}: chat_id = ${dealThread.chat_id}`);
      }
    }

    // Estratégia 2: usa chat_id diretamente (sem org_id para evitar mismatch)
    if (!thread && chatId) {
      const { data: chatThread } = await supabase
        .from("deal_conversations")
        .select("deal_id, org_id, thread_id, chat_id")
        .eq("org_id", orgId)
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (chatThread) {
        thread = chatThread;
        console.log(`[Flow Engine] Thread via chat_id ${chatId}`);
      }
    }

    // Estratégia 3: deal vinculado ao contato
    if (!thread) {
      const { data: deal } = await supabase
        .from("deals")
        .select("id")
        .eq("org_id", orgId)
        .eq("contact_id", contact.id)          // sem filtro de org — pode haver mismatch
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (deal?.id) {
        const { data: dealThread } = await supabase
          .from("deal_conversations")
          .select("deal_id, org_id, thread_id, chat_id")
          .eq("org_id", orgId)
          .eq("deal_id", deal.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dealThread) {
          thread = dealThread;
          console.log(`[Flow Engine] Thread via contact→deal`);
        }
      }
    }

    // Estratégia 4: contact_id direto em deal_conversations (sem org_id para evitar mismatch)
    if (!thread) {
      const { data: contactThread } = await supabase
        .from("deal_conversations")
        .select("deal_id, org_id, thread_id, chat_id")
        .eq("org_id", orgId)
        .eq("contact_id", contact.id)          // sem filtro de org_id
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contactThread) {
        thread = contactThread;
        console.log(`[Flow Engine] Thread via contact_id (sem org filter)`);
      }
    }

    // Estratégia 5: Fallback total — busca na marra qualquer rastro desse contato no DB
    if (!thread) {
      // Tenta primeiro o Negócio mais recente
      const { data: latestDeal } = await supabase
        .from("deals")
        .select("id, org_id")
        .eq("org_id", orgId)
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestDeal) {
        thread = {
          deal_id: latestDeal.id,
          org_id: latestDeal.org_id,
          thread_id: threadId,
          chat_id: chatId || contact.phone || `chat:${contact.id}`
        };
        console.log(`[Flow Engine] Thread via Fallback (Deal: ${latestDeal.id})`);
      } else {
        // Se não tem Deal, tenta roubar os IDs de qualquer conversa anterior
        const { data: lastConv } = await supabase
          .from("deal_conversations")
          .select("deal_id, org_id, thread_id, chat_id")
          .eq("org_id", orgId)
          .eq("contact_id", contact.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastConv) {
          thread = lastConv;
          console.log(`[Flow Engine] Thread via Fallback (Conversa anterior: ${lastConv.deal_id})`);
        }
      }
    }

    // Estratégia 6: Busca desesperada pelo TELEFONE do contato
    if (!thread && contact.phone) {
      const cleanPhone = contact.phone.replace(/\D/g, "");
      const { data: phoneConv } = await supabase
        .from("deal_conversations")
        .select("deal_id, org_id, thread_id, chat_id")
        .eq("org_id", orgId)
        .or(`sender_phone.eq.${cleanPhone},sender_phone.eq.55${cleanPhone}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (phoneConv) {
        thread = phoneConv;
        console.log(`[Flow Engine] Thread via Fallback de TELEFONE (${cleanPhone})`);
      }
    }

    if (!thread) {
      console.log(`[Flow Engine] ❌ Nenhuma thread encontrada para o contato ${contact.id} (Fone: ${contact.phone}).`);
      return;
    }

    const rawPhone = String(contact.phone || "").replace(/\D/g, "");
    const phone55 = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;

    const { error: insertErr } = await supabase.from("deal_conversations").insert({
      org_id: thread.org_id,
      deal_id: thread.deal_id,
      contact_id: contact.id,
      thread_id: thread.thread_id || threadId,
      chat_id: thread.chat_id,
      sender_phone: phone55,
      content: messageText,
      sender_type: "sales",
      message_type: "text",
      metadata: { flow_id: flowId, automated: true, ai_status: "flow_bot" },
    });

    if (insertErr) {
      console.error(`[Flow Engine] Erro no insert:`, JSON.stringify(insertErr));
    } else {
      console.log(`[Flow Engine] ✅ Mensagem salva no inbox (deal: ${thread.deal_id}).`);
    }
  } catch (err: any) {
    console.error("[Flow Engine] Erro ao salvar mensagem no inbox:", err.message);
  }
}

async function executeNodesLoop(supabase: any, session: any, flowJson: any, contact: any, chatId: string | null = null, dealId: string | null = null, threadId: string | null = null) {
  const nodes = flowJson.nodes || [];
  const edges = flowJson.edges || [];
  
  let currentNodeId = session.current_node_id;
  const cleanPhone = normalizePhone(contact.phone);
  
  console.log(`[Flow Engine] Iniciando loop para contato ${contact.id} (${cleanPhone}) no nó ${currentNodeId}`);

  while (true) {
    const currentNode = nodes.find((n: any) => n.id === currentNodeId);
    if (!currentNode) {
      console.log(`[Flow Engine] Nó ${currentNodeId} não encontrado. Finalizando fluxo.`);
      await supabase.from("automation_flow_sessions").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", session.id);
      break;
    }

    console.log(`[Flow Engine] Executando nó: ${currentNode.id} (${currentNode.type})`);

    // Se o nó for de mensagem, enviamos
    if (currentNode.type.startsWith("send_")) {
      const zapiData = buildZApiPayload(currentNode, cleanPhone, contact);
      if (zapiData) {
        try {
          console.log(`[Flow Engine] Enviando mensagem via Z-API (${zapiData.endpoint})...`);
          await sendToZApi(zapiData);
          console.log(`[Flow Engine] Mensagem enviada com sucesso.`);

          // Salva a mensagem no inbox do CRM
          const msgText = zapiData.payload.message || zapiData.payload.caption || `[${currentNode.type}]`;
          await saveMessageToInbox(supabase, contact, session.org_id, chatId, dealId, msgText, session.flow_id, threadId);
          
          await supabase.from("automation_flow_logs").insert({
            flow_id: session.flow_id,
            event: "node_executed",
            payload: { node_id: currentNodeId, type: currentNode.type },
            level: "info"
          });
        } catch (err: any) {
          console.error(`[Flow Engine] ERRO ao enviar mensagem:`, err.message);
          console.log(`[Flow Engine] 🔓 Encerrando sessão por erro para destravar contato.`);
          await supabase.from("automation_flow_sessions").update({ 
            status: "error", 
            metadata: { last_error: err.message },
            updated_at: new Date().toISOString() 
          }).eq("id", session.id);
          break; 
        }
      }
    }

    // Se for nó de espera (Opções ou Pergunta), paramos o loop para aguardar o webhook da resposta
    if (isWaitingNode(currentNode.type) || currentNode.type === 'ask_question') {
      console.log(`[Flow Engine] Nó de espera detectado (${currentNode.type}). Pausando execução.`);
      break; 
    }

    // Achar próxima conexão
    const nextEdges = edges.filter((e: any) => e.from === currentNodeId);
    if (nextEdges.length === 0) {
      console.log(`[Flow Engine] Fim do caminho linear. Finalizando fluxo.`);
      await supabase.from("automation_flow_sessions").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", session.id);
      break;
    }

    // Se for caminho linear, pegamos o primeiro edge
    const nextEdge = nextEdges[0];
    currentNodeId = nextEdge.to;

    console.log(`[Flow Engine] Avançando para o próximo nó: ${currentNodeId}`);

    // Atualiza sessão no banco com o novo nó
    await supabase.from("automation_flow_sessions").update({ current_node_id: currentNodeId, updated_at: new Date().toISOString() }).eq("id", session.id);

    // Human delay entre envios automáticos contínuos
    await delay(1500);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authenticated = true;
    let userId = null;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const { action, org_id, contact_id, flow_id, message_text, chat_id, thread_id, deal_id: requestDealId } = body;

    if (!action || !org_id || !contact_id) {
      throw new Error("Parâmetros obrigatórios ausentes.");
    }

    // Busca dados do contato
    const { data: contact } = await supabase.from("contacts").select("*").eq("id", contact_id).maybeSingle();
    if (!contact) throw new Error("Contato não encontrado.");

    if (action === "start") {
      if (!flow_id) throw new Error("flow_id obrigatório para start.");

      // Verifica se já tem sessão ativa
      const { data: activeSession } = await supabase
        .from("automation_flow_sessions")
        .select("*")
        .eq("contact_id", contact_id)
        .eq("status", "active")
        .maybeSingle();

      if (activeSession) {
        return new Response(JSON.stringify({ message: "Contato já está em um fluxo ativo." }), { status: 200, headers: corsHeaders });
      }

      // Busca fluxo
      const { data: flow } = await supabase.from("automation_flows").select("flow_json").eq("id", flow_id).maybeSingle();
      if (!flow) throw new Error("Fluxo não encontrado.");

      const flowJson = flow.flow_json;
      const startNode = flowJson.nodes.find((n: any) => n.type === "trigger_start");
      if (!startNode) throw new Error("Fluxo não possui nó de início.");

      // Cria sessão
      const { data: newSession, error: sessionErr } = await supabase
        .from("automation_flow_sessions")
        .insert({
          org_id,
          flow_id,
          contact_id,
          current_node_id: startNode.id,
          status: "active"
        })
        .select()
        .single();

      if (sessionErr) throw sessionErr;

      // Inicia o Loop de Execução
      await executeNodesLoop(supabase, newSession, flowJson, contact, chat_id || null, requestDealId || null, thread_id || null);

      return new Response(JSON.stringify({ success: true, message: "Fluxo iniciado." }), { status: 200, headers: corsHeaders });
    }

    if (action === "process_message") {
      console.log(`[Flow Engine] 🔍 Processando resposta: "${message_text}" para o Contato: ${contact_id}`);

      // Busca o telefone do contato atual para busca resiliente
      const { data: currentContact } = await supabase.from("contacts").select("phone").eq("id", contact_id).single();
      const cleanPhone = currentContact?.phone?.replace(/\D/g, "");

      if (!cleanPhone) {
        console.log(`[Flow Engine] ❌ Telefone não encontrado para o contato ${contact_id}`);
        return new Response(JSON.stringify({ error: "Contato sem telefone." }), { status: 200, headers: corsHeaders });
      }

      // Busca todos os IDs de contato que tenham esse mesmo telefone
      const { data: relatedContacts } = await supabase
        .from("contacts")
        .select("id")
        .or(`phone.eq.${cleanPhone},phone.eq.55${cleanPhone}`);
      
      const contactIds = (relatedContacts || []).map(c => c.id);

      // Busca sessão ativa para qualquer um desses IDs (seguro contra duplicatas)
      const { data: session } = await supabase
        .from("automation_flow_sessions")
        .select("*, flow:automation_flows(*)")
        .eq("contact_id", contact_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session) {
        console.log(`[Flow Engine] ⚠️ Nenhuma sessão ativa para o telefone ${cleanPhone}. Ignorando mensagem.`);
        return new Response(JSON.stringify({ message: "Nenhum fluxo ativo." }), { status: 200, headers: corsHeaders });
      }

      console.log(`[Flow Engine] ✅ Sessão encontrada: ${session.id} | Nó Atual: ${session.current_node_id}`);

      const { data: flow } = await supabase.from("automation_flows").select("flow_json").eq("id", session.flow_id).maybeSingle();
      if (!flow) throw new Error("Fluxo não encontrado.");

      const flowJson = flow.flow_json;
      const currentNode = flowJson.nodes.find((n: any) => n.id === session.current_node_id);
      
      if (!currentNode) {
         console.log(`[Flow Engine] ❌ Nó atual ${session.current_node_id} não existe no fluxo. Encerrando.`);
         await supabase.from("automation_flow_sessions").update({ status: "completed" }).eq("id", session.id);
         return new Response(JSON.stringify({ message: "Nó atual não encontrado. Sessão encerrada." }), { status: 200, headers: corsHeaders });
      }

      if (currentNode.type === "send_options") {
        const options = String(currentNode.config.options || "").split('\n').filter(Boolean);
        const edges = flowJson.edges || [];
        const outEdges = edges.filter((e: any) => e.from === currentNode.id);
        const cleanInput = String(message_text || "").trim().toLowerCase();
        
        console.log(`[Flow Engine] Nó de Opções. Entrada: "${cleanInput}". Edges saindo: ${outEdges.length}`);

        let matchIndex = -1;
        const msgNum = parseInt(cleanInput, 10);
        
        if (!isNaN(msgNum) && msgNum > 0 && msgNum <= options.length) {
          matchIndex = msgNum - 1;
        }

        if (matchIndex !== -1) {
          const targetHandleId = `option_${matchIndex + 1}`;
          // Tenta achar pelo Handle, depois pela Label, depois pela posição
          const selectedEdge = outEdges.find((e: any) => e.sourceHandle === targetHandleId)
            || outEdges.find((e: any) => String(e.label).toLowerCase() === String(matchIndex + 1))
            || outEdges[matchIndex];

          console.log(`[Flow Engine] Escolha detectada: Opção ${matchIndex + 1}. Edge destino: ${selectedEdge?.to}`);

          if (selectedEdge) {
            const nextNodeId = selectedEdge.to;
            await supabase.from("automation_flow_sessions").update({ 
              current_node_id: nextNodeId, 
              updated_at: new Date().toISOString() 
            }).eq("id", session.id);
            
            session.current_node_id = nextNodeId;
            await executeNodesLoop(supabase, session, flowJson, contact, chat_id || null, requestDealId || null, thread_id || null);
          } else {
             // Caminho não conectado, encerra
             console.log(`[Flow Engine] Nenhuma edge encontrada para opção ${matchIndex + 1}. Encerrando sessão.`);
             await supabase.from("automation_flow_sessions").update({ status: "completed" }).eq("id", session.id);
          }
        } else {
          // Resposta inválida: podemos mandar fallback e manter o node atual para que ele responda de novo
          const zapiData = {
             endpoint: "send-text",
             payload: {
               phone: contact.phone,
               message: "⚠️ Opção inválida. Por favor, digite o número de uma das opções acima."
             }
          };
          await sendToZApi(zapiData);
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Mensagem processada no fluxo." }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Ação inválida." }), { status: 400, headers: corsHeaders });

  } catch (err: any) {
    console.error("Flow engine error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});
