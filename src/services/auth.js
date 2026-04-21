import { supabase } from '@/lib/supabase';

export async function getUserPermissions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuario nao autenticado');
  }

  const { data: memberData, error } = await supabase
    .from('memberships')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (error || !memberData?.org_id) {
    console.warn('[Stitch Auth] Usuario sem membership ativo. Bloqueando fallback global inseguro.');
    return {
      userId: user.id,
      orgId: null,
      role: 'member',
      isAdmin: false
    };
  }

  return {
    userId: user.id,
    orgId: memberData.org_id,
    role: memberData.role,
    isAdmin: memberData.role === 'admin'
  };
}
