import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';

/**
 * Busca todos os funis da organização.
 */
export async function getPipelines() {
  const { orgId } = await getUserPermissions();
  
  const { data, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Busca as etapas de um funil específico.
 */
export async function getPipelineStages(pipelineId) {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Cria ou atualiza um funil.
 */
export async function upsertPipeline(pipeline) {
  const { orgId } = await getUserPermissions();
  
  const { data, error } = await supabase
    .from('pipelines')
    .upsert([{ ...pipeline, org_id: orgId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Salva as etapas de um funil (substituição em massa para manter ordem).
 */
export async function savePipelineStages(pipelineId, stages) {
  // 1. Remove etapas atuais que não estão no novo conjunto (ou remove todas e reinsere)
  // Por simplicidade e segurança de IDs, vamos fazer upsert/delete baseado na necessidade.
  
  const { error: delError } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('pipeline_id', pipelineId);

  if (delError) throw delError;

  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert(stages.map((s, idx) => ({
      ...s,
      pipeline_id: pipelineId,
      sort_order: (idx + 1) * 10
    })))
    .select();

  if (error) throw error;
  return data;
}

export async function deletePipeline(id) {
  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
