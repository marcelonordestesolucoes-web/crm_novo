import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';
import { sendWhatsAppMessage as sendWhatsAppMessageViaFunction } from './whatsappSender';

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
    const key = msg.chat_id;
    if (!key) return;

    const existing = inboxMap.get(key);
    if (!existing || new Date(msg.created_at) > new Date(existing.created_at)) {
      inboxMap.set(key, msg);
    }
  });

  return Array.from(inboxMap.values()).map((msg) => {
    const contact = msg.contact || msg.deals?.contacts?.[0]?.contact;
    const contactName = contact?.name;
    const isGenericContact = !contactName || ['Contato WhatsApp', 'Lead WhatsApp', 'Grupo WhatsApp'].includes(contactName);
    const fallbackIdentity = contact?.phone || msg.sender_phone || msg.chat_id;
    const fallbackName = fallbackIdentity?.includes('@lid')
      ? `WhatsApp ${fallbackIdentity.split('@')[0].slice(-6)}`
      : fallbackIdentity || 'Contato WhatsApp';
    const displayName = msg.is_group
      ? (isGenericContact ? (msg.sender_name || contactName || fallbackName || 'Grupo WhatsApp') : contactName)
      : (isGenericContact ? (msg.sender_name || contactName || fallbackName) : contactName);

    return {
      id: msg.chat_id,
      contact_id: msg.contact_id,
      deal_id: msg.deal_id,
      deal_title: msg.deals?.title || 'Inbox',
      contact_name: displayName,
      contact_phone: contact?.phone || msg.sender_phone,
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
