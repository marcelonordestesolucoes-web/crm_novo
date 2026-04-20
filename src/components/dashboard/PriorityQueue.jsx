import React from 'react';
import { Card, Badge, Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/constants/config';
import { Flame, AlertTriangle, ArrowRight, Zap, Clock } from 'lucide-react';

export const PriorityQueue = ({ deals, onOpenDeal }) => {
  // 🧠 Lógica de Cálculo Dinâmico v4.1 (Recência + Prioridade)
  const prioritizedDeals = React.useMemo(() => {
    if (!deals) return [];

    // 1. Achar o Teto da Organização para Normalização (Capped at 100k)
    const orgMax = deals.reduce((max, d) => Math.max(max, d.value || 0), 10000);
    const cappedMax = Math.min(orgMax, 100000);

    return deals
      .filter(d => d.status === 'open' || d.status === 'new')
      .map(deal => {
        // A. Cálculo de Recência Decorrente (15pts/dia)
        const lastDate = new Date(deal.last_interaction_at || deal.createdAt);
        const diffTime = Math.abs(new Date() - lastDate);
        const daysSince = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const recencyScore = Math.max(0, 100 - (daysSince * 15));

        // B. Normalização do Valor (0-100)
        const normalizedValue = Math.min(((deal.value || 0) / cappedMax) * 100, 100);

        // C. Fórmula Mestra v4.1
        const prob = deal.ai_closing_probability || 0;
        const score = (prob * 0.5) + (normalizedValue * 0.3) + (recencyScore * 0.2);

        return {
          ...deal,
          liveScore: Math.round(score),
          recencyScore,
          daysSince
        };
      })
      .sort((a, b) => b.liveScore - a.liveScore)
      .slice(0, 5);
  }, [deals]);

  if (!prioritizedDeals.length) return null;

  return (
    <Card variant="crystal" className="p-8 border-white/20 shadow-2xl relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-10 -mt-10" />
      
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Zap className="w-5 h-5 text-primary fill-primary" />
          </div>
          <div>
            <h3 className="text-lg font-manrope font-black text-on-surface tracking-tight">Fila de Prioridade</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Oracle v4.1 • Engine de Decisão</p>
          </div>
        </div>
        <Badge label="Elite Strategy" className="bg-primary/5 text-primary border-primary/10" />
      </div>

      <div className="flex flex-col gap-4">
        {prioritizedDeals.map((deal, idx) => (
          <div 
            key={deal.id}
            onClick={() => onOpenDeal(deal.id)}
            className="relative group/item cursor-pointer p-4 rounded-3xl border border-transparent hover:border-white/40 hover:bg-white/40 hover:shadow-xl transition-all duration-300"
          >
            {/* Index Badge */}
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center z-10">
              <span className="text-[10px] font-black text-slate-400">#{idx + 1}</span>
            </div>

            <div className="flex items-center justify-between pl-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-manrope font-black text-sm text-on-surface truncate group-hover/item:text-primary transition-colors">
                    {deal.title}
                  </h4>
                  {deal.ai_temperature === 'hot' && <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500 animate-pulse" />}
                  {deal.ai_temperature === 'risk' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">
                    {deal.company}
                  </p>
                  <div className="w-1 h-1 rounded-full bg-slate-200" />
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <Clock className="w-3 h-3" />
                    {deal.daysSince === 0 ? 'Hoje' : `${deal.daysSince}d atrás`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 text-right">
                <div className="flex flex-col items-end">
                   <div className="text-xl font-manrope font-black text-primary leading-none mb-1">
                     {deal.liveScore}
                     <span className="text-[10px] font-black ml-0.5 opacity-40 italic">pts</span>
                   </div>
                   <div className="flex items-center gap-1.5 ring-1 ring-slate-100 px-2 py-0.5 rounded-full">
                     <div className={cn(
                       "w-1.5 h-1.5 rounded-full",
                       deal.ai_temperature === 'hot' ? 'bg-emerald-500' : 
                       deal.ai_temperature === 'risk' ? 'bg-red-500' : 'bg-blue-400'
                     )} />
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                       {deal.ai_closing_probability}% Prob.
                     </span>
                   </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary opacity-0 group-hover/item:opacity-100 transition-all group-hover/item:translate-x-1">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 rounded-2xl bg-slate-50 border border-slate-100">
        <p className="text-[9px] font-bold text-slate-500 leading-tight">
          💡 A prioridade é recalculada com base no valor do negócio, probabilidade de fechamento da IA e o tempo desde a última interação estratégica.
        </p>
      </div>
    </Card>
  );
};
