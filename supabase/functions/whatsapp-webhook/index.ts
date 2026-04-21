import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeChatId(body: Record<string, any>) {
  const rawId = body.chatLid || body.senderLid || body.participantLid ||
    body.chatId || body.phone || body.from ||
    body.data?.chatLid || body.data?.senderLid || body.data?.participantLid ||
    body.data?.chatId || body.data?.phone;

  if (!rawId) return null;

  let chatId = String(rawId);
  const isGroupPayload = Boolean(body.isGroup || body.data?.isGroup);

  if (isGroupPayload && !chatId.includes("@g.us")) chatId += "@g.us";
  if (!chatId.includes("@")) chatId += "@c.us";

  return chatId;
}

function normalizeContactPhone(body: Record<string, any>) {
  const candidates = [
    body.senderPhone,
    body.participantPhone,
    body.phone,
    body.from,
    body.data?.senderPhone,
    body.data?.participantPhone,
    body.data?.phone,
    body.data?.from,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const raw = String(candidate).trim();
    if (raw.includes("@lid") || raw.includes("@g.us")) continue;

    const digits = raw.split("@")[0].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) return digits;
  }

  return null;
}

function isGenericName(name?: string | null) {
  if (!name) return true;
  return ["Contato WhatsApp", "Lead WhatsApp", "Grupo WhatsApp"].includes(name);
}

function firstMeaningfulName(...names: Array<unknown>) {
  for (const name of names) {
    const value = String(name || "").trim();
    if (value && !isGenericName(value)) return value;
  }

  return null;
}

