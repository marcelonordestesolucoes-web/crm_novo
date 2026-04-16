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
 * Busca a meta individual do usuário logado para um mês/ano específico.
 */
export async function getMyMemberGoal(month, year) {
  const { userId, orgId } = await getUserPermissions();

  const { data, error } = await supabase
    .from('member_goals')
    .select('*')
    .eq('org_id',  orgId)
    .eq('user_id', userId)
    .eq('month',   month)
    .eq('year',    year)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Cria ou atualiza a meta individual de um membro (Apenas Admin).
 */
export async function upsertMemberGoal(memberUserId, amount, month, year) {
  const { orgId } = await getUserPermissions();

  const { data, error } = await supabase
    .from('member_goals')
    .upsert([{ 
      org_id:  orgId,
      user_id: memberUserId,
      amount:  amount,
      month:   month,
      year:    year
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Busca todos os membros e suas metas individuais do mês.
 */
export async function getTeamMembersWithGoal(month, year) {
  const { orgId } = await getUserPermissions();

  // 1. Puxar membros
  const { data: members, error: memErr } = await supabase
    .from('memberships')
    .select(`
      user_id,
      role,
      profiles ( full_name, avatar_url )
    `)
    .eq('org_id', orgId);

  if (memErr) throw memErr;

  // 2. Puxar metas individuais
  const { data: goals, error: goalErr } = await supabase
    .from('member_goals')
    .select('*')
    .eq('org_id', orgId)
    .eq('month',  month)
    .eq('year',   year);

  if (goalErr) {
    console.warn('Erro ao buscar metas individuais ou tabela vazia:', goalErr.message);
  }

  // 3. Mesclar dados
  return members.map(m => ({
    ...m,
    individualGoal: goals?.find(g => g.user_id === m.user_id)?.amount || 0
  }));
}
