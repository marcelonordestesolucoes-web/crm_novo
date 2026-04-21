// src/services/tasks.js
// Operações na tabela "tasks" do projeto anterior.
// Schema real: id, title, status, priority, due_date, organization_id, created_at

import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';

export async function getTasks() {
  const { userId, orgId, isAdmin } = await getUserPermissions();

  let query = supabase
    .from('tasks')
    .select(`
      *,
      deals ( title ),
      owner:profiles!user_id ( full_name, avatar_url )
    `)
    .eq('org_id', orgId);

  if (!isAdmin) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((task) => ({
    id:                task.id,
    title:             task.title,
    status:            task.status ?? 'pending', // 'pending' ou 'completed'
    priority:          task.priority ?? 'medium',
    type:              task.type ?? 'task',
    dueDate:           task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'Sem data',
    dueTime:           task.due_time || '',
    dealId:            task.deal_id || null,
    dealTitle:         task.deals?.title || null,
    ownerName:         task.owner?.full_name || 'Usuário',
    ownerAvatar:       task.owner?.avatar_url || null,
  }));
}

/**
 * Busca tarefas vinculadas a um negócio específico.
 */
export async function getTasksByDeal(dealId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('deal_id', dealId)
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data;
}

export async function createTask(payload) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const { data: memberData } = await supabase
    .from('memberships')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1);
  const orgId = memberData?.[0]?.org_id;
  if (!orgId) throw new Error('Usuário sem organização ativa.');

  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      title:       payload.title,
      status:      'pending',
      priority:    payload.priority || 'medium',
      type:        payload.type || 'task',
      due_date:    payload.dueDate || null,
      due_time:    payload.dueTime || null,
      deal_id:     payload.dealId || null,
      user_id:     userId,
      org_id:      orgId
    }])
    .select()
    .single();

  if (error) throw error;

  // Registrar na deal_timeline se houver vínculo com negócio
  if (payload.dealId) {
    await insertTimelineEvent(payload.dealId, 'task_created', `${payload.title}`);
  }

  return data;
}

export async function updateTask(id, payload) {
  const { orgId } = await getUserPermissions();
  const { data, error } = await supabase
    .from('tasks')
    .update({
      title:    payload.title,
      priority: payload.priority,
      type:     payload.type,
      due_date: payload.dueDate,
      due_time: payload.dueTime,
      deal_id:  payload.dealId
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw error;
  
  if (payload.dealId) {
    await insertTimelineEvent(payload.dealId, 'task_updated', `${payload.title}`);
  }

  return data;
}

export async function toggleTaskStatus(id, currentStatus) {
  const { orgId } = await getUserPermissions();
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  const { data, error } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw error;

  // Registrar na deal_timeline se houver vínculo com negócio
  if (data.deal_id) {
    const action = newStatus === 'completed' ? 'concluída' : 'reaberta';
    await insertTimelineEvent(data.deal_id, 'task_status', `${data.title} (${action})`);
  }

  return data;
}

/**
 * Função auxiliar para inserir eventos na timeline sem circular dependência
 */
async function insertTimelineEvent(dealId, type, description) {
  try {
    await supabase.from('deal_timeline').insert([{
      deal_id: dealId,
      type:    type,
      description: description
    }]);
  } catch (e) {
    console.error('Erro ao registrar na timeline:', e);
  }
}

/**
 * Busca uma tarefa aberta (não concluída) com o mesmo título para um negócio.
 */
export async function getPendingTask(title, dealId) {
  const { orgId } = await getUserPermissions();
  
  const { data, error } = await supabase
    .from('tasks')
    .select('id, status')
    .eq('title', title)
    .eq('deal_id', dealId)
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function checkTaskExists(title, dealId) {
  const { userId, orgId } = await getUserPermissions();
  
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('title', title)
    .eq('deal_id', dealId)
    .eq('org_id', orgId)
    .eq('status', 'pending');

  if (error) throw error;
  return count > 0;
}

export async function deleteTask(id) {
  const { orgId } = await getUserPermissions();
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) throw error;
}
