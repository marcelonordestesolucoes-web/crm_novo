// src/services/deals.js
// Operações no banco de dados: Tabela "deals" do projeto anterior.
// Schema real: id, title, company_id, value, stage, status, owner_id, organization_id, created_at

import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';
import { attributeAISuccess } from './aiTracking';

async function getStageLabel(stageId) {
  if (!stageId) return 'Sem etapa';

  const { data } = await supabase
    .from('pipeline_stages')
    .select('label')
    .eq('id', stageId)
    .maybeSingle();

  return data?.label || stageId;
}

/**
 * Utilitário para converter a coluna "product" (Texto ou JSON) em array de objetos.
 * Agora com fallback inteligente: se vazio, usa o valor/título do negócio.
 */
const parseProducts = (rawProduct, fallbackValue = 0, fallbackTitle = 'Produto') => {
  let products = [];
  try {
    if (rawProduct) {
      if (typeof rawProduct === 'object') {
        products = Array.isArray(rawProduct) ? rawProduct : [rawProduct];
      } else {
        const json = JSON.parse(rawProduct);
        products = Array.isArray(json) ? json : [{ name: rawProduct, price: 0 }];
      }
    }
  } catch (e) {
    products = [{ name: String(rawProduct), price: 0 }];
  }

  // Se após o parse ainda estiver vazio mas houver um valor real no deal, cria item padrão
  if (products.length === 0 && fallbackValue > 0) {
    return [{ name: fallbackTitle || 'Produto Principal', price: fallbackValue }];
  }

  return products;
};

/**
 * Busca todos os negócios com filtragem por cargo e organização.
 */
