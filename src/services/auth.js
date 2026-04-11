import { supabase } from '@/lib/supabase';

/**
 * Utilitário para buscar as permissões e IDs do usuário logado.
 * Retorna { userId, orgId, role, isAdmin }
 */
export async function getUserPermissions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const userId = user.id;

  // Busca o membership para saber a organização e o cargo
  const { data: memberData, error } = await supabase
    .from('memberships')
    .select('org_id, role')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (error || !memberData) {
    console.error('Erro ao buscar permissões:', error);
    // Fallback seguro: se não achar membership, assume que não é admin e não tem org
    return {
      userId,
      orgId: null,
      role: 'member',
      isAdmin: false
    };
  }

  return {
    userId,
    orgId:   memberData.org_id,
    role:    memberData.role,
    isAdmin: memberData.role === 'admin'
  };
}
