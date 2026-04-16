import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, LoadingSpinner, GlassCard } from '@/components/ui';
import { useSupabase } from '@/hooks/useSupabase';
import { getDeals } from '@/services/deals';
import { calculateDealRisk } from '@/utils/dealRisk';
import { supabase } from '@/lib/supabase';
import { createTask, checkTaskExists, getTasks, toggleTaskStatus } from '@/services/tasks';
import { trackAIInteraction, getUserAdherenceScore } from '@/services/aiTracking';

import { getOrgGoal, getMyMemberGoal } from '@/services/goals';
import { getUserPermissions } from '@/services/auth';
import { Target, TrendingUp, Users } from 'lucide-react';

import { calculateClosingScore, calculateForecastMetrics } from '@/utils/intelligence';
import { formatCurrency } from '@/constants/config';

export const OracleInsight = ({ onOpenDeal }) => {
  const { data: deals, loading: loadingDeals, refetch: refetchDeals } = useSupabase(getDeals);
  const { data: tasks, refetch: refetchTasks } = useSupabase(getTasks);

  const [processingId, setProcessingId] = React.useState(null);
  const [completedIds, setCompletedIds] = React.useState(new Set());
  const [adherenceData, setAdherenceData] = React.useState(null);
  const [latestNotes, setLatestNotes] = React.useState({});
  const [orgGoal, setOrgGoal] = React.useState(null);

  // Load latest notes for all visible deals to generate contextual NLP and Summaries
  React.useEffect(() => {
    const fetchLatestNotes = async () => {
      if (!deals || deals.length === 0) return;

      const dealIds = deals.map(d => d.id);
      const { data, error } = await supabase
        .from('deal_notes')
        .select('deal_id, content')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const map = {};
        data.forEach(note => {
          if (!map[note.deal_id]) map[note.deal_id] = [];
          if (map[note.deal_id].length < 3) {
            map[note.deal_id].push(note.content);
          }
        });
        setLatestNotes(map);
      }
    };
    fetchLatestNotes();
  }, [deals]);

  // Load Organization/Member Goal for Forecast Calculation
  React.useEffect(() => {
    const fetchGoal = async () => {
      try {
        const perms = await getUserPermissions();
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        let data = null;
        if (perms.isAdmin) {
          data = await getOrgGoal(month, year);
        } else {
          data = await getMyMemberGoal(month, year);
        }
        if (data) setOrgGoal(data);
      } catch (error) {
        console.error('Error fetching goal context:', error);
      }
    };
    fetchGoal();
  }, []);

  // Load Adherence Score to adapt AI Behavior
  React.useEffect(() => {
    const fetchAdherence = async () => {
      const data = await getUserAdherenceScore();
      setAdherenceData(data);
    };
    fetchAdherence();
  }, []);

  // Analyze deals for risks and insights
  const analysis = React.useMemo(() => {
    if (!deals || deals.length === 0) return null;

    // Helper: Forecast Engine (Delegated to Utility for Consistency)
    const runForecast = (dealAnalytics) => {
      const metrics = calculateForecastMetrics(dealAnalytics, latestNotes, orgGoal?.amount > 0 ? orgGoal.amount : 50000);

      // Console Validation for the "Arquiteto"
      console.log('--- ESTRATÉGICO: FORECAST IA (CENTRALIZADO) ---');
      console.log(`Forecast: R$ ${metrics.totalForecast.toLocaleString()}`);
      console.log(`Meta: R$ ${metrics.meta.toLocaleString()}`);
      console.log(`Gap: R$ ${metrics.gap.toLocaleString()}`);
      console.log(`Progress: ${(metrics.progress * 100).toFixed(1)}%`);
      console.log('--------------------------------');

      return metrics;
    };

    // Helper: Calculate Financial Impact
    const getFinancialScore = (val) => {
      if (val > 50000) return 3;
      if (val > 10000) return 2;
      return 1;
    };

    // Helper: Generate Smart Context Summary (Refined UX)
    const generateDealSummary = (notes) => {
      if (!notes || notes.length === 0) return null;
      const clean = notes.map(n => n.toLowerCase());
      const parts = [];
      if (clean.some(n => n.includes('proposta') || n.includes('orçamento'))) parts.push("solicitou proposta");
      if (clean.some(n => n.includes('reunião') || n.includes('reuniao') || n.includes('call'))) parts.push("deseja reunião");
      if (clean.some(n => n.includes('ligar') || n.includes('retornar') || n.includes('contato'))) parts.push("pediu contato");

      const joinNatural = (arr) => {
        if (arr.length === 1) return arr[0];
        if (arr.length === 2) return arr.join(' e ');
        return `${arr.slice(0, -1).join(', ')} e ${arr[arr.length - 1]}`;
      };

      return parts.length > 0 ? `Cliente ${joinNatural(parts)}` : notes[0];
    };

    const activeDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');

    const riskAnalytics = activeDeals.map(deal => {
      const riskData = calculateDealRisk(deal.qualification);
      const notes = latestNotes[deal.id] || [];
      const closingData = calculateClosingScore(deal, notes);

      return {
        ...deal,
        riskData,
        closingData
      };
    });

    const highRiskDeals = riskAnalytics.filter(d => d.riskData?.risk === 'high');
    // Calculate forecast FIRST so velocity context is available for recommendations
    const forecastData = runForecast(riskAnalytics);
    const dailyVelocity = forecastData?.gap > 0 && forecastData?.daysRemaining > 0
      ? Math.round(forecastData.gap / Math.max(1, forecastData.daysRemaining))
      : 0;
    const hasGap = forecastData?.gap > 0;
    const isUnrealistic = hasGap && forecastData.gap > (forecastData.totalForecast * 3);
    const isMetaImpossible = hasGap && forecastData.totalPipeline < forecastData.meta;
    const missingPipeline = Math.max(0, forecastData.meta - forecastData.totalPipeline);

    // Plano de Recuperação — Cálculos para contexto da IA
    const allDealValues = riskAnalytics.map(d => d.value || 0).filter(v => v > 0);
    const avgTicketAI = allDealValues.length > 0
      ? allDealValues.reduce((s, v) => s + v, 0) / allDealValues.length
      : 0;
    const dealsNeededAI = avgTicketAI > 0 ? Math.ceil(missingPipeline / avgTicketAI) : 0;

    // Adaptive AI Tone based on Gap %
    const gapPercent = forecastData?.progress != null ? (1 - forecastData.progress) * 100 : 100;
    const isAggressive = gapPercent > 60;  // Pipeline crítico → IA agressiva
    const isBalanced = gapPercent > 30 && gapPercent <= 60; // Pipeline moderado → IA equilibrada
    // gapPercent <= 30 → IA em modo refinamento

    const buildVelocityContext = (dealForecast) => {
      if (!hasGap || dailyVelocity <= 0) return '';
      const gapMsg = `Faltam ${formatCurrency(Math.round(forecastData.gap))} para a meta.`;
      const velocityMsg = `Você precisa gerar ${formatCurrency(dailyVelocity)} hoje.`;
      const dealContrib = dealForecast > 0 ? `Este negócio pode contribuir com ${formatCurrency(Math.round(dealForecast))}.` : '';

      if (isMetaImpossible) {
        const recoveryParts = [
          `Gerar ${formatCurrency(Math.round(missingPipeline))} em pipeline novo`,
          dealsNeededAI > 0 ? `ou adicionar ${dealsNeededAI} deals (ticket médio: ${formatCurrency(Math.round(avgTicketAI))})` : null,
        ].filter(Boolean).join(' — ');
        return ` Meta não atingível. Plano de Recuperação: ${recoveryParts}. Priorize prospecção agora.`;
      }

      const insufficiencyMsg = isUnrealistic ? ' Pipeline atual insuficiente para a meta.' : '';

      if (isAggressive) return ` ${gapMsg} ${velocityMsg} ${dealContrib}${insufficiencyMsg} Priorize contato imediato.`;
      if (isBalanced) return ` ${velocityMsg} ${dealContrib}${insufficiencyMsg} Avance este deal para aproximar a meta.`;
      return ` Continue refinando para garantir o fechamento.`;
    };

    const recommendations = [];

    // Main Recommendation Factory
    const generateRecommendationItems = (deal) => {
      const now = new Date();
      const lastUpdate = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.createdAt);
      const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);
      const risk = deal.riskData?.risk || 'low';
      const noteArray = latestNotes[deal.id] || [];
      const primaryNote = noteArray.length > 0 ? noteArray[0] : null;

      const dealForecast = (deal.value || 0) * ((deal.closingData?.score || 0) / 100);
      const isEnoughForToday = dailyVelocity > 0 && dealForecast >= dailyVelocity;

      const fScore = getFinancialScore(deal.value || 0);
      const closing = deal.closingData;
      const summary = generateDealSummary(noteArray);
      const items = [];

      // LAYER 0: SEMANTIC KEYWORDS (Expanded Synonyms)
      noteArray.forEach(n => {
        const noteStr = n.toLowerCase();
        let kwItem = null;
        if (noteStr.includes('proposta') || noteStr.includes('orçamento')) kwItem = { action: "Enviar proposta ao cliente", reason: "Cliente solicitou proposta/orçamento", icon: 'request_quote', type: 'low', pScore: 1 };
        else if (noteStr.includes('reuniao') || noteStr.includes('reunião') || noteStr.includes('call')) kwItem = { action: "Agendar reunião", reason: "Cliente solicitou reunião/call", icon: 'event', type: 'medium', pScore: 2 };
        else if (noteStr.includes('ligar') || noteStr.includes('retornar') || noteStr.includes('contato')) kwItem = { action: "Ligar para o cliente", reason: "Cliente pediu contato/retorno", icon: 'call', type: 'high', pScore: 3 };

        if (kwItem) {
          if (noteStr.includes('hoje') || noteStr.includes('amanhã') || noteStr.includes('urgente') || noteStr.includes('agora')) {
            kwItem.pScore = 3; kwItem.type = 'high';
          }
          // Elite Synchronization: Total Impact must match the sorting formula
          const totalImpact = (fScore * 1.5) + (kwItem.pScore * 2);
          if (totalImpact >= 7.5) kwItem.priorityLabel = "🔥 Alta prioridade";
          else if (totalImpact >= 5) kwItem.priorityLabel = "🟡 Média prioridade";
          else kwItem.priorityLabel = "🟢 Baixa prioridade";
        }

        if (kwItem && !items.some(i => i.action === kwItem.action)) {
          items.push({
            ...kwItem, financialScore: fScore, prediction: closing, summary,
            color: kwItem.pScore >= 3 || fScore >= 3 ? 'text-error' : kwItem.type === 'medium' ? 'text-amber-500' : 'text-sky-500',
            bg: kwItem.pScore >= 3 || fScore >= 3 ? 'bg-error/10' : kwItem.type === 'medium' ? 'bg-amber-500/10' : 'bg-sky-500/10'
          });
        }
      });

      // Hybrid Logic: Keep strategic diagnostics even if we have notes IF it is High Risk.
      if (items.length > 0 && risk !== 'high') return items;

      const dealForecastForContext = (deal.value || 0) * ((deal.closingData?.score || 0) / 100);
      const velocityContext = buildVelocityContext(dealForecastForContext);

      const genAction = (def) => primaryNote ? `Você comentou que "${primaryNote}" — podemos avançar?` : def;

      // 🎯 Game Changer: deal que resolve o dia inteiro
      if (isEnoughForToday && isAggressive) {
        items.push({ action: genAction('Este deal RESOLVE O DIA. Feche agora'), reason: `Forecast cobre a velocidade diária necessária (${formatCurrency(dailyVelocity)}/dia). Prioridade máxima.`, dealForecast: dealForecastForContext, prediction: closing, summary, type: 'high', pScore: 3, financialScore: fScore, priorityLabel: '🔥 Alta prioridade', icon: 'local_fire_department', color: 'text-error', bg: 'bg-error/10' });
        return items;
      }

      if (risk === 'high') {
        items.push({ action: genAction(isAggressive ? 'Feche este deal AGORA' : 'Revisar negociação imediatamente'), reason: `Deal em alto risco.${velocityContext}`, dealForecast: dealForecastForContext, prediction: closing, summary, type: 'high', pScore: 2, financialScore: fScore, priorityLabel: fScore >= 2 ? '🔥 Alta prioridade' : '🟡 Média prioridade', icon: 'warning', color: 'text-error', bg: 'bg-error/10' });
      } else if (daysSinceUpdate > 3) {
        items.push({ action: genAction(isAggressive ? 'Ligar agora — sem atrasos' : 'Fazer follow-up hoje'), reason: `Sem atividade há ${Math.floor(daysSinceUpdate)} dias.${velocityContext}`, dealForecast: dealForecastForContext, prediction: closing, summary, type: 'medium', pScore: 1, financialScore: fScore, priorityLabel: fScore >= 3 ? '🔥 Alta prioridade' : '🟢 Baixa prioridade', icon: 'schedule', color: 'text-amber-500', bg: 'bg-amber-500/10' });
      } else {
        items.push({ action: genAction(isBalanced ? 'Avançar para próxima etapa' : 'Manter engajamento'), reason: `Próximo passo estratégico.${velocityContext}`, dealForecast: dealForecastForContext, prediction: closing, summary, type: 'low', pScore: 1, financialScore: fScore, priorityLabel: '🟢 Baixa prioridade', icon: 'chat', color: 'text-emerald-500', bg: 'bg-emerald-500/10' });
      }

      return items;
    };

    riskAnalytics.forEach(deal => {
      const recs = generateRecommendationItems(deal);
      const existingTasks = (tasks || []).filter(t => t.dealId === deal.id);
      const pendingTask = existingTasks.find(t => t.status === 'pending');

      recs.forEach(rec => {
        if (existingTasks.some(t => t.title === rec.action && t.status === 'completed')) return;
        recommendations.push({
          id: deal.id, dealTitle: `${deal.title} (R$ ${deal.value?.toLocaleString()})`, companyName: deal.company,
          existingTaskId: pendingTask?.id, ...rec
        });
      });
    });

    // forecastData already calculated above

    // Execuçao Mode Label
    const executionModeLabel = isAggressive ? '🔥 MODO FECHAMENTO' : isBalanced ? '⚡ MODO ACELERAÇÃO' : '🧠 MODO OTIMIZAÇÃO';

    // PRO LEVEL: Meta-weighted sort
    const priorityWeights = { ultra: 10, high: 5, medium: 2, low: 1 };
    const sorted = [...recommendations].sort((a, b) => {
      const metaWeightA = forecastData?.gap > 0 ? ((a.prediction?.score || 0) * (a.financialScore || 1)) : 0;
      const metaWeightB = forecastData?.gap > 0 ? ((b.prediction?.score || 0) * (b.financialScore || 1)) : 0;
      const impactA = ((a.financialScore || 1) * 1.5) + ((a.pScore || 1) * 2) + (metaWeightA * 0.3);
      const impactB = ((b.financialScore || 1) * 1.5) + ((b.pScore || 1) * 2) + (metaWeightB * 0.3);
      if (impactB !== impactA) return impactB - impactA;
      return (priorityWeights[b.type] || 0) - (priorityWeights[a.type] || 0);
    });

    let finalRecs;
    if (!adherenceData || adherenceData.score < 0.4) finalRecs = sorted.slice(0, 1);
    else if (adherenceData.score < 0.7) finalRecs = sorted.slice(0, 2);
    else finalRecs = sorted.slice(0, 3).map(r => ({ ...r, tag: r.type === 'high' ? 'Crítico' : 'Estratégico' }));

    // FIX 5: Quando meta é impossível, forçar card de prospecção no TOPO da fila
    if (isMetaImpossible) {
      const prospectingCard = {
        id: 'pipeline-gap',
        dealTitle: 'Ação Urgente de Prospecção',
        companyName: null,
        existingTaskId: null,
        action: `Gerar ${formatCurrency(Math.round(missingPipeline))} em novas oportunidades`,
        reason: [
          `• Gerar ${formatCurrency(Math.round(missingPipeline))} em pipeline novo`,
          dealsNeededAI > 0 ? `• Adicionar ${dealsNeededAI} deals (ticket médio: ${formatCurrency(Math.round(avgTicketAI))})` : null,
          `• Priorize prospecção imediatamente.`,
        ].filter(Boolean).join(' '),
        dealForecast: 0,
        prediction: null,
        summary: null,
        type: 'high',
        pScore: 3,
        financialScore: 3,
        icon: 'person_search',
        color: 'text-error',
        bg: 'bg-error/10',
        priorityLabel: '🔥 Alta prioridade',
        isProspectingAlert: true,
      };
      finalRecs = [prospectingCard, ...finalRecs.slice(0, 2)];
    }

    // Plano combinado de fechamento
    const planSummary = sorted
      .filter(r => (r.dealForecast || 0) > 0)
      .slice(0, 2)
      .map(r => formatCurrency(Math.round(r.dealForecast || 0)))
      .join(' + ');

    return {
      highRiskCount: finalRecs.filter(r => r.type === 'high').length,
      recommendations: finalRecs,
      totalValueAtRisk: highRiskDeals.reduce((sum, d) => sum + (d.value || 0), 0),
      executionModeLabel,
      planSummary,
      isUnrealistic,
      isMetaImpossible,
      missingPipeline,
      forecastData
    };
  }, [deals, tasks, adherenceData, latestNotes, orgGoal]);

  const moodGlow = React.useMemo(() => {
    if (analysis?.isMetaImpossible) {
      return "bg-red-500/40";
    }

    if (analysis?.highRiskCount > 0) {
      return "bg-amber-500/40";
    }

    return "bg-indigo-500/40";
  }, [analysis]);

  const handleCreateTask = async (item) => {
    try {
      setProcessingId(item.id + item.reason);
      const exists = await checkTaskExists(item.action, item.id);
      if (exists) {
        setCompletedIds(prev => new Set([...prev, item.id + item.reason]));
        return;
      }
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await createTask({
        title: item.action,
        description: item.reason,
        dueDate: tomorrow.toISOString().split('T')[0],
        dealId: item.id,
        priority: item.type === 'high' ? 'high' : 'medium'
      });
      trackAIInteraction(item.id, "created_task");
      setCompletedIds(prev => new Set([...prev, item.id + item.reason]));
      refetchTasks();
    } catch (error) { console.error('Task error:', error); }
    finally { setProcessingId(null); }
  };

  const handleToggleTask = async (item) => {
    try {
      setProcessingId(item.existingTaskId);
      await toggleTaskStatus(item.existingTaskId, 'pending');
      trackAIInteraction(item.id, "completed_task");
      setCompletedIds(prev => new Set([...prev, item.id + item.reason]));
      refetchTasks();
    } catch (error) { console.error('Toggle error:', error); }
    finally { setProcessingId(null); }
  };

  if (loadingDeals) return <div className="bg-navy rounded-[2.5rem] p-10 h-[400px] flex items-center justify-center"><LoadingSpinner color="white" /></div>;

  const hasData = analysis && analysis.recommendations.length > 0;

  return (
    <aside className="space-y-6 antialiased">
      <GlassCard beam={true} className="min-h-[520px] flex flex-col group/ai">
        {/* 🎨 MOOD LUMINOUS — Brilho de estado (Extremo do canvas, PULSANTE) */}
        <div className={cn("absolute -top-32 -right-32 w-[350px] h-[350px] blur-[100px] rounded-full transition-all duration-1000 opacity-60 animate-pulse", moodGlow)} />

        {/* 🌈 GLOW — Atmosfera viva (Profundidade Midnight) */}
        <div className="absolute -top-10 -left-10 w-[220px] h-[220px] bg-indigo-600/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-purple-700/10 blur-[100px] rounded-full" />

        {/* 📦 CONTEÚDO — Z-index 10 orzado */}
        <div className="relative z-10 p-5 flex flex-col h-full" style={{ transformStyle: 'preserve-3d' }}>
          <div className="flex items-center gap-4 mb-6" style={{ transform: 'translateZ(40px)' }}>
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white border border-white/10 shadow-sm">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <div>
              <h2 className="font-manrope font-black text-[10px] text-slate-400 tracking-widest uppercase opacity-60">Arquiteto Pessoal</h2>
              <p className="font-manrope font-black text-white text-lg tracking-tight">AI Assistant</p>
              {analysis?.executionModeLabel && (
                <span className="text-[9px] font-black uppercase tracking-widest text-primary-light mt-0.5 block">
                  {analysis.executionModeLabel}
                </span>
              )}
            </div>
          </div>

          <p className="text-white font-manrope font-bold text-xl leading-snug mb-4 tracking-tight" style={{ transform: 'translateZ(30px)' }}>
            {hasData ? (
              analysis.highRiskCount > 0
                ? `Atenção: Identifiquei ${analysis.highRiskCount} deals em alto risco. Priorize estas ações.`
                : analysis.isMetaImpossible
                  ? `Meta Impossível: Você precisa gerar aproximadamente ${formatCurrency(Math.round(analysis.missingPipeline))} em novos negócios para suportar seu objetivo.`
                  : analysis.isUnrealistic
                    ? "Ajuste estratégico necessário: O pipeline atual é insuficiente para a meta. Foque nestas oportunidades."
                    : "Pipeline saudável! Aqui estão os próximos passos para fechar negócio."
            ) : "Inicie a qualificação para receber insights estratégicos."}
          </p>

          {/* FIX 6: Adaptar seção baseada em isMetaImpossible */}
          {analysis?.isMetaImpossible ? (
            <div className="mb-6 px-4 py-4 rounded-2xl bg-red-400/10 border border-red-400/30" style={{ transform: 'translateZ(35px)' }}>
              <p className="text-[9px] font-black uppercase tracking-widest text-red-300 mb-1">Alerta de Prospecção</p>
              <p className="text-sm font-black text-red-200">Gerar {formatCurrency(Math.round(analysis.missingPipeline))} em novos deals</p>
              <p className="text-[10px] font-bold text-red-100/60 mt-1">Pipeline atual insuficiente para a meta</p>
            </div>
          ) : analysis?.planSummary ? (
            <div className="mb-6 px-4 py-3 rounded-2xl bg-white/[0.05] backdrop-blur-md border border-white/10 shadow-sm" style={{ transform: 'translateZ(35px)' }}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Plano de Fechamento</p>
              <p className="text-sm font-black text-primary-light">{analysis.planSummary}</p>
            </div>
          ) : null}

          <div className="mt-auto" style={{ transform: 'translateZ(25px)' }}>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block opacity-60">FILA DE EXECUÇÃO INTELIGENTE</span>
            <div className="space-y-3">
              {hasData ? (analysis.recommendations.map((item, idx) => (
                <div key={idx} className="w-full bg-white/[0.05] backdrop-blur-md p-3 pl-4 rounded-[20px] border border-white/10 shadow-sm flex items-start gap-4 hover:bg-white/[0.08] hover:scale-[1.01] transition-all duration-300 relative overflow-hidden group/item"
                     style={{ transform: 'translateZ(50px)' }}>
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/10 mt-1", item.bg)}>
                    <span className={cn("material-symbols-outlined text-[20px]", item.color)}>{item.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.priorityLabel && (
                      <span className={cn("text-[9px] font-black uppercase tracking-widest mb-1.5 block", item.priorityLabel.includes('Alta') ? "text-red-400" : item.priorityLabel.includes('Média') ? "text-amber-400" : "text-emerald-400")}>
                        {item.priorityLabel}
                      </span>
                    )}
                    {item.summary && <p className="text-[10px] font-medium text-slate-400 italic mb-2 leading-relaxed">Contexto: {item.summary}</p>}
                    <p className="text-sm font-bold text-white truncate">{item.action}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 opacity-60">{item.reason}</p>

                    {item.dealForecast > 0 && (
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                        Contribui: {formatCurrency(Math.round(item.dealForecast))}
                      </p>
                    )}

                    {item.prediction && (
                      <p className={cn("text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-1.5", item.prediction.level === 'high' ? "text-primary" : item.prediction.level === 'low' ? "text-red-600" : "text-amber-600")}>
                        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>{item.prediction.icon}</span>
                        {item.prediction.label} ({item.prediction.score}%)
                      </p>
                    )}

                    {onOpenDeal && (
                      <div className="mt-3 flex items-center gap-4">
                        <button onClick={() => onOpenDeal(item.id)} className="text-[9px] font-black uppercase tracking-[0.2em] text-primary-light hover:text-white transition-colors flex items-center gap-2 group/link">Abrir deal<span className="material-symbols-outlined text-xs group-hover/link:translate-x-1 transition-transform">arrow_forward</span></button>
                        <button onClick={() => item.existingTaskId ? handleToggleTask(item) : handleCreateTask(item)} disabled={processingId === item.existingTaskId || completedIds.has(item.id + item.reason)} className={cn("text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.1] hover:bg-white/[0.2] backdrop-blur-md border border-white/10 shadow-sm text-white", completedIds.has(item.id + item.reason) ? "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" : "")}>
                          {completedIds.has(item.id + item.reason) ? "Concluído" : item.existingTaskId ? "Concluir" : "Criar Tarefa"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))) : <div className="py-4 text-xs font-bold text-slate-600 italic opacity-60">Aguardando dados para gerar recomendações.</div>}
            </div>
          </div>
        </div>
      </GlassCard>

      <Card variant="glass" className="p-10">
        <div className="flex items-center gap-3 mb-8"><span className="material-symbols-outlined text-primary text-[24px] font-black">task_alt</span><h3 className="font-manrope font-black text-xl text-on-surface tracking-tight">Prioridades de Hoje</h3></div>
        <ul className="space-y-4">
          <li className="flex items-start gap-4 p-5 rounded-[24px] bg-white/40 border-white/40 hover:bg-white/60 transition-all cursor-pointer group shadow-sm"><div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><span className="material-symbols-outlined font-black">groups</span></div><div><p className="text-sm font-black text-on-surface tracking-tight group-hover:text-primary transition-colors">Revisão de Qualificação</p><p className="text-[11px] text-slate-500 mt-1 font-bold uppercase tracking-widest opacity-60">Focar nos deals High Risk</p></div></li>
          <li className="flex items-start gap-4 p-5 rounded-[24px] bg-white/40 border-white/40 hover:bg-white/60 transition-all cursor-pointer group shadow-sm opacity-70"><div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined font-black">mail</span></div><div><p className="text-sm font-black text-on-surface tracking-tight group-hover:text-primary transition-colors">Follow-up Automático</p><p className="text-[11px] text-slate-500 mt-1 font-bold uppercase tracking-widest opacity-60">Disparar para 5 contatos</p></div></li>
        </ul>
      </Card>
    </aside>
  );
};
