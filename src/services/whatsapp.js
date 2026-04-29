import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';
import { sendWhatsAppMessage as sendWhatsAppMessageViaFunction } from './whatsappSender';

function isGenericContactName(name) {
  return !name || ['Contato WhatsApp', 'Lead WhatsApp', 'Grupo WhatsApp'].includes(name);
}

function getNumericPhone(value) {
  const raw = String(value || '');
  if (!raw || raw.includes('@lid') || raw.includes('@g.us')) return null;

  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('55') && digits.length === 12) {
    return `${digits.slice(0, 4)}9${digits.slice(4)}`;
  }
  if (!digits.startsWith('55') && digits.length === 10) {
    return `55${digits.slice(0, 2)}9${digits.slice(2)}`;
  }
  if (!digits.startsWith('55') && digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function getPhoneVariants(value) {
  const raw = String(value || '');
  if (!raw || raw.includes('@lid') || raw.includes('@g.us')) return [];

  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return [];

  const canonical = getNumericPhone(digits);
  const variants = new Set([canonical, digits]);

  if (canonical?.startsWith('55') && canonical.length === 13 && canonical[4] === '9') {
    variants.add(`${canonical.slice(0, 4)}${canonical.slice(5)}`);
    variants.add(canonical.slice(2));
    variants.add(`${canonical.slice(2, 4)}${canonical.slice(5)}`);
  }

  if (canonical?.startsWith('55') && canonical.length === 12) {
    const withNine = `${canonical.slice(0, 4)}9${canonical.slice(4)}`;
    variants.add(withNine);
    variants.add(canonical.slice(2));
    variants.add(withNine.slice(2));
  }

  if (!digits.startsWith('55') && digits.length === 11 && digits[2] === '9') {
    variants.add(`55${digits}`);
    variants.add(`${digits.slice(0, 2)}${digits.slice(3)}`);
    variants.add(`55${digits.slice(0, 2)}${digits.slice(3)}`);
  }

  return [...variants].filter(Boolean);
}

function getThreadAliases(msg) {
  const aliases = [];
  const contact = msg.contact || msg.deals?.contacts?.[0]?.contact;
  const contactPhones = getPhoneVariants(contact?.phone);
  const senderPhones = getPhoneVariants(msg.sender_phone);
  const chatPhones = getPhoneVariants(msg.chat_id);

  if (msg.contact_id) aliases.push(`contact:${msg.contact_id}`);
  if (contact?.id) aliases.push(`contact:${contact.id}`);
  contactPhones.forEach((phone) => aliases.push(`phone:${phone}`));
  senderPhones.forEach((phone) => aliases.push(`phone:${phone}`));
  chatPhones.forEach((phone) => aliases.push(`phone:${phone}`));
  if (msg.chat_id) aliases.push(`chat:${msg.chat_id}`);

  return [...new Set(aliases)];
}

function getThreadDisplayName(msg) {
  const contact = msg.contact || msg.deals?.contacts?.[0]?.contact;
  if (contact?.name && !isGenericContactName(contact.name)) return contact.name;
  if (msg.is_group && msg.sender_name) return msg.sender_name;
  if (msg.sender_type !== 'sales' && msg.sender_name && !isGenericContactName(msg.sender_name)) return msg.sender_name;
  return null;
}

function getThreadPhone(msg) {
  const contact = msg.contact || msg.deals?.contacts?.[0]?.contact;
  return getNumericPhone(contact?.phone) || getNumericPhone(msg.sender_phone) || getNumericPhone(msg.chat_id);
}

function mergeAliasGroups(inboxMap, aliasMap, canonicalAliases) {
  canonicalAliases.forEach((row) => {
    const aliases = canonicalAliases
      .filter((item) => item.thread_key === row.thread_key)
      .map((item) => item.alias);

    const existingKeys = aliases
      .map((alias) => aliasMap.get(alias))
      .filter(Boolean);

    if (!existingKeys.length) return;

    const canonicalKey = existingKeys[0];
    existingKeys.slice(1).forEach((key) => {
      if (key === canonicalKey) return;

      const canonical = inboxMap.get(canonicalKey);
      const duplicate = inboxMap.get(key);
      if (!duplicate) return;

      const keepDuplicate = !canonical || new Date(duplicate.created_at) > new Date(canonical.created_at);
      inboxMap.set(canonicalKey, {
        ...(keepDuplicate ? duplicate : canonical),
        thread_aliases: [...new Set([
          ...(canonical?.thread_aliases || []),
          ...(duplicate.thread_aliases || []),
          ...aliases,
        ])],
        thread_display_name: canonical?.thread_display_name || duplicate.thread_display_name,
        thread_phone: canonical?.thread_phone || duplicate.thread_phone,
      });
      inboxMap.delete(key);
    });

    aliases.forEach((alias) => aliasMap.set(alias, canonicalKey));
  });
}

export async function getWhatsAppInbox() {
  const { orgId } = await getUserPermissions();
  if (!orgId) return [];

  const { data: allStages } = await supabase
    .from('pipeline_stages')
    .select('id, label');

  const stageMap = {};
  if (allStages) allStages.forEach((stage) => { stageMap[stage.id] = stage.label; });

  const coreQuery = `
    *,
    thread:whatsapp_threads(*),
    contact:contacts(*),
    deals (
      id, title, status, stage, is_qualified,
      ai_global_analysis, ai_closing_probability,
      contacts:deal_contacts(contact:contacts(*))
    )
  `;

  const { data, error } = await supabase
    .from('deal_conversations')
    .select(coreQuery)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  const inboxMap = new Map();

  (data || []).forEach((msg) => {
    const aliases = getThreadAliases(msg);
    if (!aliases.length) return;

    const contact = msg.contact || msg.deals?.contacts?.[0]?.contact;
    const key = msg.thread_id
      ? `thread:${msg.thread_id}`
      : msg.contact_id || contact?.id
        ? `contact:${msg.contact_id || contact?.id}`
        : `chat:${msg.chat_id}`;

    const existing = inboxMap.get(key);
    const threadDisplayName = getThreadDisplayName(msg) || existing?.thread_display_name || null;
    const threadPhone = getThreadPhone(msg) || existing?.thread_phone || null;

    if (!existing || new Date(msg.created_at) > new Date(existing.created_at)) {
      inboxMap.set(key, {
        ...msg,
        thread_aliases: [...new Set([...(existing?.thread_aliases || []), ...aliases])],
        thread_display_name: threadDisplayName,
        thread_phone: threadPhone,
      });
    } else {
      inboxMap.set(key, {
        ...existing,
        thread_aliases: [...new Set([...(existing.thread_aliases || []), ...aliases])],
        thread_display_name: threadDisplayName,
        thread_phone: threadPhone,
      });
    }
  });

  return Array.from(inboxMap.values()).map((msg) => {
    const contact = msg.contact || msg.deals?.contacts?.[0]?.contact;
    const threadKey = msg.thread_id
      ? `thread:${msg.thread_id}`
      : msg.contact_id || contact?.id
        ? `contact:${msg.contact_id || contact?.id}`
        : `chat:${msg.chat_id}`;
    const contactName = contact?.name;
    const isGenericContact = isGenericContactName(contactName);
    const fallbackIdentity = contact?.phone || msg.thread_phone || msg.sender_phone || msg.chat_id;
    const fallbackName = fallbackIdentity?.includes('@lid')
      ? `WhatsApp ${fallbackIdentity.split('@')[0].slice(-6)}`
      : fallbackIdentity || 'Contato WhatsApp';
    const displayName = msg.is_group
      ? (isGenericContact ? (msg.thread_display_name || msg.sender_name || contactName || fallbackName || 'Grupo WhatsApp') : contactName)
      : (isGenericContact ? (msg.thread_display_name || contactName || fallbackName) : contactName);

    return {
      id: msg.chat_id,
      thread_key: threadKey,
      thread_id: msg.thread_id,
      contact_id: msg.contact_id || contact?.id,
      thread_aliases: msg.thread_aliases || [],
      deal_id: msg.deal_id,
      deal_title: msg.deals?.title || 'Inbox',
      contact_name: displayName,
      contact_phone: contact?.phone || msg.thread_phone || msg.sender_phone,
      contact_is_auto: contact?.is_auto_created,
      is_qualified: msg.deals?.is_qualified,
      last_message: msg.content,
      last_message_at: msg.created_at,
      sender_type: msg.sender_type,
      status: msg.deals?.status,
      stage: msg.deals?.stage,
      stage_label: stageMap[msg.deals?.stage] || 'Lead',
      is_group: msg.is_group ?? false,
      message_type: msg.message_type || 'text',
      media_url: msg.media_url,
      ai_global_analysis: msg.deals?.ai_global_analysis
    };
  }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
}

export async function deleteChat(chatId) {
  if (!chatId) throw new Error('ID do chat e obrigatorio para exclusao.');

  const { orgId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuario sem organizacao.');

  const { error } = await supabase
    .from('deal_conversations')
    .delete()
    .eq('org_id', orgId)
    .eq('chat_id', chatId);

  if (error) throw error;
  return true;
}

export async function sendWhatsAppMessage(phone, message) {
  return sendWhatsAppMessageViaFunction(phone, message);
}
