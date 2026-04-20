import React from 'react';
import { motion } from 'framer-motion';
import { Card, LoadingSpinner, Badge, Avatar } from '@/components/ui';
import { useSupabase } from '@/hooks/useSupabase';
import { getAIUsageMetrics, getAIUsageHistory, getAIValidationMetrics } from '@/services/organizations';
import { Sparkles, ShieldCheck, Zap, History, Calendar, ThumbsUp, MousePointer2, TrendingUp, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/constants/config';
import { cn } from '@/lib/utils';

/**
 * AI ANALYTICS VIEW (Fase 5 Elite)
 * Dashboard de validação de valor que prova o ROI da IA.
 */
export const AIAnalyticsView = () => {
  const { data: usage, loading: loadingUsage } = useSupabase(getAIUsageMetrics);
  const { data: history, loading: loadingHistory } = useSupabase(getAIUsageHistory);
  const { data: validation, loading: loadingValidation } = useSupabase(getAIValidationMetrics);

  if (loadingUsage || loadingHistory || loadingValidation) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
             <h3 className="text-2xl font-manrope font-black text-on-surface tracking-tight">Revenue Intelligence Analytics</h3>
             <p className="text-sm text-slate-400 font-medium">Métricas de impacto real e aprendizado do motor Oracle.</p>
          </div>
        </div>
        <Badge variant="glass" className="px-6 py-2 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 uppercase font-black tracking-widest text-[10px]">
            IA Operando com 98% de Confiança
        </Badge>
      </div>

      {/* TOP ROW: ROI & Validation */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard 
            title="Receita Influenciada" 
            value={formatCurrency(validation?.total_value_delta || 0)} 
            subtitle={`${validation?.total_upsells || 0} upsells detectados`}
            icon={DollarSign} 
            color="text-emerald-500"
        />
        <StatCard 
            title="Taxa de Utilidade" 
            value={`${(validation?.utility_rate || 0).toFixed(0)}%`} 
            subtitle="Baseado em feedback positivo" 
            icon={ThumbsUp} 
            color="text-primary"
        />
        <StatCard 
            title="Adesão (Click Rate)" 
            value={`${(validation?.click_rate || 0).toFixed(0)}%`} 
            subtitle="Cliques vs. Insights vistos" 
            icon={MousePointer2} 
            color="text-sky-500"
        />
        <StatCard 
            title="Ruído Filtrado" 
            value={usage?.ai_saved_by_filter || 0} 
            subtitle="Economia de custo e tempo" 
            icon={ShieldCheck} 
            color="text-slate-500"
        />
      </div>

      <div className="grid grid-cols-12 gap-8">
          {/* Performance por Vendedor */}
          <div className="col-span-12 lg:col-span-7">
            <Card variant="glass" className="p-0 overflow-hidden border-slate-100 h-full">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Performance por Vendedor (Impacto IA)</h4>
                    <Badge variant="outline" className="text-[9px] font-black tracking-tighter">Ranking Mensal</Badge>
                </div>
                <div className="p-4">
                    {validation?.seller_stats?.length > 0 ? (
                        <div className="space-y-2">
                            {validation.seller_stats.map((seller, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 hover:bg-white/60 rounded-2xl transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-6 h-6 flex items-center justify-center font-black text-xs text-slate-300">
                                            {idx + 1}
                                        </div>
                                        <Avatar name={seller.email} size="sm" className="w-8 h-8" />
                                        <div>
                                            <p className="text-xs font-black text-on-surface">{seller.email.split('@')[0]}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{seller.views} insights vistos</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="text-center">
                                            <p className="text-xs font-black text-primary">{seller.clicks}</p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase">Ações</p>
                                        </div>
                                        <div className="text-right min-w-[80px]">
                                            <p className={cn("text-xs font-black", seller.revenue_contribution > 0 ? "text-emerald-600" : "text-slate-400")}>
                                                {seller.revenue_contribution > 0 ? formatCurrency(seller.revenue_contribution) : '--'}
                                            </p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase">Upsell</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center opacity-40 font-bold text-sm italic">Nenhuma interação registrada ainda.</div>
                    )}
                </div>
            </Card>
          </div>

          {/* Histórico Diário */}
          <div className="col-span-12 lg:col-span-5">
            <Card variant="glass" className="p-0 border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Histórico de Consumo</h4>
                </div>
                <div className="p-4 max-h-[500px] overflow-y-auto">
                    {history?.length > 0 ? (
                        <div className="space-y-1">
                            {history.slice().reverse().map((day) => (
                                <div key={day.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 rounded-xl transition-all">
                                    <p className="text-[11px] font-bold text-slate-600">{new Date(day.usage_date).toLocaleDateString()}</p>
                                    <div className="flex items-center gap-4">
                                        <p className="text-xs font-black text-on-surface">{day.calls_count} análises</p>
                                        <p className="text-xs font-black text-emerald-600">+{day.noise_filtered_count} filtros</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center opacity-40 italic font-bold">Sem histórico disponível.</div>
                    )}
                </div>
            </Card>
          </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, subtitle, icon: Icon, color }) => (
    <Card className="p-8 border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
        <div className={cn("w-12 h-12 rounded-2xl bg-opacity-10 mb-6 flex items-center justify-center", color.replace('text-', 'bg-'), color)}>
            <Icon className="w-6 h-6" />
        </div>
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
        <p className="text-3xl font-manrope font-black text-on-surface mb-2">{value}</p>
        <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
    </Card>
);
