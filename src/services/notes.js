import { supabase } from '../lib/supabase';

/**
 * Fetch all notes for a specific deal.
 */
export async function getNotesByDeal(dealId) {
  const { data, error } = await supabase
    .from('deal_notes')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Create a new note.
 */
export async function createNote(dealId, content) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('deal_notes')
    .insert([
      { 
        deal_id: dealId, 
        content,
        user_id: user?.id 
      }
    ])
    .select()
    .single();

  if (error) throw error;

  // Registrar na timeline
  try {
    await supabase.from('deal_timeline').insert([{
      deal_id: dealId,
      type: 'note',
      description: `${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`
    }]);
  } catch (tlError) {
    console.error('[Stitch] Erro ao registrar timeline da nota:', tlError);
  }

  return data;
}

/**
 * Update an existing note.
 */
export async function updateNote(id, content) {
  const { data, error } = await supabase
    .from('deal_notes')
    .update({ content })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a note.
 */
export async function deleteNote(id) {
  const { error } = await supabase
    .from('deal_notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}
