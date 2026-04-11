import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';

/**
 * Busca a meta da organização para um mês/ano específico.
 */
export async function getOrgGoal(month, year) {
  const { orgId } = await getUserPermissions();

  const { data, error } = await supabase
    .from('org_goals')
    .select('*')
    .eq('org_id', orgId)
    .eq('month',  month)
    .eq('year',   year)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // Ignora se não existir meta ainda
  return data;
}

/**
 * Cria ou atualiza a meta global da organização.
 */
export async function upsertOrgGoal(amount, month, year) {
  const { orgId } = await getUserPermissions();

  const { data, error } = await supabase
    .from('org_goals')
    .upsert([{ 
      org_id: orgId,
      amount: amount,
      month:  month,
      year:   year
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Busca todos os membros para exibição na distribuição automática de metas.
 */
export async function getTeamMembersWithGoal() {
  const { orgId } = await getUserPermissions();

  const { data, error } = await supabase
    .from('memberships')
    .select(`
      *,
      profiles ( full_name, avatar_url )
    `)
    .eq('org_id', orgId);

  if (error) throw error;
  return data;
}
