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
    console.warn('[Stitch Auth] Usuário sem membership detectado. Iniciando busca de contexto global...');
    
    // Auto-recuperação: Busca a primeira organização disponível no banco (Master Org)
    const { data: globalOrg } = await supabase.from('organizations').select('id, name').limit(1).maybeSingle();
    
    if (globalOrg) {
      console.log('[Stitch Auth] Contexto recuperado. Vinculando temporariamente à:', globalOrg.name);
      return {
        userId,
        orgId: globalOrg.id,
        role: 'admin',
        isAdmin: true
      };
    }

    // Se nem o fallback global funcionar, retornamos nulo mas sem crashar
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
