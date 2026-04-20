// src/services/campaigns.js
import { supabase } from '@/lib/supabase';
import { sendWhatsAppMessage } from './whatsappSender';

/**
 * [ANTI-BAN] Processa Spintax: {Olá|Oi|Bom dia} -> Sorteia um
 */
export const parseSpintax = (text) => {
  return text.replace(/\{([^{}]+)\}/g, (match, options) => {
    const choices = options.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
};

/**
 * [ANTI-BAN] Injeta variáveis do contato
 */
export const injectVariables = (text, contact) => {
  let result = text;
  result = result.replace(/\[Nome\]/gi, contact.name || 'Cliente');
  result = result.replace(/\[Empresa\]/gi, contact.company || '');
  return result;
};

/**
 * Cria uma nova campanha e popula a fila de leads
 */
export const createCampaign = async (campaignData, contactIds) => {
  try {
    // 1. Criar cabeçalho da campanha
    const { data: campaign, error: cError } = await supabase
      .from('campaigns')
      .insert({
        name: campaignData.name,
        message_template: campaignData.message_template,
        min_delay: campaignData.min_delay || 30,
        max_delay: campaignData.max_delay || 90,
        status: 'draft'
      })
      .select()
      .single();

    if (cError) throw cError;

    // 2. Criar fila de leads
    const leads = contactIds.map(cid => ({
      campaign_id: campaign.id,
      contact_id: cid,
      status: 'pending'
    }));

    const { error: lError } = await supabase.from('campaign_leads').insert(leads);
    if (lError) throw lError;

    return campaign;
  } catch (error) {
    console.error("Erro ao criar campanha:", error);
    throw error;
  }
};

/**
 * Busca campanhas com contagem de progresso
 */
export const getCampaigns = async () => {
  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      leads:campaign_leads(status)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

/**
 * Execução da Campanha (Loop Controlado)
 * Este motor processa os disparos um a um respeitando os delays.
 */
export const processCampaignStep = async (campaignId, onProgress) => {
  try {
    // 1. Buscar Campanha
    const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
    if (!campaign || campaign.status !== 'sending') return;

    // 2. Buscar PRÓXIMO lead pendente
    const { data: lead } = await supabase
      .from('campaign_leads')
      .select('*, contact:contacts(*)')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (!lead) {
      // Finalizar campanha se não houver mais leads
      await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId);
      return { finished: true };
    }

    // 3. Atualizar lead para "sending"
    await supabase.from('campaign_leads').update({ status: 'sending' }).eq('id', lead.id);

    // 4. Processar Texto (Anti-Ban)
    let finalMessage = parseSpintax(campaign.message_template);
    finalMessage = injectVariables(finalMessage, lead.contact);

    // 5. Enviar Realmente
    try {
      await sendWhatsAppMessage(lead.contact.phone, finalMessage);
      await supabase.from('campaign_leads').update({ 
        status: 'sent', 
        sent_at: new Date().toISOString() 
      }).eq('id', lead.id);
    } catch (sendError) {
      await supabase.from('campaign_leads').update({ 
        status: 'failed', 
        last_error: sendError.message 
      }).eq('id', lead.id);
    }

    // 6. Calcular Delay Aleatório para o próximo
    const delay = Math.floor(Math.random() * (campaign.max_delay - campaign.min_delay + 1) + campaign.min_delay);
    
    return { finished: false, nextDelay: delay };

  } catch (error) {
    console.error("Erro no passo da campanha:", error);
    throw error;
  }
};