export async function getDeals() {
  const { userId, orgId, isAdmin } = await getUserPermissions();

  // 1. Buscar Estágios Dinâmicos para Mapeamento
  const { data: allStages } = await supabase
    .from('pipeline_stages')
    .select('id, label');
  
  const stageMap = {};
  if (allStages) {
    allStages.forEach(s => stageMap[s.id] = s.label);
  }

  let query = supabase
    .from('deals')
    .select(`
      *,
      companies ( name, cnpj, segment ),
      responsible:profiles!responsible_id ( full_name, avatar_url ),
      contacts:deal_contacts(
        contact:contacts(*)
      )
    `)
    .eq('org_id', orgId);

  // Se não for admin, vê apenas os seus
  if (!isAdmin) {
    query = query.eq('responsible_id', userId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  // Normaliza para o formato esperado pelos componentes
  return data.map((deal) => {
    const products = parseProducts(deal.product, deal.value, deal.title);
    const productTags = products
      .map(product => product?.name?.trim())
      .filter(Boolean)
      .filter(name => name.toLowerCase() !== String(deal.title || '').trim().toLowerCase());
    
    // Mapeamento profundo para os contatos vinculados
    const contacts = deal.contacts ? deal.contacts.map(c => c.contact).filter(Boolean) : [];

    return {
      id:          deal.id,
      title:       deal.title,
      company:     deal.companies?.name || 'Sem Empresa',
      taxId:       deal.companies?.cnpj || '',
      segment:     deal.companies?.segment || '',
      value:       deal.value ?? 0,
      stage:       deal.stage ?? 'lead',
      stageLabel:  stageMap[deal.stage] || deal.stage, 
      status:      deal.status || 'open',
      tags:        productTags,
      ownerName:   deal.responsible?.full_name || 'Desconhecido',
      ownerAvatar: deal.responsible?.avatar_url || null,
      createdAt:   deal.created_at,
      updatedAt:   deal.updated_at,
      products:    products,
      contacts:    contacts, 
      qualification: typeof deal.qualification === 'string' ? JSON.parse(deal.qualification) : (deal.qualification || {}),
      ai_closing_probability: deal.ai_closing_probability || 0,
      ai_probability_delta: deal.ai_probability_delta || 0,
      ai_temperature: deal.ai_temperature || 'neutral',
      ai_objection_pattern: deal.ai_objection_pattern || null,
      ai_next_step_timing: deal.ai_next_step_timing || null,
      ai_last_analysis_at: deal.ai_last_analysis_at || null,
      ai_priority_score: deal.ai_priority_score || 0,
      is_qualified: deal.is_qualified ?? true, // Fallback true para dados antigos
      last_interaction_at: deal.last_interaction_at || deal.created_at,
      lastAIInsight: deal.last_ai_insight ? (typeof deal.last_ai_insight === 'string' ? JSON.parse(deal.last_ai_insight) : deal.last_ai_insight) : null,
      lastAIInsightAt: deal.last_ai_insight_at,
      lastAIMessageId: deal.last_ai_message_id
    };
  });
}

/**
 * Busca um único negócio pelo ID com toda a normalização Elite.
 */
export async function getDeal(id) {
  const { orgId } = await getUserPermissions();

  const { data: allStages } = await supabase
    .from('pipeline_stages')
    .select('id, label');
  
  const stageMap = {};
  if (allStages) {
    allStages.forEach(s => stageMap[s.id] = s.label);
  }

  const { data: deal, error } = await supabase
    .from('deals')
    .select(`
      *,
      companies ( name, cnpj, segment ),
      responsible:profiles!responsible_id ( full_name, avatar_url ),
      contacts:deal_contacts(
        contact:contacts(*)
      )
    `)
    .eq('org_id', orgId)
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!deal) return null;

  const products = parseProducts(deal.product, deal.value, deal.title);
  const contacts = deal.contacts ? deal.contacts.map(c => c.contact).filter(Boolean) : [];

  return {
    id:          deal.id,
    title:       deal.title,
    company:     deal.companies?.name || 'Sem Empresa',
    taxId:       deal.companies?.cnpj || '',
    segment:     deal.companies?.segment || '',
    value:       deal.value ?? 0,
    stage:       deal.stage ?? 'lead',
    stageLabel:  stageMap[deal.stage] || deal.stage, 
    status:      deal.status || 'open',
    tags:        products.length > 0 ? [products[0].name] : [],
    ownerName:   deal.responsible?.full_name || 'Desconhecido',
    ownerAvatar: deal.responsible?.avatar_url || null,
    createdAt:   deal.created_at,
    updatedAt:   deal.updated_at,
    products:    products,
    contacts:    contacts, 
    qualification: typeof deal.qualification === 'string' ? JSON.parse(deal.qualification) : (deal.qualification || {}),
    ai_closing_probability: deal.ai_closing_probability || 0,
    ai_probability_delta: deal.ai_probability_delta || 0,
    ai_temperature: deal.ai_temperature || 'neutral',
    ai_objection_pattern: deal.ai_objection_pattern || null,
    ai_next_step_timing: deal.ai_next_step_timing || null,
    ai_last_analysis_at: deal.ai_last_analysis_at || null,
    ai_priority_score: deal.ai_priority_score || 0,
    is_qualified: deal.is_qualified ?? true,
    last_interaction_at: deal.last_interaction_at || deal.created_at,
    lastAIInsight: deal.last_ai_insight ? (typeof deal.last_ai_insight === 'string' ? JSON.parse(deal.last_ai_insight) : deal.last_ai_insight) : null,
    lastAIInsightAt: deal.last_ai_insight_at,
    lastAIMessageId: deal.last_ai_message_id
  };
}

/**
 * Cria um novo negócio.
 */
export async function createDeal(payload) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  // Busca o org_id do usuário ativo para não violar RLS (Evitar erro 406 se retornar 0 ou múltiplos)
  const { data: memberData } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1);
  
  const orgId = memberData?.[0]?.org_id;
  if (!orgId) throw new Error('Usuário sem organização ativa.');

  // 1. Inserir Empresa
  let companyId = null;
  if (payload.company) {
    const { data: newCompany, error: compErr } = await supabase
      .from('companies')
      .insert([{ 
        name: payload.company,
        cnpj: payload.taxId || null,
        segment: payload.segment || null,
        user_id: userId,
        org_id: orgId
      }])
      .select()
      .single();
    
    if (compErr) throw new Error('Erro na Empresa: ' + compErr.message);
    companyId = newCompany.id;
  }

  // 2. Inserir Negócio
  const { data: newDeal, error: dealErr } = await supabase
    .from('deals')
    .insert([{
       title: payload.title,
       value: payload.value,
       stage: payload.stage,
       product: JSON.stringify(payload.products || []), 
       company_id: companyId,
       responsible_id: userId,
       org_id: orgId,
       is_qualified: payload.is_qualified ?? true // Manually created are qualified by default
    }])
    .select()
    .single();

  if (dealErr) throw new Error('Erro no Negócio: ' + dealErr.message);

  // 3. Inserir Contatos e Linkar
  if (payload.contacts?.length > 0) {
    const validContacts = payload.contacts.filter(c => c.name?.trim());
    if (validContacts.length > 0) {
      const { data: newContacts, error: contactErr } = await supabase
        .from('contacts')
        .insert(
          validContacts.map(c => ({
            name: c.name,
            role: c.role,
            phone: c.phone,
            email: c.email,
            company_id: companyId,
            user_id: userId,
            org_id: orgId
          }))
        )
        .select();
        
      if (contactErr) throw new Error('Erro nos Contatos: ' + contactErr.message);

      const links = newContacts.map(c => ({
        deal_id: newDeal.id,
        contact_id: c.id
      }));
      await supabase.from('deal_contacts').insert(links);
    }
  }

  // 4. Timeline Log
  await supabase.from('deal_timeline').insert([{
     deal_id: newDeal.id,
     type: 'created',
     description: `Oportunidade "${newDeal.title}" criada`
  }]);

  return newDeal;
}