async function fetchZapiContactName(identifiers: string[]) {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN");
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

  if (!instanceId || !instanceToken) return null;

  const headers: Record<string, string> = {};
  if (clientToken) headers["Client-Token"] = clientToken;

  for (const identifier of identifiers) {
    if (!identifier) continue;

    try {
      const url = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/contacts/${encodeURIComponent(identifier)}`;
      const response = await fetch(url, { headers });
      if (!response.ok) continue;

      const data = await response.json().catch(() => null);
      const name = firstMeaningfulName(data?.name, data?.notify, data?.short, data?.vname);
      if (name) return name;
    } catch (err) {
      console.warn("ZAPI CONTACT LOOKUP FAILED:", identifier, err);
    }
  }

  return null;
}

function getMediaInfo(body: Record<string, any>) {
  let type = body.type || body.data?.type || "text";
  let url = body.mediaUrl || body.data?.mediaUrl || null;
  let caption = "";

  if (body.image || body.data?.image) {
    const image = body.image || body.data.image;
    type = "image";
    url = image.imageUrl || image.url || url;
    caption = image.caption || "";
  } else if (body.audio || body.data?.audio) {
    const audio = body.audio || body.data.audio;
    type = "audio";
    url = audio.audioUrl || audio.url || url;
  } else if (body.video || body.data?.video) {
    const video = body.video || body.data.video;
    type = "video";
    url = video.videoUrl || video.url || url;
    caption = video.caption || "";
  } else if (body.document || body.data?.document) {
    const document = body.document || body.data.document;
    type = "document";
    url = document.documentUrl || document.url || url;
    caption = document.fileName || "";
  } else if (body.sticker || body.data?.sticker) {
    const sticker = body.sticker || body.data.sticker;
    type = "image";
    url = sticker.stickerUrl || sticker.url || url;
  }

  if (type === "ptt") type = "audio";
  if (type === "sticker") type = "image";

  return { type, url, caption };
}

function getText(body: Record<string, any>, media: { type: string; url: string | null; caption: string }) {
  const msg = body.text?.message || body.data?.text?.message ||
    body.text || body.data?.text || body.conversation ||
    body.message?.conversation || body.extendedTextMessage?.text ||
    media.caption;

  return msg ? String(msg) : (media.url ? `[Midia: ${media.type}]` : "[Mensagem sem texto]");
}

function isSentByMe(body: Record<string, any>) {
  const value = body.fromMe ?? body.sentByMe ?? body.isFromMe ??
    body.data?.fromMe ?? body.data?.sentByMe ?? body.data?.isFromMe;

  return value === true || value === "true" || value === 1 || value === "1";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const body = await req.json().catch(() => ({}));

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("whatsapp_token", token)
      .maybeSingle();

    if (!org) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const chatId = normalizeChatId(body);
    if (!chatId) return new Response("No ID", { headers: corsHeaders });

    const isGroup = chatId.includes("@g.us");
    const contactPhone = isGroup ? chatId : normalizeContactPhone(body);
    const contactIdentity = contactPhone || chatId;
    const groupName = body.chatName || body.data?.chatName;
    const payloadName = firstMeaningfulName(
      body.senderName,
      body.data?.senderName,
      body.chatName || body.data?.chatName ||
      body.pushName || body.data?.pushName ||
      body.notify || body.data?.notify,
    );
    const zapiContactName = isGroup ? null : await fetchZapiContactName([
      contactPhone || "",
      chatId,
      contactIdentity,
    ]);
    const senderName = payloadName || zapiContactName;
    const finalDisplayName = isGroup
      ? (groupName || "Grupo WhatsApp")
      : (senderName || "Lead WhatsApp");

    const { data: existingThread } = await supabase
      .from("deal_conversations")
      .select("contact_id, contact:contacts(id, name, phone)")
      .eq("org_id", org.id)
      .eq("chat_id", chatId)
      .not("contact_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let contact = existingThread?.contact || null;

    if (!contact && contactPhone) {
      const { data: contactByPhone } = await supabase
        .from("contacts")
        .select("id, name, phone")
        .eq("phone", contactPhone)
        .eq("org_id", org.id)
        .maybeSingle();

      contact = contactByPhone;
    }

    if (!contact) {
      const { data: contactByIdentity } = await supabase
        .from("contacts")
        .select("id, name, phone")
        .eq("phone", contactIdentity)
        .eq("org_id", org.id)
        .maybeSingle();

      contact = contactByIdentity;
    }

    if (!contact) {
      const { data: createdContact } = await supabase
        .from("contacts")
        .insert({
          name: finalDisplayName,
          phone: contactIdentity,
          org_id: org.id,
          is_auto_created: true,
        })
        .select("id, name, phone")
        .single();
      contact = createdContact;
    } else if (finalDisplayName && (isGenericName(contact.name) || (isGroup && groupName && contact.name !== groupName))) {
      await supabase.from("contacts").update({ name: finalDisplayName }).eq("id", contact.id);
      contact = { ...contact, name: finalDisplayName };
    }

    const media = getMediaInfo(body);
    const externalId = body.messageId || body.data?.messageId || `${chatId}-${Date.now()}`;
    const sentByMe = isSentByMe(body);
    const content = getText(body, media).substring(0, 2000);

    if (sentByMe) {
      const { data: existingOutbound } = await supabase
        .from("deal_conversations")
        .select("id")
        .eq("org_id", org.id)
        .eq("chat_id", chatId)
        .eq("sender_type", "sales")
        .eq("content", content)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingOutbound?.id) {
        await supabase
          .from("deal_conversations")
          .update({ external_message_id: externalId })
          .eq("id", existingOutbound.id);

        return new Response(JSON.stringify({ ok: true, skipped: "outbound_duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error } = await supabase.from("deal_conversations").insert({
      org_id: org.id,
      chat_id: chatId,
      contact_id: contact?.id,
      sender_phone: contact?.phone || contactIdentity,
      content,
      sender_type: sentByMe ? "sales" : "client",
      source: "whatsapp",
      external_message_id: externalId,
      is_group: isGroup,
      sender_name: senderName,
      message_type: media.type,
      media_url: media.url,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("WEBHOOK ERROR:", err.message);
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});
