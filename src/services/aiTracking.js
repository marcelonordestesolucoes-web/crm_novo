import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';

/**
 * Registra interações do usuário com o AI Assistant.
 * 
 * @param {string} dealId - O ID do negócio
 * @param {'created_task'|'completed_task'} action - Ação executada
 */
export async function trackAIInteraction(dealId, action) {
  try {
    const { userId, orgId } = await getUserPermissions();

    if (!userId || !orgId || !dealId) {
      console.warn('[Stitch AI] Missing data for tracking:', { userId, orgId, dealId });
      return;
    }

    const { error } = await supabase
      .from('ai_interactions')
      .insert([{
        deal_id: dealId,
        user_id: userId,
        org_id: orgId,
        action: action
      }]);

    if (error) {
      console.warn('[Stitch AI] Supabase falhou ao logar interação:', error.message);
    }
  } catch (err) {
    // Falha silenciosa para não quebrar a UX, logando apênas no console
    console.warn('[Stitch AI] Erro no registro de tracking da IA:', err);
  }
}

/**
 * Calcula o nível de aderência histórico do usuário às recomendações da IA.
 * Utiliza { count: 'exact', head: true } para não trafegar linhas, apenas o número puro (performance).
 */
export async function getUserAdherenceScore() {
  try {
    const { userId, orgId } = await getUserPermissions();

    if (!userId || !orgId) {
      return { score: 0, percentage: 0, totalCreated: 0, totalCompleted: 0 };
    }

    const { count: totalCreated, error: err1 } = await supabase
      .from('ai_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .eq('action', 'created_task');

    const { count: totalCompleted, error: err2 } = await supabase
      .from('ai_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .eq('action', 'completed_task');

    if (err1 || err2) {
      console.warn('[Stitch AI] Falha ao extrair analítico da IA:', err1 || err2);
      return { score: 0, percentage: 0, totalCreated: 0, totalCompleted: 0 };
    }

    const created = totalCreated || 0;
    const completed = totalCompleted || 0;

    // Divisão Segura contra erro de infinito/NaN e lógica de aderência.
    const score = created === 0 ? 0 : completed / created;

    return {
      score: score,
      percentage: Math.round(score * 100),
      totalCreated: created,
      totalCompleted: completed
    };
  } catch (err) {
    console.warn('[Stitch AI] Falha silenciosa ao calcular Score:', err);
    return { score: 0, percentage: 0, totalCreated: 0, totalCompleted: 0 };
  }
}
