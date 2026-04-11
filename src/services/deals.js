// src/services/deals.js
// Operações no banco de dados: Tabela "deals" do projeto anterior.
// Schema real: id, title, company_id, value, stage, status, owner_id, organization_id, created_at

import { supabase } from '@/lib/supabase';
import { PIPELINE_STAGES } from '@/constants/config';
import { getUserPermissions } from './auth';

/**
 * Utilitário para converter a coluna "product" (Texto ou JSON) em array de objetos.
 */
const parseProducts = (rawProduct) => {
  if (!rawProduct) return [];
  try {
    const parsed = rawProduct;
    // Se já for objeto ou array (o Supabase às vezes já devolve parseado se for coluna JSON)
    if (typeof parsed === 'object') return Array.isArray(parsed) ? parsed : [parsed];
    
    const json = JSON.parse(rawProduct);
    return Array.isArray(json) ? json : [{ name: rawProduct, price: 0 }];
  } catch (e) {
    return [{ name: rawProduct, price: 0 }];
  }
};

/**
 * Busca todos os negócios com filtragem por cargo e organização.
 */
export async function getDeals() {
  const { userId, orgId, isAdmin } = await getUserPermissions();

  let query = supabase
    .from('deals')
    .select(`
      *,
      companies ( name ),
      responsible:profiles!responsible_id ( full_name, avatar_url )
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
    const products = parseProducts(deal.product);
    
    return {
      id:          deal.id,
      title:       deal.title,
      company:     deal.companies?.name || 'Sem Empresa',
      value:       deal.value ?? 0,
      stage:       deal.stage ?? 'lead',
      status:      'new',
      tags:        products.length > 0 ? [products[0].name] : [],
      ownerName:   deal.responsible?.full_name || 'Desconhecido',
      ownerAvatar: deal.responsible?.avatar_url || null,
      createdAt:   deal.created_at,
      products:    products,
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
 * Atualiza um negócio existente.
 */
export async function updateDeal(id, payload) {
  // Ignora campos não previstos no update principal para evitar 400 Bad Request
  const cleanPayload = {
    title: payload.title,
    value: payload.value,
    stage: payload.stage,
    product: payload.products ? JSON.stringify(payload.products) : null,
    qualification: payload.qualification ? JSON.stringify(payload.qualification) : null
  };

  const { data, error } = await supabase
    .from('deals')
    .update(cleanPayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error('Erro ao atualizar: ' + error.message);
  return data;
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
