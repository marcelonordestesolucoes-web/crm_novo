// src/services/deals.js
// Operações no banco de dados: Tabela "deals" do projeto anterior.
// Schema real: id, title, company_id, value, stage, status, owner_id, organization_id, created_at

import { supabase } from '@/lib/supabase';
import { PIPELINE_STAGES } from '@/constants/config';
import { getUserPermissions } from './auth';

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
      tags:        products.length > 0 ? [products[0].name] : [],
      ownerName:   deal.responsible?.full_name || 'Desconhecido',
      ownerAvatar: deal.responsible?.avatar_url || null,
      createdAt:   deal.created_at,
      updatedAt:   deal.updated_at,
      products:    products,
      contacts:    contacts, 
      qualification: deal.qualification ? (typeof deal.qualification === 'string' ? JSON.parse(deal.qualification) : deal.qualification) : {}
    };
  });
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
       org_id: orgId
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
  const cleanPayload = {
    title: payload.title,
    value: payload.value,
    stage: payload.stage,
    status: payload.status,
    product: payload.products ? JSON.stringify(payload.products) : null,
    qualification: payload.qualification ? (typeof payload.qualification === 'string' ? payload.qualification : JSON.stringify(payload.qualification)) : null
  };

  const { data: updatedDeal, error: dealError } = await supabase
    .from('deals')
    .update(cleanPayload)
    .eq('id', id)
    .select()
    .single();

  if (dealError) throw dealError;

  // 2. Atualizar Dados da Empresa (CNPJ e Segmento)
  if (updatedDeal.company_id && (payload.taxId || payload.segment)) {
    await supabase.from('companies').update({
      cnpj: payload.taxId,
      segment: payload.segment,
      name: payload.company || undefined // Só atualiza se o nome não for vazio
    }).eq('id', updatedDeal.company_id);
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
        }).eq('id', contactId);
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

    // 4. Sincronizar Vínculos (deal_contacts)
    // Remove todos os vínculos atuais para reconstruir a lista atualizada
    await supabase.from('deal_contacts').delete().eq('deal_id', id);
    
    // Insere os novos vínculos baseados na lista final de IDs (existentes + novos)
    if (finalContactIds.length > 0) {
      const links = finalContactIds.map(cid => ({
        deal_id: id,
        contact_id: cid
      }));
      await supabase.from('deal_contacts').insert(links);
    }
  }

  // 5. Timeline Log de Edição
  await supabase.from('deal_timeline').insert([{
     deal_id: id,
     type: 'updated',
     description: `Oportunidade "${updatedDeal.title}" atualizada globalmente`
  }]);

  return updatedDeal;
}

/**
 * Transfere um negócio para outro funil e estágio, com justificativa.
 */
export async function transferDealToPipeline(dealId, pipelineId, stageId, justification) {
  // 1. Atualizar o estágio do negócio (e pipeline_id se existir a coluna)
  const { data: updatedDeal, error: updateError } = await supabase
    .from('deals')
    .update({ 
      stage: stageId,
      // pipeline_id: pipelineId // Comentado por segurança até confirmar coluna
    })
    .eq('id', dealId)
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
  const { data, error } = await supabase
    .from('deals')
    .update({ stage: newStage })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Registrar na deal_timeline automaticamente
  const stageLabel = PIPELINE_STAGES.find(s => s.id === newStage)?.label || newStage;
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
  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id);

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
