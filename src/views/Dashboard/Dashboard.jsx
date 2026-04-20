import React from 'react';
import { Card, Avatar } from '@/components/ui';
import { SummaryStats } from '@/components/dashboard/SummaryStats';
import { PriorityQueue } from '@/components/dashboard/PriorityQueue';
import { ActionableDeals } from '@/components/dashboard/ActionableDeals';
import { PlaybookInsights } from '@/components/dashboard/PlaybookInsights';
import { IAPerformance } from '@/components/dashboard/IAPerformance';
import { AIOnboardingRoadmap } from '@/components/dashboard/AIOnboardingRoadmap';
import { OracleInsight } from '@/components/intelligence/OracleInsight';
import { DealDetailsModal } from '@/views/Funnel/DealDetailsModal';
import { useSupabase } from '@/hooks/useSupabase';
import { getDeals } from '@/services/deals';
import { getOrgGoal, getMyMemberGoal } from '@/services/goals';
import { getUserPermissions } from '@/services/auth';
import { calculateClosingScore } from '@/utils/intelligence';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/constants/config';
import { AlertCircle, TrendingUp, Trophy, X, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const [viewingDeal, setViewingDeal] = React.useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false);
  const { data: deals, refetch } = useSupabase(getDeals);
  const [targetGoal, setTargetGoal] = React.useState(null);
  console.log('[DEBUG DASHBOARD] Deals:', deals?.length, 'Meta:', targetGoal);
  const [latestNotes, setLatestNotes] = React.useState({});
  const [planModalOpen, setPlanModalOpen] = React.useState(false);

  // Fetch Goal Context
  React.useEffect(() => {
    const fetchMeta = async () => {
      try {
        const perms = await getUserPermissions();
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        let data = perms.isAdmin 
          ? await getOrgGoal(month, year) 
          : await getMyMemberGoal(month, year);
        
        if (data) setTargetGoal(data);
      } catch (error) {
        console.error('Error fetching goal context:', error);
      }
    };
    fetchMeta();
  }, []);

  // Fetch Latest Notes
  React.useEffect(() => {
    const fetchNotes = async () => {
      if (!deals || deals.length === 0) return;
      const ids = deals.slice(0, 100).map(d => d.id); // performance protection
      const { data } = await supabase
        .from('deal_notes')
        .select('deal_id, content')
        .in('deal_id', ids)
        .order('created_at', { ascending: false });
      
      if (data) {
        const map = {};
        data.forEach(n => {
          if (!map[n.deal_id]) map[n.deal_id] = [];
          if (map[n.deal_id].length < 3) map[n.deal_id].push(n.content);
        });
        setLatestNotes(map);
      }
    };
    fetchNotes();
  }, [deals]);

  const handleOpenDeal = (dealId) => {
    const deal = deals?.find(d => d.id === dealId);
    if (deal) {
      setViewingDeal(deal);
      setDetailsModalOpen(true);
      setPlanModalOpen(false); // Close plan if opening details
    }
  };

  // Metrics Logic for the Sales Execution Card
  const metrics = React.useMemo(() => {
    if (!deals) return { totalForecast: 0, gap: 0, progress: 0, daysRemaining: 0, dailyVelocity: 0, topDealsToClose: [] };
    
    const metaValue = targetGoal?.amount > 0 ? targetGoal.amount : 50000;
    
    // Time Calculation (Calendar Days Remaining)
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysRemaining = Math.max(1, Math.ceil((endOfMonth - today) / (1000 * 60 * 60 * 24)));

    // Filter and Process Qualified Deals (Lead stage included for visibility)
    const categorizedDeals = deals
      .map(deal => {
        const label = (deal.stageLabel || '').toUpperCase();
        const isLead = label.includes('LEAD');
        
        const notes = latestNotes[deal.id] || [];
        const { score } = calculateClosingScore(deal, notes);
        
        // Leads não compõem Forecast financeiro, mas entram no processamento de sinais
        const forecast = isLead ? 0 : (deal.value || 0) * (score / 100);
        return { ...deal, score, forecast, isLead };
      });

    let totalForecast = 0;
    let maxPossible = 0;
    categorizedDeals.forEach(d => {
      totalForecast += d.forecast;
      if (d.status !== 'lost') {
        maxPossible += (d.value || 0);
      }
    });

    // Count won deals towards maxPossible if they aren't already included in categorizedDeals open filter
    // Note: categorizedDeals usually contains open deals.

    const rawGap = metaValue - totalForecast;
    const gap = Math.max(0, rawGap);
    const progress = metaValue > 0 ? Math.min(100, (totalForecast / metaValue) * 100) : 0;
    const dailyVelocity = gap > 0 ? Math.round(gap / daysRemaining) : 0;

    // Tactical Deal Selection (Value * Probability)
    const sortedForTarget = [...categorizedDeals]
      .filter(d => d.status !== 'won' && d.status !== 'lost')
      .sort((a, b) => b.forecast - a.forecast);

    const topDealsToClose = sortedForTarget.slice(0, 5);
    const isUnrealistic = gap > totalForecast * 3 && gap > 0;
    const isMetaImpossible = maxPossible < metaValue && gap > 0;
    const missingPipeline = Math.max(0, metaValue - maxPossible);

    const coverage = metaValue > 0 ? (totalForecast / metaValue) * 100 : 0;

    // Plano de Recuperação — Cálculos Base
    const allActiveDeals = deals.filter(d => d.status !== 'won' && d.status !== 'lost');
    const avgTicket = allActiveDeals.length > 0
      ? allActiveDeals.reduce((sum, d) => sum + (d.value || 0), 0) / allActiveDeals.length
      : 0;
    const wonCount = deals.filter(d => d.status === 'won').length;
    const conversionRateDecimal = deals.length > 0 ? wonCount / deals.length : 0;
    const pipelineNeeded = gap; // quanto falta no forecast
    const dealsNeeded = avgTicket > 0 ? Math.ceil(pipelineNeeded / avgTicket) : 0;
    const targetConversion = conversionRateDecimal > 0
      ? Math.min(1, conversionRateDecimal + 0.15)
      : 0.3;

    return { totalForecast, gap, progress, daysRemaining, dailyVelocity, coverage, topDealsToClose, metaValue, isUnrealistic, isMetaImpossible, missingPipeline, avgTicket, conversionRateDecimal, pipelineNeeded, dealsNeeded, targetConversion };
  }, [deals, latestNotes, targetGoal]);

  // Strategic Analysis Logic
  const stratAnalysis = React.useMemo(() => {
    if (!deals) return { risk: null, action: null, hot: null };

    const meta = targetGoal?.amount > 0 ? targetGoal.amount : 50000;
    
    // Filter out Leads
    const qualifiedDeals = deals.filter(d => {
      const label = (d.stageLabel || '').toUpperCase();
      return !label.includes('LEAD');
    });

    const categorized = qualifiedDeals.map(deal => {
      const notes = latestNotes[deal.id] || [];
      const { score } = calculateClosingScore(deal, notes);
      const forecast = (deal.value || 0) * (score / 100);
      return { ...deal, score, forecast };
    });

    return {
      risk: categorized
        .filter(d => d.score < 40)
        .sort((a, b) => b.forecast - a.forecast)[0],
      action: categorized
        .filter(d => d.score >= 40 && d.score <= 70)
        .sort((a, b) => b.forecast - a.forecast)[0],
      hot: categorized
        .filter(d => d.score > 70)
        .sort((a, b) => (b.forecast / meta) - (a.forecast / meta))[0]
    };
  }, [deals, latestNotes, targetGoal]);

  // Plano de Recuperação — Derivado do metrics
  const recoveryPlan = React.useMemo(() => {
    if (!metrics.isMetaImpossible) return null;
    return {
      pipeline: metrics.pipelineNeeded,
      deals: metrics.dealsNeeded,
      ticket: metrics.avgTicket,
      conversionNow: metrics.conversionRateDecimal,
      conversionTarget: metrics.targetConversion,
    };
  }, [metrics]);

  const metaValue = targetGoal?.amount || 50000;
  return (
    <div className="flex flex-col gap-y-10 pb-16 pt-0 -mt-10 animate-in fade-in duration-700 relative z-0">
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 xl:col-span-8 flex flex-col gap-12 relative">
          {/* 🌈 EXTREME VIBRATION GLOWS — Intensified for 'Crystal' immersion */}
          <div className="absolute top-0 left-1/4 w-[800px] h-[600px] bg-gradient-to-br from-blue-600/20 to-cyan-400/10 blur-[130px] rounded-full pointer-events-none -z-10 animate-pulse duration-[8000ms]" />
          <div className="absolute top-1/3 right-1/4 w-[700px] h-[700px] bg-gradient-to-br from-purple-600/15 to-pink-500/10 blur-[140px] rounded-full pointer-events-none -z-10 animate-pulse duration-[10000ms] delay-2000" />
          <div className="absolute bottom-10 left-1/3 w-full h-[500px] bg-gradient-to-tr from-teal-500/10 via-blue-500/5 to-transparent blur-[120px] rounded-full pointer-events-none -z-10" />

          <SummaryStats />

          {/* New Central Goal Card — Ultra Glass Premium */}
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200 relative">
            {/* Spotlight — Focal crystalline product highlight */}
            <div className="absolute -z-10 -top-20 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-blue-500/[0.05] blur-[140px] rounded-full pointer-events-none animate-pulse duration-[6000ms]" />
            
            <Card variant="crystal" className="p-10 relative z-10 overflow-hidden group/main shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border-white/20">
              {/* Border Beam — Sutil e etéreo */}
              <div 
                className="absolute inset-0 pointer-events-none z-20"
                style={{
                  maskImage: 'linear-gradient(black, black), linear-gradient(black, black)',
                  maskClip: 'content-box, border-box',
                  maskComposite: 'exclude',
                  WebkitMaskComposite: 'destination-out',
                  padding: '1.2px',
                }}
              >
                <div 
                  className="absolute bg-gradient-to-r from-transparent via-blue-400/30 to-transparent w-64 h-[1px] animate-border-beam"
                  style={{
                    offsetPath: 'rect(0 0 100% 100% round 2.5rem)',
                    offsetRotate: 'auto',
                  }}
                />
              </div>

              {/* Glow dinâmico interno */}
              <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

              {/* Badge crítico flutuante */}
              {metrics.progress < 40 && metrics.gap > 0 && (
                <div className="absolute top-5 right-5 z-20 bg-red-500/10 backdrop-blur-xl border border-red-400/30 text-red-500 px-4 py-2 rounded-full text-[10px] font-black tracking-widest animate-pulse">
                  🔥 CRÍTICO
                </div>
              )}

              {/* Trophy decorativo */}
              <div className="absolute top-0 right-0 p-8 opacity-[0.06] pointer-events-none">
                <Trophy className="w-32 h-32 text-primary" />
              </div>

              <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 relative z-10">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="bg-primary/15 backdrop-blur-sm text-primary text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border border-primary/25">
                      Meta do Mês
                    </span>
                  </div>
                  
                  <h2 className="text-4xl font-manrope font-black text-on-surface mb-2 tracking-tighter">
                    {metrics.totalForecast === 0 && (!targetGoal || targetGoal.amount === 0)
                      ? 'Inicie sua Jornada Elite 🚀'
                      : metrics.gap <= 0 
                        ? 'Meta Atingida! 🎯' 
                        : metrics.isMetaImpossible 
                          ? 'Pipeline Insuficiente ⚠️' 
                          : 'Rumo ao Objetivo'}
                  </h2>
                  <p className="text-slate-600 font-bold mb-8 max-w-md">
                    {metrics.totalForecast === 0 && (!targetGoal || targetGoal.amount === 0)
                      ? 'Seu pipeline está pronto. Comece a converter seus leads do WhatsApp em negócios para ver suas projeções de fechamento.'
                      : metrics.gap <= 0 
                        ? 'Parabéns! O forecast superou a meta estabelecida. Continue acelerando para um fechamento recorde.' 
                        : metrics.isMetaImpossible
                          ? `A meta de ${formatCurrency(metrics.metaValue)} não pode ser atingida com o pipeline atual. Mesmo fechando 100% dos negócios existentes, faltam ${formatCurrency(Math.round(metrics.missingPipeline))} em novas oportunidades.`
                          : `Se não houver avanço imediato, a meta não será atingida. Você está a ${formatCurrency(metrics.gap)} de distância do objetivo.`}
                  </p>
                  
                  <div className="flex flex-wrap gap-10">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Forecast Atual</p>
                      <p className="text-2xl font-manrope font-black text-primary">{formatCurrency(metrics.totalForecast)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Janela de Tempo</p>
                      <p className="text-2xl font-manrope font-black text-on-surface">Restam {metrics.daysRemaining} dias</p>
                    </div>
                    {metrics.gap > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-error uppercase tracking-widest mb-1">Ritmo Necessário</p>
                        <p className="text-2xl font-manrope font-black text-error">{formatCurrency(metrics.dailyVelocity)} / dia</p>
                      </div>
                    )}
                  </div>

                  {metrics.isMetaImpossible && (
                    <div className="mt-6 p-5 rounded-2xl bg-red-500/10 backdrop-blur-xl border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-in fade-in slide-in-from-top-2 duration-500 animate-[pulse_2.5s_ease-in-out_infinite]">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
                        <p className="text-[10px] font-black text-error uppercase tracking-[0.2em]">Pipeline Insuficiente</p>
                      </div>
                      <p className="text-sm font-bold text-slate-700 leading-relaxed">
                        Mesmo fechando 100% dos negócios atuais, a meta de <span className="font-black text-on-surface">{formatCurrency(metrics.metaValue)}</span> não será alcançada.
                      </p>
                      <p className="text-sm font-black text-error mt-2 mb-1">
                        + {formatCurrency(Math.round(metrics.missingPipeline))} necessários em pipeline
                      </p>
                      <p className="text-[12px] font-black text-white uppercase tracking-[0.2em] bg-red-500 px-6 py-3 rounded-2xl inline-block mt-4 shadow-xl shadow-red-500/20 border border-red-400/30">
                        🎯 SEU FOCO HOJE DEVE SER GERAR NOVAS OPORTUNIDADES
                      </p>
                    </div>
                  )}

                  {recoveryPlan && (
                    <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-amber-100/80 to-white/60 backdrop-blur-xl border border-amber-300/40 shadow-[0_10px_30px_rgba(251,191,36,0.2)] animate-in fade-in slide-in-from-bottom-2 duration-700 delay-150 transition-all hover:shadow-[0_16px_40px_rgba(251,191,36,0.28)] hover:scale-[1.01]">
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-3">🧠 Plano de Recuperação</p>
                      <div className="flex flex-col gap-2.5 text-sm font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          <span>Gerar <span className="font-black text-on-surface">{formatCurrency(Math.round(recoveryPlan.pipeline))}</span> em pipeline novo</span>
                        </div>
                        {recoveryPlan.deals > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                            <span>Fechar <span className="font-black text-on-surface">{recoveryPlan.deals}</span> deals <span className="text-primary font-black">({formatCurrency(Math.round(recoveryPlan.ticket))} médio)</span></span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          <span>Aumentar conversão <span className="text-error font-black">{(recoveryPlan.conversionNow * 100).toFixed(0)}%</span> → <span className="text-emerald-600 font-black">{(recoveryPlan.conversionTarget * 100).toFixed(0)}%</span></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-6 w-full md:w-2/5">
                  <div className="bg-white/60 p-6 rounded-3xl border border-white shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em]">Progresso do Forecast</p>
                      <span className="text-xs font-black text-primary uppercase">{metrics.progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className="h-full bg-primary transition-all duration-1000 ease-out" 
                        style={{ width: `${Math.min(100, metrics.progress)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${metrics.progress < 40 ? 'text-error' : 'text-slate-400'}`}>
                        Cobertura do pipeline
                      </span>
                      <span className={`text-xs font-black uppercase ${metrics.progress < 40 ? 'text-error' : 'text-primary'}`}>
                        {(metrics.coverage ?? metrics.progress).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-7 rounded-[2.5rem] shadow-xl shadow-primary/10 border border-slate-100 flex flex-col group/plan hover:border-primary/30 transition-all duration-500">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Plano de Fechamento</p>
                    {metrics.gap <= 0 ? (
                      <p className="text-sm font-manrope font-black text-emerald-600">Meta atingida. Continue acelerando 🚀</p>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <p className={`text-[11px] font-bold mb-1 ${metrics.isUnrealistic ? 'text-error' : 'text-slate-500'}`}>
                            {metrics.isUnrealistic 
                              ? 'Pipeline insuficiente para atingir a meta. Foque nos principais deals:' 
                              : 'Para zerar o gap, feche:'}
                          </p>
                          {metrics.topDealsToClose.slice(0, 2).map((deal, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${metrics.isUnrealistic ? 'bg-error/40' : 'bg-primary/40'}`}></div>
                              <p className="text-sm font-manrope font-black text-on-surface">
                                {formatCurrency(Math.round(deal.forecast))} <span className="text-slate-400 font-bold">({deal.score}%)</span>
                              </p>
                            </div>
                          ))}
                          {metrics.topDealsToClose.length > 2 && (
                            <p className="text-[10px] font-bold text-slate-400 pl-3.5">+ {metrics.topDealsToClose.length - 2} outros negócios estratégicos</p>
                          )}
                        </div>
                        <button 
                          onClick={() => setPlanModalOpen(true)}
                          className="mt-2 w-full bg-primary-fixed text-on-primary-fixed hover:bg-primary hover:text-white p-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          Abrir plano de fechamento
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <AIOnboardingRoadmap />

          <section className="mt-8">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-3xl font-manrope font-black text-on-surface tracking-tight">Vendas Guiadas por IA</h2>
              <span className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border border-primary/20">
                Decision Engine Pro
              </span>
            </div>

            <div className="w-full">
              <ActionableDeals 
                onOpenDeal={handleOpenDeal} 
                isPipelineInsufficient={metrics.isUnrealistic || metrics.isMetaImpossible}
              />
            </div>
          </section>
        </div>

        <div className="col-span-12 xl:col-span-4 flex flex-col gap-8 relative z-20">
          {/* 🔥 FILA DE PRIORIDADE (Ação Imediata) */}
          <PriorityQueue deals={deals} onOpenDeal={handleOpenDeal} />

          {/* 🧠 PLAYBOOK INSIGHTS (O que funciona?) */}
          <PlaybookInsights />

          {/* Central de Performance e Saúde da IA */}
          <IAPerformance />

          {/* O Oráculo (Insight Ativo) */}
          <OracleInsight 
            dealId={stratAnalysis.hot?.id}
            dealTitle={stratAnalysis.hot?.title}
            messageId={stratAnalysis.hot?.lastAIMessageId}
            dealInsight={stratAnalysis.hot?.lastAIInsight}
            onAction={(action) => handleOpenDeal(stratAnalysis.hot?.id)} 
            onCopy={(msg) => navigator.clipboard.writeText(msg)}
          />
        </div>
      </div>

      {/* Closing Plan Modal (Slide-over/Modal) */}
      {planModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-primary/5">
              <div>
                <h3 className="text-2xl font-manrope font-black text-on-surface tracking-tight">Plano de Fechamento</h3>
                <p className={`text-sm font-bold ${metrics.isUnrealistic ? 'text-error' : 'text-slate-500'}`}>
                  {metrics.isUnrealistic 
                    ? 'Alerta: Pipeline insuficiente para a meta. Priorize estes deals:' 
                    : 'Negócios decisivos para bater a meta'}
                </p>
              </div>
              <button onClick={() => setPlanModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="p-8 max-h-[60vh] overflow-y-auto flex flex-col gap-4">
              {metrics.topDealsToClose.map((deal) => (
                <div 
                  key={deal.id} 
                  onClick={() => handleOpenDeal(deal.id)}
                  className="p-6 rounded-[2rem] border border-slate-100 bg-white/50 backdrop-blur-sm hover:border-primary/20 hover:bg-white hover:shadow-xl hover:shadow-primary/5 transition-all flex items-center justify-between group cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                       <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                       <p className="text-sm font-manrope font-black text-on-surface group-hover:text-primary transition-colors">
                         {deal.title}
                       </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{deal.company || 'Oportunidade'}</p>
                      <div className="flex items-center gap-1.5 bg-primary/5 px-3 py-1 rounded-full">
                        <span className="text-[9px] font-black text-primary uppercase tracking-wider">{deal.score}% Score</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-lg font-manrope font-black text-on-surface leading-none tracking-tighter">
                        {formatCurrency(deal.value || 0)}
                      </p>
                    </div>
                    
                    <Avatar 
                      src={deal.ownerAvatar || null} 
                      name={deal.ownerName || 'Staff'} 
                      size="sm" 
                      className="w-9 h-9 border-white shadow-lg ring-1 ring-black/5"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex flex-col">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Combinado</p>
                <p className="text-xl font-manrope font-black text-on-surface">{formatCurrency(metrics.topDealsToClose.reduce((acc, d) => acc + d.forecast, 0))}</p>
              </div>
              <button onClick={() => setPlanModalOpen(false)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                Fechar Plano
              </button>
            </div>
          </div>
        </div>
      )}

      <DealDetailsModal 
        isOpen={detailsModalOpen} 
        onClose={() => {
          setDetailsModalOpen(false);
          setViewingDeal(null);
        }} 
        deal={viewingDeal}
        onUpdate={refetch}
      />
    </div>
  );
}

const FollowUpItem = ({ name, role, time, status, statusColor, avatar }) => (
  <div className="grid grid-cols-12 gap-4 p-3.5 hover:bg-white transition-all rounded-2xl items-center cursor-pointer group border border-transparent hover:border-slate-100 hover:shadow-sm">
    <div className="col-span-1">
      <img alt={name} className="w-11 h-11 rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-105" src={avatar} />
    </div>
    <div className="col-span-4 pl-2">
      <div className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors leading-tight">{name}</div>
      <div className="text-[11px] text-on-surface-variant opacity-60 leading-tight">{role}</div>
    </div>
    <div className="col-span-4">
      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">{time}</div>
      <div className={`text-[11px] ${statusColor} font-bold`}>{status}</div>
    </div>
    <div className="col-span-3 text-right">
      <button className="bg-primary-fixed text-on-primary-fixed px-5 py-2.5 rounded-full text-[11px] font-extrabold hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95">
        Executar
      </button>
    </div>
  </div>
);
