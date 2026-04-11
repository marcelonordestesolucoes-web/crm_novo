import { supabase } from '@/lib/supabase';

/**
 * Lista todos os convites pendentes da organização do usuário.
 */
export async function getInvitations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Busca org_id do usuário logado
  const { data: memberData } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1);
  
  const orgId = memberData?.[0]?.org_id;
  if (!orgId) return [];

  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Cria um novo convite.
 */
export async function createInvitation(email, role) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não logado');

  const { data: memberData } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1);
  
  const orgId = memberData?.[0]?.org_id;

  const { data, error } = await supabase
    .from('invitations')
    .insert([{
      org_id:     orgId,
      email:      email,
      role:       role,
      created_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dias
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove um convite pendente.
 */
export async function deleteInvitation(id) {
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}
