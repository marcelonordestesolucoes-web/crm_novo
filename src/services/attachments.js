import { supabase } from '../lib/supabase';

/**
 * Fetch all attachments for a specific deal.
 */
export async function getAttachmentsByDeal(dealId) {
  const { data, error } = await supabase
    .from('deal_attachments')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Upload a file and create a record.
 */
export async function uploadAttachment(dealId, file) {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Generate a unique path: dealId/timestamp-filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `${dealId}/${fileName}`;

  // 1. Upload to Storage
  const { error: uploadError } = await supabase.storage
    .from('deal-attachments')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  // 2. Get Public URL
  const { data: { publicUrl } } = supabase.storage
    .from('deal-attachments')
    .getPublicUrl(filePath);

  // 3. Create DB Record
  const { data, error: dbError } = await supabase
    .from('deal_attachments')
    .insert([
      {
        deal_id: dealId,
        name: file.name,
        url: publicUrl,
        file_type: file.type,
        size: file.size,
        user_id: user?.id,
        // We might want to store the storage path for deletion
        storage_path: filePath
      }
    ])
    .select()
    .single();

  if (dbError) {
    // Cleanup storage if DB insert fails
    await supabase.storage.from('deal-attachments').remove([filePath]);
    throw dbError;
  }

  // Registrar na timeline
  await supabase.from('deal_timeline').insert([{
    deal_id: dealId,
    type: 'attachment',
    description: file.name
  }]);

  return data;
}

/**
 * Delete an attachment.
 */
export async function deleteAttachment(id, storagePath) {
  // 1. Delete from DB
  const { error: dbError } = await supabase
    .from('deal_attachments')
    .delete()
    .eq('id', id);

  if (dbError) throw dbError;

  // 2. Delete from Storage
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from('deal-attachments')
      .remove([storagePath]);
    
    if (storageError) {
      console.warn('[Stitch] Notificação: Arquivo deletado do BD mas erro ao remover do Storage:', storageError.message);
    }
  }

  return true;
}
