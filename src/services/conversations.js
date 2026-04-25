// src/services/conversations.js
// Serviço para gerenciar a persistência de trechos de conversas vinculados a deals.

import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage, sendWhatsAppMedia } from './whatsappSender';
import { getUserPermissions } from './auth';

/**
 * Busca todas as conversas vinculadas a um negócio específico.
 * @param {string} dealId - ID do negócio.
 * @returns {Promise<Array>} - Lista de conversas ordenada pela mais recente.
 */
/**
 * Busca todas as conversas vinculadas a um negócio OU a um telefone (Leads).
 * @param {Object} context - { dealId, phone }
 * @returns {Promise<Array>} - Lista de conversas ordenada pela mais recente.
 */
export async function getConversationsByContext({ dealId, phone, chatId, contactId, aliases = [] }) {
  if (!dealId && !phone && !chatId && !contactId && !aliases.length) return [];
  const { orgId } = await getUserPermissions();
  if (!orgId) return [];

  // [ELITE NORMALIZATION] Garantir que o telefone esteja limpo para a busca
  const cleanPhone = phone && !String(phone).includes('@lid') && !String(phone).includes('@g.us')
    ? String(phone).replace(/\D/g, '')
    : null;

  let query = supabase.from('deal_conversations').select('*').eq('org_id', orgId);
  
  // Construção da query OR agressiva (suporta ID de negócio, telefone ou o novo chat_id)
  const orConditions = [];
  if (dealId) orConditions.push(`deal_id.eq.${dealId}`);
  if (contactId) orConditions.push(`contact_id.eq.${contactId}`);
  if (cleanPhone) orConditions.push(`sender_phone.eq.${cleanPhone}`);
  if (phone) orConditions.push(`sender_phone.eq.${phone}`);
  if (chatId) orConditions.push(`chat_id.eq.${chatId}`);

  aliases.forEach((alias) => {
    const [type, ...valueParts] = String(alias).split(':');
    const value = valueParts.join(':');
    if (!value) return;

    if (type === 'contact') orConditions.push(`contact_id.eq.${value}`);
    if (type === 'phone') orConditions.push(`sender_phone.eq.${value}`);
    if (type === 'chat') orConditions.push(`chat_id.eq.${value}`);
  });

  query = query.or([...new Set(orConditions)].join(','));

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar conversas:', error);
    throw error;
  }

  return data;
}

export async function getConversationsByDeal(dealId) {
  return getConversationsByContext({ dealId });
}

/**
 * Salva um novo trecho de conversa ou transcrição no banco. Para WhatsApp, também dispara o envio real.
 * @param {string} dealId - ID do negócio (opcional para leads).
 * @param {string} content - Conteúdo textual.
 * @param {string} senderType - 'client' | 'sales' | 'system'.
 * @param {string} source - 'manual' | 'whatsapp'.
 * @param {string} phone - JID ou Telefone.
 * @param {string} mediaUrl - (Opcional) URL pública do arquivo.
 * @param {string} messageType - (Opcional) 'text' | 'image' | 'audio'.
 */
export async function createConversation(
  dealId,
  content,
  senderType = 'client',
  source = 'manual',
  phone = null,
  mediaUrl = null,
  messageType = 'text',
  options = {}
) {
  if (!dealId && !phone) {
    throw new Error('dealId ou phone é obrigatório para salvar uma conversa.');
  }

  // 0. BUSCAR ORG_ID (Se não fornecido)
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase.from('memberships').select('org_id').eq('user_id', user?.id).single();
  if (!membership?.org_id) throw new Error('Usuário sem organização ativa.');

  // --- [ ELITE OUTBOUND TRIGGER ] ---
  // Se for WhatsApp e o remetente for vendedor, DISPARA O ZAP REAL
  let externalId = null;
  const normalizedChatId = options.chatId || phone;
  const recipientPhone = options.recipientPhone || phone;
  const senderPhone = options.senderPhone || recipientPhone || phone;
  const replyToMessageId = options.replyToMessageId || options.quotedMessageId || null;
  const replyToContent = options.replyToContent || null;
  const replyToSender = options.replyToSender || null;

  if (source === 'whatsapp' && senderType === 'sales' && recipientPhone) {
     // A âncora agora é o ID completo que já vem do Inbox (v22: Sem sufixos manuais)
     try {
       console.log('[Stitch] Disparando envio real para:', recipientPhone, '| chat_id:', normalizedChatId);
       let zapiResponse;
       
       if (mediaUrl) {
         zapiResponse = await sendWhatsAppMedia(recipientPhone, mediaUrl, messageType, content);
       } else {
         zapiResponse = await sendWhatsAppMessage(recipientPhone, content, replyToMessageId);
       }
       
       console.log('[Stitch] Resposta Z-API:', zapiResponse);
       externalId = zapiResponse?.zaapId || zapiResponse?.zaid || zapiResponse?.messageId || zapiResponse?.id;
     } catch (err) {
       if (err?.message) throw new Error(err.message);
       console.error('[Stitch] Falha no disparo real. Cancelando persistência:', err);
       throw new Error('Falha ao enviar mensagem pelo WhatsApp. Verifique sua conexão/instância.');
     }
  }

  const { data, error } = await supabase
    .from('deal_conversations')
    .insert([
      {
        deal_id: dealId,
        content: content,
        sender_type: senderType,
        source: source,
        sender_phone: senderPhone,
        org_id: membership?.org_id,
        chat_id: normalizedChatId,
        external_message_id: externalId,
        media_url: mediaUrl,
        message_type: messageType,
        metadata: {
          outbound_recipient: recipientPhone,
          outbound_chat_id: normalizedChatId,
          outbound_sender_phone: senderPhone,
          reply_to_message_id: replyToMessageId,
          reply_to_content: replyToContent,
          reply_to_sender: replyToSender
        }
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar conversa:', error);
    throw error;
  }

  // 1. REGISTRAR NA TIMELINE SE FOR MENSAGEM DO VENDEDOR (v7.0)
  if (senderType === 'sales' && dealId) {
    await supabase.from('deal_timeline').insert([{
      deal_id: dealId,
      type: 'whatsapp_interaction',
      description: `Vendedor: ${content.length > 50 ? content.substring(0, 50) + '...' : content}`
    }]);
  }

  return data;
}

/**
 * Remove um trecho de conversa.
 * @param {string} id - ID da conversa.
 */
export async function deleteConversation(id) {
  const { error } = await supabase
    .from('deal_conversations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
