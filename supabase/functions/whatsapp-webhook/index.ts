import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const { data: org } = await supabase.from("organizations").select("id").eq("whatsapp_token", token).maybeSingle();
    if (!org) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    // --- [ EXTRAÇÃO DE ID v21 ] ---
    const rawId = body.chatLid || body.chatId || body.phone || body.from || 
                  body.data?.chatLid || body.data?.chatId || body.data?.phone;
    
    if (!rawId) return new Response("No ID", { headers: corsHeaders });

    // Normalização agressiva do JID (garante @g.us ou @c.us ou @lid)
    let chatId = String(rawId);
    if (body.isGroup && !chatId.includes("@g.us")) chatId += "@g.us";
    if (!chatId.includes("@")) chatId += "@c.us";

    const isGroup = chatId.includes("@g.us");
    const contactPhone = isGroup ? chatId : chatId.replace(/\D/g, "");
    
    // --- [ NOME DO CHAT vs NOME DO REMETENTE ] ---
    // v21: Para grupos, NUNCA use o senderName como nome do contato
    const groupName = body.chatName || body.data?.chatName;
    const senderName = body.senderName || body.data?.senderName || body.pushName;
    
    const finalDisplayName = isGroup 
      ? (groupName || "Grupo WhatsApp") 
      : (senderName || "Lead WhatsApp");

    // 1. Criar/Atualizar Contato (A âncora do chat)
    let { data: contact } = await supabase.from("contacts").select("id, name").eq("phone", contactPhone).eq("org_id", org.id).maybeSingle();
    
    if (!contact) {
       const { data: nc } = await supabase.from("contacts").insert({ 
         name: finalDisplayName, 
         phone: contactPhone, 
         org_id: org.id 
       }).select().single();
       contact = nc;
    } else if (isGroup && groupName && contact.name !== groupName) {
       // Se o nome do grupo mudou ou estava errado (ex: "Andre"), atualizamos agora
       await supabase.from("contacts").update({ name: groupName }).eq("id", contact.id);
    }

    // --- [ EXTRAÇÃO MULTIMÍDIA v24 ] ---
    const getMediaInfo = () => {
      // Prioridade: Imagem -> Áudio -> Vídeo -> Documento
      let type = body.type || body.data?.type || "text";
      
      // Normalização Elite: Z-API usa 'ptt' para áudio de voz, o banco usa 'audio'
      if (type === 'ptt') type = 'audio';
      if (type === 'sticker') type = 'image'; // Stickers como imagens

      let url = body.mediaUrl || body.data?.mediaUrl;
      
      // Mapeamento específico da Z-API para diferentes tipos
      if (!url) {
        url = body.image?.url || body.data?.image?.url || 
              body.audio?.url || body.data?.audio?.url || 
              body.video?.url || body.data?.video?.url ||
              body.document?.url || body.data?.document?.url ||
              body.sticker?.url || body.data?.sticker?.url;
      }

      // 1. Identificar o tipo real por exclusão (Z-API v2 usa ReceivedCallback como type genérico)
      let type = "text";
      let url = null;
      let caption = "";

      if (body.image) {
        type = "image";
        url = body.image.imageUrl || body.image.url;
        caption = body.image.caption || "";
      } else if (body.audio) {
        type = "audio";
        url = body.audio.audioUrl || body.audio.url;
      } else if (body.video) {
        type = "video";
        url = body.video.videoUrl || body.video.url;
        caption = body.video.caption || "";
      } else if (body.document) {
        type = "document";
        url = body.document.documentUrl || body.document.url;
        caption = body.document.fileName || "";
      } else if (body.sticker) {
        type = "image"; // Stickers tratados como imagem
        url = body.sticker.stickerUrl || body.sticker.url;
      }

      // Fallback para tipos diretos (versões antigas)
      if (type === "text") {
        type = body.type || body.data?.type || "text";
        if (type === 'ptt') type = 'audio';
        url = url || body.mediaUrl || body.data?.mediaUrl;
      }

      return { type, url, caption };
    };

    const media = getMediaInfo();

    const getText = () => {
      const msg = body.text?.message || body.data?.text?.message || 
                  body.text || body.data?.text || body.conversation || 
                  body.message?.conversation || body.extendedTextMessage?.text ||
                  media.caption;
      
      return msg ? String(msg) : (media.url ? `[Mídia: ${media.type}]` : "[Mensagem sem texto]");
    };

    // 2. Salvar Conversa
    const { error } = await supabase.from("deal_conversations").insert({
      org_id: org.id,
      chat_id: chatId,
      contact_id: contact?.id,
      sender_phone: contactPhone,
      content: getText().substring(0, 2000),
      sender_type: "client",
      source: "whatsapp",
      external_message_id: body.messageId || body.data?.messageId || `ID-${Date.now()}`,
      is_group: isGroup,
      sender_name: senderName,
      message_type: media.type,
      media_url: media.url
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("WEBHOOK ERROR:", err.message);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});
