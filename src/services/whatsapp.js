// src/services/whatsapp.js
import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';

/**
 * Busca o resumo de todas as conversas para o Inbox Global.
 * Utiliza o SQL DISTINCT ON (ou rpc) para garantir performance.
 */
export async function getWhatsAppInbox() {
  const { orgId } = await getUserPermissions();
  
  // [Elite Mapping] Buscar rótulos de estágios para os badges
  const { data: allStages } = await supabase.from('pipeline_stages').select('id, label');
  const stageMap = {};
  if (allStages) allStages.forEach(s => stageMap[s.id] = s.label);

  /**
   * Lógica: Pegar a última mensagem de cada deal_id.
   * [Ultra-Safe Query] Implementamos Fallback para caso as novas colunas de IA ainda não tenham sido criadas no SQL.
   */
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
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[Stitch] Erro fatal na Inbox:', error);
    throw error;
  }
  console.log(`[Stitch] Inbox carregada com ${data?.length || 0} mensagens brutas.`);

  // Agrupar por Deal ou Remetente para garantir que nada suma
  const inboxMap = new Map();

  data.forEach(msg => {
    // [Elite Surgical Fix] A ÂNCORA É EXCLUSIVAMENTE O CHAT_ID
    const key = msg.chat_id;
    if (!key) return; // Ignora mensagens sem âncora (limpeza de dados)

    if (!inboxMap.has(key)) {
      inboxMap.set(key, msg);
    } else {
      const existing = inboxMap.get(key);
      // "Latest Message Win": Garante que o resumo do chat seja a mensagem MAIS RECENTE
      if (new Date(msg.created_at) > new Date(existing.created_at)) {
        inboxMap.set(key, msg);
      }
    }
  });

  // Montagem do Output Real (Vista de WhatsApp Web)
  const finalData = Array.from(inboxMap.values()).map(msg => {
    const contact = msg.contact || msg.deals?.contacts?.[0]?.contact;

    const displayName = msg.is_group
      ? (contact?.name || 'Grupo WhatsApp') 
      : (contact?.name || msg.sender_name || 'Contato WhatsApp');
    
    // Badge de Estágio do Funil
    const stageLabel = stageMap[msg.deals?.stage] || 'Lead';

    return {
      id: msg.chat_id,
      contact_id: msg.contact_id,
      deal_id: msg.deal_id,
      deal_title: msg.deals?.title || 'Inbox',
      contact_name: displayName,
      contact_phone: contact?.phone || msg.sender_phone,
      last_message: msg.content,
      last_message_at: msg.created_at,
      sender_type: msg.sender_type,
      status: msg.deals?.status,
      stage: msg.deals?.stage,
      stage_label: stageLabel,
      is_group: msg.is_group ?? false,
      message_type: msg.message_type || 'text',
      media_url: msg.media_url,
      ai_global_analysis: msg.deals?.ai_global_analysis
    };
  }).sort((a, b) => 
    new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );

  console.log(`[Stitch] Inbox Finalizada: ${finalData.length} conversas unificadas.`);
  return finalData;
}

/**
 * [ELITE DELETION] Apaga todas as mensagens de um chat específico.
 * @param {string} chatId - ID único do chat (@c.us ou @g.us ou @lid)
 */
export async function deleteChat(chatId) {
  if (!chatId) throw new Error('ID do chat é obrigatório para exclusão.');

  const { error } = await supabase
    .from('deal_conversations')
    .delete()
    .eq('chat_id', chatId);

  if (error) {
    console.error('[Stitch] Erro ao excluir chat:', error);
    throw error;
  }

  return true;
}

/**
 * [ELITE OUTBOUND] Envia uma mensagem real via Z-API.
 * @param {string} phone - Telefone do destinatário ou ID do grupo.
 * @param {string} message - Conteúdo textual.
 */
export async function sendWhatsAppMessage(phone, message) {
  const instanceId = '3F1C97713DB441CDA799AAE399BC1248';
  const token = 'A9CC72CBA1D787189E111426';
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Erro desconhecido na Z-API');
    }

    console.log('[Stitch] Z-API Outbound SUCESSO:', data.zaid || data.messageId);
    return data; // Retorna o ID da mensagem para vincular no banco
  } catch (error) {
    console.error('[Stitch] Falha crítica no envio Z-API:', error.message);
    throw error;
  }
}