/**
 * Atualiza um negócio existente com sincronização global de empresas e contatos.
 */
export async function updateDeal(id, payload) {
  const { orgId } = await getUserPermissions();

  // 1. Atualizar Tabela de Negócios (Dados Básicos)
  const cleanPayload = {};
  if (payload.title !== undefined) cleanPayload.title = payload.title;
  if (payload.value !== undefined) cleanPayload.value = payload.value;
  if (payload.stage !== undefined) cleanPayload.stage = payload.stage;
  if (payload.status !== undefined) cleanPayload.status = payload.status;
  if (payload.products !== undefined) cleanPayload.product = JSON.stringify(payload.products || []);
  if (payload.qualification !== undefined) cleanPayload.qualification = payload.qualification || {};
  if (payload.is_qualified !== undefined) cleanPayload.is_qualified = payload.is_qualified;

  if (Object.keys(cleanPayload).length === 0) {
    const { data: existingDeal, error: existingError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (existingError) throw existingError;
    return existingDeal;
  }

  const { data: updatedDeal, error: dealError } = await supabase
    .from('deals')
    .update(cleanPayload)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (dealError) throw dealError;

  // [PHASE 5 ELITE] - Atribuição de Upsell
  if (payload.value > 0 && payload.value !== undefined) {
      const { checkAndTrackAIUpsell } = await import('./aiTracking');
      // Buscamos o valor anterior do deal retornado no snapshot inicial ou simulado
      // Para precisão, o checkAndTrackAIUpsell lidará com a comparação se o valor subiu.
      await checkAndTrackAIUpsell(id, payload.previous_value || 0, payload.value);
  }

  // [PHASE 5 ELITE] - Atribuição de Sucesso do Playbook
  if (payload.status === 'won' || payload.stage) {
      await attributeAISuccess(id);
  }

  // 2. Atualizar Dados da Empresa (CNPJ e Segmento)
  if (updatedDeal.company_id && (payload.taxId || payload.segment)) {
    await supabase.from('companies').update({
      cnpj: payload.taxId,
      segment: payload.segment,
      name: payload.company || undefined // Só atualiza se o nome não for vazio
    }).eq('id', updatedDeal.company_id).eq('org_id', orgId);
  }

  // 3. Sincronização Global de Contatos
  if (payload.contacts && Array.isArray(payload.contacts)) {
    const finalContactIds = [];

    for (const contact of payload.contacts) {
      if (!contact.name || !contact.name.trim()) continue;

      let contactId = contact.id;

      if (contactId) {
        // Atualiza cadastro global do contato (como solicitado: alterações refletem em tudo)
        await supabase.from('contacts').update({
          name: contact.name,
          role: contact.role,
          phone: contact.phone,
          email: contact.email
        }).eq('id', contactId).eq('org_id', orgId);
      } else {
        // Novo contato: cria globalmente já vinculado à organização e empresa
        const { data: newContact, error: cErr } = await supabase.from('contacts').insert({
          name: contact.name,
          role: contact.role,
          phone: contact.phone,
          email: contact.email,
          org_id: orgId,
          company_id: updatedDeal.company_id
        }).select().single();
        
        if (!cErr && newContact) contactId = newContact.id;
      }

      if (contactId) finalContactIds.push(contactId);
    }

    const { data: existingLinks } = await supabase
      .from('deal_contacts')
      .select('contact_id')
      .eq('deal_id', id);

    const existingContactIds = new Set((existingLinks || []).map(link => link.contact_id));
    const nextContactIds = new Set(finalContactIds);
    const linksToDelete = [...existingContactIds].filter(contactId => !nextContactIds.has(contactId));
    const linksToInsert = [...nextContactIds].filter(contactId => !existingContactIds.has(contactId));

    if (linksToDelete.length > 0) {
      await supabase
        .from('deal_contacts')
        .delete()
        .eq('deal_id', id)
        .in('contact_id', linksToDelete);
    }

    if (linksToInsert.length > 0) {
      const links = linksToInsert.map(cid => ({
        deal_id: id,
        contact_id: cid
      }));
      await supabase.from('deal_contacts').insert(links);
    }
  }

  // 5. Timeline Log de Edição
  const shouldLogUpdate = Boolean(
    payload.logTimeline ||
    payload.title !== undefined ||
    payload.value !== undefined ||
    payload.status !== undefined ||
    payload.products !== undefined ||
    payload.contacts !== undefined ||
    payload.taxId !== undefined ||
    payload.segment !== undefined
  );

  if (shouldLogUpdate) {
    const changes = [];
    if (payload.title !== undefined) changes.push('nome');
    if (payload.value !== undefined) changes.push('valor');
    if (payload.status !== undefined) changes.push('status');
    if (payload.products !== undefined) changes.push('produtos');
    if (payload.contacts !== undefined) changes.push('contatos');
    if (payload.taxId !== undefined || payload.segment !== undefined) changes.push('empresa');

    await supabase.from('deal_timeline').insert([{
       deal_id: id,
       type: 'updated',
       description: changes.length
        ? `Dados atualizados: ${[...new Set(changes)].join(', ')}`
        : `Oportunidade "${updatedDeal.title}" atualizada`
    }]);
  }

  return updatedDeal;
}

/**
 * Transfere um negócio para outro funil e estágio, com justificativa.
 */
export async function transferDealToPipeline(dealId, pipelineId, stageId, justification) {
  const { orgId } = await getUserPermissions();
  // 1. Atualizar o estágio do negócio (e pipeline_id se existir a coluna)
  const { data: updatedDeal, error: updateError } = await supabase
    .from('deals')
    .update({ 
      stage: stageId,
      // pipeline_id: pipelineId // Comentado por segurança até confirmar coluna
    })
    .eq('id', dealId)
    .eq('org_id', orgId)
    .select()
    .single();

  if (updateError) throw updateError;

  // 2. Registrar na deal_timeline
  await supabase.from('deal_timeline').insert([{
    deal_id:     dealId,
    type:        'stage_change',
    description: `Transferido para o funil ${pipelineId} no estágio ${stageId}`,
  }]);

  // 3. Criar a nota de justificativa
  if (justification) {
    const { createNote } = await import('./notes');
    await createNote(dealId, `[TRANSFERÊNCIA] ${justification}`);
  }

  return updatedDeal;
}

/**
 * Move um negócio para outro estágio e registra na timeline.
 */
export async function moveDealStage(id, newStage) {
  const { orgId } = await getUserPermissions();
  const { data, error } = await supabase
    .from('deals')
    .update({ stage: newStage })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw error;

  // [PHASE 5 ELITE] - Atribuição de Sucesso ao avançar estágio
  await attributeAISuccess(id);

  // Registrar na deal_timeline automaticamente
  const stageLabel = await getStageLabel(newStage);
  await supabase.from('deal_timeline').insert([{
    deal_id:     id,
    type:        'stage_change',
    description: `Movido para o estágio: ${stageLabel}`,
  }]);

  return data;
}

/**
 * Exclui um negócio.
 */
export async function deleteDeal(id) {
  const { orgId } = await getUserPermissions();
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) throw error;
}

/**
 * Busca a timeline de um negócio específico.
 */
export async function getDealTimeline(dealId) {
  const { data, error } = await supabase
    .from('deal_timeline')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
