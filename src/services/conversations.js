// src/services/conversations.js
// Serviço para gerenciar a persistência de trechos de conversas vinculados a deals.

import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage, sendWhatsAppMedia } from './whatsappSender';

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
export async function getConversationsByContext({ dealId, phone, chatId }) {
  if (!dealId && !phone && !chatId) return [];

  // [ELITE NORMALIZATION] Garantir que o telefone esteja limpo para a busca
  const cleanPhone = phone ? String(phone).replace(/\D/g, '') : null;

  let query = supabase.from('deal_conversations').select('*');
  
  // Construção da query OR agressiva (suporta ID de negócio, telefone ou o novo chat_id)
  const orConditions = [];
  if (dealId) orConditions.push(`deal_id.eq.${dealId}`);
  if (cleanPhone) orConditions.push(`sender_phone.eq.${cleanPhone}`);
  if (phone) orConditions.push(`sender_phone.eq.${phone}`);
  if (chatId) orConditions.push(`chat_id.eq.${chatId}`);

  query = query.or(orConditions.join(','));

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
export async function createConversation(dealId, content, senderType = 'client', source = 'manual', phone = null, mediaUrl = null, messageType = 'text') {
  if (!dealId && !phone) {
    throw new Error('dealId ou phone é obrigatório para salvar uma conversa.');
  }

  // 0. BUSCAR ORG_ID (Se não fornecido)
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase.from('memberships').select('org_id').eq('user_id', user?.id).single();

  // --- [ ELITE OUTBOUND TRIGGER ] ---
  // Se for WhatsApp e o remetente for vendedor, DISPARA O ZAP REAL
  let externalId = null;
  let normalizedChatId = phone;

  if (source === 'whatsapp' && senderType === 'sales' && phone) {
     // A âncora agora é o ID completo que já vem do Inbox (v22: Sem sufixos manuais)
     try {
       console.log('[Stitch] Disparando envio real para:', normalizedChatId);
       let zapiResponse;
       
       if (mediaUrl) {
         zapiResponse = await sendWhatsAppMedia(normalizedChatId, mediaUrl, messageType, content);
       } else {
         zapiResponse = await sendWhatsAppMessage(normalizedChatId, content);
       }
       
       externalId = zapiResponse?.zaid || zapiResponse?.messageId;
     } catch (err) {
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
        sender_phone: phone, 
        org_id: membership?.org_id,
        chat_id: normalizedChatId,
        external_message_id: externalId,
        media_url: mediaUrl,
        message_type: messageType,
        metadata: {}
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar conversa:', error);
    throw error;
  }

  // 1. REGISTRAR NA TIMELINE SE FOR MENSAGEM DO VENDEDOR (v7.0)
  if (senderType === 'sales') {
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
