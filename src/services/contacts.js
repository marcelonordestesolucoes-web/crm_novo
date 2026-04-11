// src/services/contacts.js
// Operações na tabela "contacts" do projeto anterior.
// Schema real: id, name, organization_id, created_at
// Note: O schema real anterior pode ser mais enxuto. Usaremos fallbacks para manter a interface rica.

import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';

export async function getContacts() {
  const { userId, orgId, isAdmin } = await getUserPermissions();

  let query = supabase
    .from('contacts')
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

  return data.map((contact) => ({
    id:          contact.id,
    name:        contact.name,
    avatar:      contact.avatar_url ?? null,
    role:        contact.role ?? 'Contato',
    company:     contact.company ?? '—',
    email:       contact.email ?? '—',
    phone:       contact.phone ?? '—',
    owner:       contact.owner?.full_name || '—',
    ownerAvatar: contact.owner?.avatar_url || null,
    ownerPosition: contact.owner?.position || 'Account Executive',
  }));
}

export async function createContact(contact) {
  const { data, error } = await supabase
    .from('contacts')
    .insert([contact])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateContact(id, updates) {
  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteContact(id) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
