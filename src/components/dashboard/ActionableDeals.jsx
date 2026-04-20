import React from 'react';
import { motion } from 'framer-motion';
import { Card, LoadingSpinner, Avatar, Badge, Button } from '@/components/ui';
import { useSupabase } from '@/hooks/useSupabase';
import { getDeals } from '@/services/deals';
import { getImpactTheme } from '@/utils/aiMappers';
import { formatCurrency } from '@/constants/config';
import { AlertCircle, Flame, ArrowRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ActionableDeals = ({ onOpenDeal, isPipelineInsufficient }) => {
  const { data: deals, loading } = useSupabase(getDeals);

  const actionable = React.useMemo(() => {
    if (!deals) return { risks: [], hot: [] };

    const sorted = [...deals]
      .filter(d => d.status === 'open')
      .map(d => {
        const impact = d.lastAIInsight?.deal_impact || 0;
        return { ...d, impact };
      })
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    return {
      risks: sorted.filter(d => d.impact <= -0.15).slice(0, 3),
      hot: sorted.filter(d => d.impact >= 0.3).slice(0, 3)
    };
  }, [deals]);

  if (loading) return <div className="h-64 flex items-center justify-center"><LoadingSpinner size="sm" /></div>;

  const totalActionable = actionable.risks.length + actionable.hot.length;

  return (
    <Card variant="glass" className="p-8 flex flex-col h-full relative overflow-hidden group/actionable">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-xl font-manrope font-black text-on-surface tracking-tight">Deals que precisam de você</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">Foco imediato baseado em sinais de IA</p>
        </div>
        <div className="flex gap-2">
            {actionable.risks.length > 0 && (
                <Badge variant="error" className="rounded-lg px-2 py-0.5 text-[9px] font-black">
                    {actionable.risks.length} RISCOS
                </Badge>
            )}
            {actionable.hot.length > 0 && (
                <Badge className="bg-emerald-100 text-emerald-600 rounded-lg px-2 py-0.5 text-[9px] font-black">
                    {actionable.hot.length} HOT
                </Badge>
            )}
        </div>
      </div>

      <div className="space-y-6 flex-1">
        {totalActionable === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 min-h-[300px]">
            {isPipelineInsufficient ? (
              // ESTADO: Monitoramento Ativo (Verdadeiro para Pipeline Insuficiente)
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-3 px-8 py-5 bg-amber-500 border-4 border-white rounded-[2rem] mb-6 shadow-2xl shadow-amber-200 group-hover/actionable:scale-105 transition-all">
                    <div className="relative">
                        <div className="w-3.5 h-3.5 rounded-full bg-white" />
                        <div className="absolute inset-0 w-3.5 h-3.5 rounded-full bg-white animate-ping opacity-60" />
                    </div>
                    <span className="text-sm font-manrope font-black text-white uppercase tracking-widest">Monitoramento Ativo</span>
                </div>
                <div className="text-center">
                    <p className="text-lg font-manrope font-black text-slate-700 tracking-tight mb-1">Sem alertas críticos no momento 🎯</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[280px] mx-auto leading-relaxed">
                        A IA não detectou riscos imediatos, mas seu pipeline atual é insuficiente. <span className="text-amber-600">Foque em prospectar.</span>
                    </p>
                </div>
              </div>
            ) : (
              // ESTADO: Pipeline Saudável (Verdadeiro apenas quando meta está ok)
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-3 px-8 py-5 bg-emerald-500 border-4 border-white rounded-[2rem] mb-6 shadow-2xl shadow-emerald-200 group-hover/actionable:scale-105 transition-all">
                    <div className="relative">
                        <div className="w-3.5 h-3.5 rounded-full bg-white" />
                        <div className="absolute inset-0 w-3.5 h-3.5 rounded-full bg-white animate-ping opacity-60" />
                    </div>
                    <span className="text-sm font-manrope font-black text-white uppercase tracking-widest">Pipeline Saudável</span>
                </div>
                <div className="text-center">
                    <p className="text-lg font-manrope font-black text-slate-700 tracking-tight mb-1">Cérebro Oracle em Espera 🧠</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[280px] mx-auto leading-relaxed">
                        Seus contatos foram mapeados, mas a IA ainda não analisou as conversas. <span className="text-primary cursor-pointer hover:underline">Ative a Inteligência</span> para gerar sinais.
                    </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Risks Section */}
            {actionable.risks.map((deal) => (
              <DealActionRow 
                key={deal.id} 
                deal={deal} 
                type="risk" 
                onClick={() => onOpenDeal(deal.id)} 
              />
            ))}
            
            {/* Hot Section */}
            {actionable.hot.map((deal) => (
              <DealActionRow 
                key={deal.id} 
                deal={deal} 
                type="hot" 
                onClick={() => onOpenDeal(deal.id)} 
              />
            ))}
          </>
        )}
      </div>

      <Button 
        variant="outline" 
        className="w-full mt-10 rounded-2xl text-[10px] font-black uppercase tracking-widest py-6"
        onClick={() => {}} // Ver todos ficaria aqui
      >
        Ver Todos os Sinais
      </Button>
    </Card>
  );
};

const DealActionRow = ({ deal, type, onClick }) => {
  const theme = getImpactTheme(deal.impact);

  return (
    <motion.div 
      onClick={onClick}
      whileHover={{ x: 4 }}
      className="flex items-center gap-4 p-4 rounded-3xl bg-white/40 border border-white/60 hover:bg-white hover:shadow-xl transition-all cursor-pointer group"
    >
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white", theme.bg, theme.color)}>
        {type === 'risk' ? <AlertCircle className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <p className="text-sm font-manrope font-black text-on-surface truncate pr-2">{deal.title}</p>
          <span className={cn("text-[9px] font-black uppercase tracking-widest whitespace-nowrap", theme.color)}>
            {deal.impact > 0 ? '+' : ''}{(deal.impact * 100).toFixed(0)}%
          </span>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
          {deal.company} • {formatCurrency(deal.value)}
        </p>
      </div>

      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="w-4 h-4 text-primary" />
      </div>
    </motion.div>
  );
};
