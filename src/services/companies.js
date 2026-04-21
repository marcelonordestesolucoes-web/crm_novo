// src/services/companies.js
// Operações na tabela "companies" do projeto anterior.
// Schema real: id, name, stage, sector, organization_id, created_at

import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';

export async function getCompanies() {
  const { userId, orgId, isAdmin } = await getUserPermissions();

  let query = supabase
    .from('companies')
    .select(`
      *,
      owner:profiles!user_id ( full_name, avatar_url, position )
    `)
    .eq('org_id', orgId);

  if (!isAdmin) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.order('name', { ascending: true });

  if (error) throw error;

  return data.map((company) => ({
    id:                company.id,
    name:              company.name,
    stage:             company.stage ?? 'Cliente Ativo',
    sector:            company.sector ?? '—',
    taxId:             company.tax_id ?? company.cnpj ?? '—',
    score:             company.score ?? 0,
    logo:              company.logo ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(company.name)}&background=EEF2FF&color=003ec7&size=128`,
    responsible:       company.owner?.full_name || '—',
    responsibleAvatar: company.owner?.avatar_url || null,
    responsiblePosition: company.owner?.position || 'Conta Estratégica',
  }));
}

export async function createCompany(company) {
  const { userId, orgId } = await getUserPermissions();
  if (!orgId) throw new Error('Usuário sem organização ativa.');

  const { data, error } = await supabase
    .from('companies')
    .insert([{ ...company, user_id: company.user_id || userId, org_id: company.org_id || orgId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCompany(id, updates) {
  const { orgId } = await getUserPermissions();
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCompany(id) {
  const { orgId } = await getUserPermissions();
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) throw error;
}
