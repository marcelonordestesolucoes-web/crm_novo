import { supabase } from '@/lib/supabase';

/**
 * Busca todos os membros da organização do usuário logado.
 * Faz um join manual (ou via select query) entre memberships e profiles.
 */
export async function getOrganizationMembers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 1. Busca org_id
  const { data: memberData } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1);
  
  const orgId = memberData?.[0]?.org_id;
  if (!orgId) return [];

  // 2. Busca todos os memberships daquela org e tenta trazer os profiles
  // Nota: A relação sugerida é que memberships.user_id = profiles.id
  const { data, error } = await supabase
    .from('memberships')
    .select(`
      user_id,
      role,
      profiles:user_id (
        full_name,
        avatar_url,
        position,
        phone
      )
    `)
    .eq('org_id', orgId);

  if (error) {
    console.error('[MembersService] Erro ao buscar membros:', error);
    throw error;
  }

  return data.map(m => ({
    userId:    m.user_id,
    role:      m.role,
    name:      m.profiles?.full_name || 'Usuário',
    avatar:    m.profiles?.avatar_url,
    position:  m.profiles?.position || 'Colaborador',
    phone:     m.profiles?.phone
  }));
}
