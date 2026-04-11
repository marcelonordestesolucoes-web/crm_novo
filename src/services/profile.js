import { supabase } from '@/lib/supabase';

/**
 * Busca o perfil do usuário logado na tabela 'profiles'.
 */
export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[ProfileService] Erro ao buscar perfil:', error);
    return null;
  }

  return {
    ...data,
    email: user.email // Email vem do Auth
  };
}

/**
 * Atualiza os dados do perfil (nome, telefone, cargo).
 */
export async function updateProfile(data) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name:  data.full_name,
      phone:      data.phone,
      position:   data.position,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (error) throw error;
  
  // Opcional: Atualizar também no user_metadata para persistência rápida no Sidebar
  await supabase.auth.updateUser({
    data: { 
      full_name: data.full_name,
      role:      data.position 
    }
  });

  return true;
}

/**
 * Faz upload do avatar para o bucket 'avatars'.
 * Salva como 'userId/avatar_timestamp.ext'
 */
export async function uploadAvatar(file) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const fileExt = file.name.split('.').pop();
  const filePath = `${user.id}/avatar_${Date.now()}.${fileExt}`;

  // 1. Upload do Arquivo
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  // 2. Gerar URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // 3. Atualizar tabela profiles
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
      avatar_url: publicUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);

  if (updateError) throw updateError;

  // 4. Atualizar metadata do auth para o Sidebar
  await supabase.auth.updateUser({
    data: { avatar_url: publicUrl }
  });

  return publicUrl;
}
