import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeChatId(body: Record<string, any>) {
  const isGroupPayload = Boolean(body.isGroup || body.data?.isGroup) ||
    String(body.chatId || body.data?.chatId || body.from || body.data?.from || "").includes("@g.us");
  const groupId = body.chatId || body.data?.chatId || body.from || body.data?.from ||
    body.phone || body.data?.phone;
  const rawId = isGroupPayload
    ? groupId
    : body.chatLid || body.senderLid || body.participantLid ||
      body.chatId || body.phone || body.from ||
      body.data?.chatLid || body.data?.senderLid || body.data?.participantLid ||
      body.data?.chatId || body.data?.phone;

  if (!rawId) return null;

  let chatId = String(rawId);

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

function detectGroup(body: Record<string, any>, chatId: string) {
  return Boolean(body.isGroup || body.data?.isGroup) ||
    chatId.includes("@g.us") ||
    String(body.chatId || body.data?.chatId || "").includes("@g.us") ||
    String(body.from || body.data?.from || "").includes("@g.us");
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

function normalizePhoneValue(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("@lid") || raw.includes("@g.us")) return null;

  const digits = raw.split("@")[0].replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

function buildThreadAliases(params: {
  chatId: string;
  contactPhone: string | null;
  contactId?: string | null;
  isGroup?: boolean;
}) {
  const aliases = new Set<string>();
  aliases.add(`chat:${params.chatId}`);

  if (!params.isGroup && params.contactPhone) aliases.add(`phone:${params.contactPhone}`);
  if (params.contactId) aliases.add(`contact:${params.contactId}`);

  return [...aliases];
}

async function resolveThreadKey(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  aliases: string[],
) {
  const { data } = await supabase
    .from("whatsapp_thread_aliases")
    .select("thread_key")
    .eq("org_id", orgId)
    .in("alias", aliases)
    .limit(1)
    .maybeSingle();

  return data?.thread_key || aliases[0];
}

async function upsertThreadAliases(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  threadKey: string,
  aliases: string[],
  contactId?: string | null,
) {
  const rows = aliases.map((alias) => ({
    org_id: orgId,
    thread_key: threadKey,
    alias,
    contact_id: contactId || null,
    updated_at: new Date().toISOString(),
  }));

  await supabase
    .from("whatsapp_thread_aliases")
    .upsert(rows, { onConflict: "org_id,alias" });
}

async function fetchZapiContactMetadata(identifiers: string[]) {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN");
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

  if (!instanceId || !instanceToken) return { name: null, phone: null };

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
      const phone = normalizePhoneValue(data?.phone || data?.number || data?.id || data?.jid);
      if (name || phone) return { name, phone };
    } catch (err) {
      console.warn("ZAPI CONTACT LOOKUP FAILED:", identifier, err);
    }
  }

  return { name: null, phone: null };
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

    await supabase.from("webhook_logs").insert({
      status: "incoming",
      headers: Object.fromEntries(req.headers.entries()),
      payload: {
        hasToken: Boolean(token),
        keys: Object.keys(body || {}),
        dataKeys: Object.keys(body?.data || {}),
        isGroup: body.isGroup ?? body.data?.isGroup ?? null,
        chatId: body.chatId ?? body.data?.chatId ?? null,
        chatLid: body.chatLid ?? body.data?.chatLid ?? null,
        senderLid: body.senderLid ?? body.data?.senderLid ?? null,
        phone: body.phone ?? body.data?.phone ?? null,
        from: body.from ?? body.data?.from ?? null,
        senderName: body.senderName ?? body.data?.senderName ?? null,
        chatName: body.chatName ?? body.data?.chatName ?? null,
        type: body.type ?? body.data?.type ?? null,
      },
    });

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("whatsapp_token", token)
      .maybeSingle();

    if (!org) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const chatId = normalizeChatId(body);
    if (!chatId) {
      await supabase.from("webhook_logs").insert({
        status: "skipped_no_chat_id",
        headers: Object.fromEntries(req.headers.entries()),
        payload: {
          keys: Object.keys(body || {}),
          isGroup: body.isGroup ?? body.data?.isGroup ?? null,
          chatId: body.chatId ?? body.data?.chatId ?? null,
          phone: body.phone ?? body.data?.phone ?? null,
          from: body.from ?? body.data?.from ?? null,
          chatName: body.chatName ?? body.data?.chatName ?? null,
        },
      });

      return new Response("No ID", { headers: corsHeaders });
    }

    const isGroup = detectGroup(body, chatId);
    const groupName = body.chatName || body.data?.chatName;
    const payloadName = firstMeaningfulName(
      body.senderName,
      body.data?.senderName,
      body.chatName || body.data?.chatName ||
      body.pushName || body.data?.pushName ||
      body.notify || body.data?.notify,
    );
    const zapiContact = isGroup ? { name: null, phone: null } : await fetchZapiContactMetadata([
      normalizeContactPhone(body) || "",
      chatId,
    ]);
    const contactPhone = isGroup ? chatId : (normalizeContactPhone(body) || zapiContact.phone);
    const contactIdentity = contactPhone || chatId;
    const senderName = payloadName || zapiContact.name;
    const finalDisplayName = isGroup
      ? (groupName || chatId)
      : (senderName || contactPhone || chatId);

    const { data: existingThread } = await supabase
      .from("deal_conversations")
        .select("deal_id, contact_id, contact:contacts(id, name, phone, is_blocked)")
      .eq("org_id", org.id)
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let contact = existingThread?.contact || null;

    if (!contact && contactPhone) {
      const { data: contactByPhone } = await supabase
        .from("contacts")
        .select("id, name, phone, is_blocked")
        .eq("phone", contactPhone)
        .eq("org_id", org.id)
        .maybeSingle();

      contact = contactByPhone;
    }

    if (!contact) {
      const { data: contactByIdentity } = await supabase
        .from("contacts")
        .select("id, name, phone, is_blocked")
        .eq("phone", contactIdentity)
        .eq("org_id", org.id)
        .maybeSingle();

      contact = contactByIdentity;
    }

    if (contact && finalDisplayName && (isGenericName(contact.name) || (isGroup && groupName && contact.name !== groupName))) {
      await supabase.from("contacts").update({ name: finalDisplayName }).eq("id", contact.id);
      contact = { ...contact, name: finalDisplayName };
    }

    if (contact && !isGroup && contactPhone && contact.phone !== contactPhone) {
      await supabase.from("contacts").update({ phone: contactPhone }).eq("id", contact.id);
      contact = { ...contact, phone: contactPhone };
    }

    if (contact?.is_blocked) {
      return new Response(JSON.stringify({ ok: true, skipped: "blocked_contact" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aliases = buildThreadAliases({ chatId, contactPhone, contactId: contact?.id, isGroup });
    const threadKey = await resolveThreadKey(supabase, org.id, aliases);
    await upsertThreadAliases(supabase, org.id, threadKey, aliases, contact?.id);
    const canonicalChatId = threadKey.startsWith("chat:") ? threadKey.slice(5) : chatId;

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
      chat_id: canonicalChatId,
      deal_id: existingThread?.deal_id || null,
      contact_id: contact?.id,
      sender_phone: contact?.phone || contactIdentity,
      content,
      sender_type: sentByMe ? "sales" : "client",
      source: "whatsapp",
      external_message_id: externalId,
      is_group: isGroup,
      sender_name: isGroup ? finalDisplayName : senderName,
      message_type: media.type,
      media_url: media.url,
      metadata: isGroup ? { participant_name: senderName } : {},
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
