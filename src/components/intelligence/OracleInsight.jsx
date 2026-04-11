import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, LoadingSpinner } from '@/components/ui';
import { useSupabase } from '@/hooks/useSupabase';
import { getDeals } from '@/services/deals';
import { calculateDealRisk } from '@/utils/dealRisk';

export const OracleInsight = ({ onOpenDeal }) => {
  const { data: deals, loading } = useSupabase(getDeals);

  // Analyze deals for risks and insights
  const analysis = React.useMemo(() => {
    if (!deals || deals.length === 0) return null;

    const riskAnalytics = deals.map(deal => ({
      ...deal,
      riskData: calculateDealRisk(deal.qualification)
    }));

    const highRiskDeals = riskAnalytics.filter(d => d.riskData?.risk === 'high');
    const mediumRiskDeals = riskAnalytics.filter(d => d.riskData?.risk === 'medium');

    // Select top 3 critical actions with priority: High -> Medium -> Low
    const recommendations = [];
    
    // 1. High Risk Deals
    highRiskDeals.sort((a, b) => (b.value || 0) - (a.value || 0)).forEach(deal => {
      recommendations.push({
        id: deal.id,
        action: `Revisar proposta da ${deal.company}`,
        reason: "Negócio em alto risco (Checklist crítico)",
        type: 'high',
        icon: 'warning',
        color: 'text-error',
        bg: 'bg-error/10'
      });
    });

    // 2. Medium Risk Deals
    mediumRiskDeals.sort((a, b) => (b.value || 0) - (a.value || 0)).forEach(deal => {
      recommendations.push({
        id: deal.id,
        action: `Follow-up com ${deal.company}`,
        reason: "Qualificação parcial detectada",
        type: 'medium',
        icon: 'bolt',
        color: 'text-amber-500',
        bg: 'bg-amber-500/10'
      });
    });

    // 3. Low Risk / General Deals (only if we need more)
    if (recommendations.length < 3) {
      riskAnalytics
        .filter(d => !d.riskData || d.riskData.risk === 'low')
        .slice(0, 3 - recommendations.length)
        .forEach(deal => {
          recommendations.push({
            id: deal.id,
            action: `Acelerar fechamento: ${deal.company}`,
            reason: "Alta probabilidade de conversão",
            type: 'low',
            icon: 'verified',
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10'
          });
        });
    }

    return {
      highRiskCount: highRiskDeals.length,
      recommendations: recommendations.slice(0, 3),
      totalValueAtRisk: highRiskDeals.reduce((sum, d) => sum + (d.value || 0), 0)
    };
  }, [deals]);

  if (loading) return (
    <aside className="space-y-6">
      <div className="bg-navy rounded-[2.5rem] p-10 shadow-xl shadow-navy/20 flex items-center justify-center h-[400px]">
        <LoadingSpinner color="white" />
      </div>
    </aside>
  );

  const hasData = analysis && deals?.length > 0;

  return (
    <aside className="space-y-6">
      <div className="bg-navy rounded-[2.5rem] p-10 shadow-xl shadow-navy/20 flex flex-col h-full relative overflow-hidden group min-h-[520px]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
        
        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white border border-white/10 shadow-sm">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
          </div>
          <div>
            <h2 className="font-manrope font-black text-[10px] text-slate-400 tracking-widest uppercase opacity-60">Arquiteto Pessoal</h2>
            <p className="font-manrope font-black text-white text-lg tracking-tight">AI Assistant</p>
          </div>
        </div>

        <p className="text-white font-manrope font-bold text-xl leading-snug mb-10 relative z-10 tracking-tight">
          {hasData ? (
            analysis.highRiskCount > 0 
              ? `Atenção: Identifiquei ${analysis.highRiskCount} negócios em alto risco. Priorize as ações abaixo para evitar perdas.`
              : `Seu pipeline está com ótima saúde! Aqui estão os próximos passos para maximizar o fechamento.`
          ) : (
            "Comece a qualificar seus negócios no pipeline para receber insights estratégicos de execução."
          )}
        </p>

        <div className="mt-auto relative z-10">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 block opacity-60">
            AÇÕES RECOMENDADAS
          </span>
          <div className="space-y-3">
            {hasData && analysis.recommendations.length > 0 ? (
              analysis.recommendations.map((item, idx) => (
                <div key={idx} className="w-full bg-white/5 p-4 pl-6 rounded-[24px] border border-white/5 flex items-start gap-4 group/btn relative overflow-hidden">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/10 mt-1", item.bg)}>
                    <span className={cn("material-symbols-outlined text-[20px]", item.color)}>{item.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.action}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 opacity-60">{item.reason}</p>
                    {onOpenDeal && (
                      <button 
                        onClick={() => onOpenDeal(item.id)}
                        className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-primary-fixed hover:text-white transition-colors flex items-center gap-2 group/link"
                      >
                        Abrir negociação
                        <span className="material-symbols-outlined text-xs group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-4 text-xs font-bold text-slate-500 italic opacity-60">
                Aguardando mais dados para gerar recomendações táticas.
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Priorities of the Day - Glassified */}
      <Card variant="glass" className="p-10">
        <div className="flex items-center gap-3 mb-8">
          <span className="material-symbols-outlined text-primary text-[24px] font-black">task_alt</span>
          <h3 className="font-manrope font-black text-xl text-on-surface tracking-tight">Prioridades de Hoje</h3>
        </div>
        <ul className="space-y-4">
          <li className="flex items-start gap-4 p-5 rounded-[24px] bg-white/40 border border-white/40 hover:bg-white/60 hover:border-white transition-all cursor-pointer group shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-110 shadow-sm border border-primary/5">
              <span className="material-symbols-outlined text-[20px] font-black">groups</span>
            </div>
            <div>
              <p className="text-sm font-black text-on-surface font-manrope tracking-tight group-hover:text-primary transition-colors">Revisão de Qualificação</p>
              <p className="text-[11px] text-slate-500 mt-1 font-bold uppercase tracking-widest opacity-60">Focar nos deals High Risk</p>
            </div>
          </li>
          <li className="flex items-start gap-4 p-5 rounded-[24px] bg-white/40 border border-white/40 hover:bg-white/60 hover:border-white transition-all cursor-pointer group shadow-sm opacity-70 hover:opacity-100">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 transition-transform group-hover:scale-110 shadow-sm">
              <span className="material-symbols-outlined text-[20px] font-black">mail</span>
            </div>
            <div>
              <p className="text-sm font-black text-on-surface font-manrope tracking-tight group-hover:text-primary transition-colors">Follow-up Automático</p>
              <p className="text-[11px] text-slate-500 mt-1 font-bold uppercase tracking-widest opacity-60">Disparar para 5 contatos</p>
            </div>
          </li>
        </ul>
      </Card>
    </aside>
  );
};


