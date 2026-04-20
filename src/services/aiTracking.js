import { supabase } from '@/lib/supabase';
import { getUserPermissions } from './auth';

/**
 * Registra eventos comportamentais da IA (Fase 5 Elite).
 * eventType: ai_insight_viewed, ai_action_clicked, ai_message_copied, ai_ignored, ai_upsell
 */
export async function trackUserEvent(dealId, eventType, data = {}) {
    try {
        const { userId, orgId } = await getUserPermissions();
        if (!userId || !orgId) return;

        // Se for um evento de atualização de valor, calculamos o delta para o tracking de Upsell
        let payload = {
            user_id: userId,
            org_id: orgId,
            deal_id: dealId,
            event_type: eventType,
            ai_strategy_category: data.category || null,
            ai_outcome: data.outcome || 'pending',
            metadata: data.metadata || {}
        };

        if (eventType === 'ai_upsell') {
            payload.previous_value = data.previousValue;
            payload.new_value = data.newValue;
            payload.value_delta = data.newValue - data.previousValue;
            payload.influenced_by_ai = true;
        }

        const { error } = await supabase.from('user_events').insert([payload]);
        if (error) {
            console.warn('[Stitch Tracking] Erro:', error.message);
        } else if (eventType === 'ai_action_suggested' && data.category) {
            // [PHASE 6 ELITE] - Incremento Atômico de Participação
            await supabase.rpc('increment_strategy_total', { 
                p_org_id: orgId, 
                p_category: data.category 
            });
        }
    } catch (err) {
        console.error('[Stitch Tracking] Erro crítico:', err);
    }
}

/**
 * Lógica de Atribuição de Upsell (Elite).
 * Verifica se uma mudança de valor ocorreu na janela de 6h após o último insight da IA.
 */
export async function checkAndTrackAIUpsell(dealId, previousValue, newValue) {
    if (newValue <= previousValue) return;

    try {
        const { orgId } = await getUserPermissions();
        
        // Busca a organização para ver a janela configurada (default 6h)
        const { data: org } = await supabase.from('organizations').select('influence_window_hours').eq('id', orgId).single();
        const windowHours = org?.influence_window_hours || 6;

        // Verifica se houve uma visualização de insight nas últimas X horas
        const { data: recentView, error } = await supabase
            .from('user_events')
            .select('created_at')
            .eq('deal_id', dealId)
            .eq('event_type', 'ai_insight_viewed')
            .gt('created_at', new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

        if (recentView?.length > 0) {
            console.log(`[Stitch AI] Upsell detectado! Atribuindo à IA (Janela de ${windowHours}h)`);
            await trackUserEvent(dealId, 'ai_upsell', { previousValue, newValue });
        }
    } catch (err) {
        console.error('[Stitch AI] Erro ao processar atribuição de upsell:', err);
    }
}

/**
 * Envia feedback estruturado (Fase 5).
 * @param {string} feedbackType - 'positive' | 'negative'
 * @param {string} errorType - Motivo do erro (opcional para feedback negativo)
 */
export async function submitAIFeedback(messageId, dealId, feedbackType, errorType = null, comment = null) {
    try {
        const { userId, orgId } = await getUserPermissions();
        if (!userId || !orgId) return;

        const { error } = await supabase
            .from('ai_feedback')
            .insert([{
                message_id: messageId,
                deal_id: dealId,
                user_id: userId,
                org_id: orgId,
                feedback_type: feedbackType,
                error_type: errorType,
                comment: comment
            }]);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('[Stitch Feedback] Falha:', err);
        return { success: false };
    }
}

/**
 * Busca métricas de validação de valor (Fase 5 Elite).
 */
export async function getValidationMetrics() {
    try {
        const { orgId } = await getUserPermissions();
        if (!orgId) return null;

        const { data, error } = await supabase.rpc('get_ai_validation_metrics_v2', { p_org_id: orgId });
        if (error) throw error;
        return data;
    } catch (err) {
        console.error('[Stitch Metrics] Erro:', err);
        return null;
    }
}

/**
 * Lógica de Atribuição Elite (v5.0).
 * Vincula o avanço de estágio à ÚLTIMA ação da IA nos últimos 24h.
 */
export async function attributeAISuccess(dealId) {
    try {
        const { orgId } = await getUserPermissions();
        
        // 1. Buscar o evento de IA mais recente nas últimas 24h (Copied ou Clicked)
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentAction, error } = await supabase
            .from('user_events')
            .select('id, event_type, ai_strategy_category')
            .eq('deal_id', dealId)
            .in('event_type', ['ai_action_clicked', 'ai_message_copied'])
            .gt('created_at', dayAgo)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error || !recentAction || recentAction.length === 0) return;

        const event = recentAction[0];
        console.log(`[Stitch AI] Atribuindo sucesso à estratégia: ${event.ai_strategy_category}`);

        // 2. Marcar como Sucesso no evento
        await supabase
            .from('user_events')
            .update({ ai_outcome: 'success' })
            .eq('id', event.id);

        // [PHASE 6 ELITE] - Incremento Atômico de Sucesso na Memória da Org
        await supabase.rpc('increment_strategy_success', {
            p_org_id: orgId,
            p_category: event.ai_strategy_category
        });

    } catch (err) {
        console.error('[Stitch AI] Erro na atribuição de sucesso:', err);
    }
}

/**
 * Rastreia o progresso do onboarding da IA (v6.2 Smart Dash).
 * Verifica se o usuário já realizou as 3 ações chave para a ativação.
 */
export async function getOnboardingProgress() {
    try {
        const { orgId } = await getUserPermissions();
        if (!orgId) return null;

        const { data, error } = await supabase.rpc('get_ai_onboarding_progress', { p_org_id: orgId });
        if (error) throw error;

        const { step1_done, step2_done, step3_done } = data[0];

        return {
            step1: step1_done,
            step2: step2_done,
            step3: step3_done,
            isComplete: step1_done && step2_done && step3_done,
            totalDone: [step1_done, step2_done, step3_done].filter(Boolean).length
        };
    } catch (err) {
        console.error('[Stitch Onboarding] Erro ao buscar progresso:', err);
        return { step1: false, step2: false, step3: false, isComplete: false, totalDone: 0 };
    }
}

/**
 * Busca estatísticas de performance do Playbook (v5.0).
 * Calcula taxa de sucesso por categoria de estratégia.
 */
export async function getPlaybookStats() {
    try {
        const { orgId } = await getUserPermissions();
        if (!orgId) return [];

        const { data, error } = await supabase
            .from('user_events')
            .select('ai_strategy_category, ai_outcome')
            .eq('org_id', orgId)
            .not('ai_strategy_category', 'is', null);

        if (error) throw error;

        // Agregação manual (mais rápida que RPC para volume médio)
        const stats = data.reduce((acc, curr) => {
            const cat = curr.ai_strategy_category;
            if (!acc[cat]) acc[cat] = { total: 0, successes: 0 };
            acc[cat].total++;
            if (curr.ai_outcome === 'success') acc[cat].successes++;
            return acc;
        }, {});

        return Object.entries(stats).map(([category, values]) => ({
            category,
            successRate: Math.round((values.successes / values.total) * 100),
            total: values.total
        })).sort((a, b) => b.successRate - a.successRate);

    } catch (err) {
        console.error('[Stitch Playbook Stats] Erro:', err);
        return [];
    }
}
