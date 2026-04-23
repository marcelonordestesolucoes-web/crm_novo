import React, { useState } from 'react';
import { BarChart3, TrendingUp, ArrowUpRight, Target, Zap } from 'lucide-react';
import { Card, PageHeader, LoadingSpinner, ErrorMessage } from '@/components/ui';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useSupabase } from '@/hooks/useSupabase';
import { getPipelineAnalytics } from '@/services/analytics';
import { formatCurrency, PIPELINE_STAGES } from '@/constants/config';

// Config driven — para adicionar/remover um KPI, edite apenas este array.
const KPI_ITEMS = [
  { label: 'Crescimento de Receita', value: '+24.8%', icon: TrendingUp, colorText: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Ticket Médio',           value: 'R$ 84.5k', icon: Target,     colorText: 'text-primary',    bg: 'bg-primary-fixed' },
  { label: 'Velocidade de Vendas',   value: '18 dias', icon: Zap,         colorText: 'text-amber-600',  bg: 'bg-amber-50' },
  { label: 'Taxa de Conversão',      value: '42%',     icon: ArrowUpRight, colorText: 'text-tertiary',  bg: 'bg-tertiary-fixed' },
];

const PERIODS = ['Últimos 30 Dias', 'Trimestral', 'Anual'];

const INSIGHTS = [
  {
    color: 'bg-emerald-500',
    id: 'growth',
    title: 'Performance do Pipeline',
    desc: 'Monitoramento em tempo real da saúde financeira e conversão de negócios.',
  },
  {
    color: 'bg-primary',
    id: 'ticket',
    title: 'Estratégia de Ticket Médio',
    desc: 'A análise de fechamendo ajuda a identificar o valor ideal das suas propostas.',
  },
];

const BAR_HEIGHTS = [40, 65, 52, 88, 70, 82, 95];

export default function Analytics() {
  const [activePeriod, setActivePeriod] = useState(0);
  const { data, loading, error, refetch } = useSupabase(getPipelineAnalytics);

  // Mapeia KPIs dinâmicos
  const kpis = [
    { 
      label: 'Valor Total Pipeline', 
      value: formatCurrency(data?.totalValue || 0), 
      icon: TrendingUp, 
      colorText: 'text-primary', 
      bg: 'bg-primary-fixed' 
    },
    { 
      label: 'Ticket Médio (Ganho)', 
      value: formatCurrency(data?.ticketMedio || 0), 
      icon: Target, 
      colorText: 'text-violet-600', 
      bg: 'bg-violet-50' 
    },
    { 
      label: 'Total de Oportunidades', 
      value: data?.count || 0, 
      icon: Zap, 
      colorText: 'text-amber-600', 
      bg: 'bg-amber-50' 
    },
    { 
      label: 'Taxa de Conversão', 
      value: `${(data?.conversionRate || 0).toFixed(1)}%`, 
      icon: ArrowUpRight, 
      colorText: 'text-emerald-600', 
      bg: 'bg-emerald-50' 
    },
  ];

  // Prepara dados do gráfico com base nos estágios reais
  const chartBars = PIPELINE_STAGES.map(stage => {
    const stageVal = data?.stageDistribution?.[stage.id] || 0;
    const maxVal = data?.totalValue || 1;
    return (stageVal / maxVal) * 100;
  });

  return (
    <div className="animate-in fade-in duration-700 max-w-7xl mx-auto w-full relative -mt-10 z-10">
      {/* Aurora Spotlight — Profundidade no Analytics */}
      <div className="absolute -top-24 left-1/4 w-[900px] h-[450px] bg-indigo-400/[0.06] blur-[130px] rounded-full pointer-events-none -z-10" />

      <PageHeader
        title="Analytics Inteligente"
        subtitle="Métricas reais extraídas diretamente do seu banco de dados Supabase."
        actions={
            <div className="flex bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(196,250,255,0.48),rgba(250,230,255,0.34))] backdrop-blur-2xl p-2 rounded-[1.5rem] border border-white/60 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5">
            {PERIODS.map((p, i) => (
              <button
                key={p}
                onClick={() => setActivePeriod(i)}
                className={cn(
                  'px-6 py-2.5 rounded-xl text-sm font-black font-manrope transition-all tracking-widest uppercase',
                  i === activePeriod
                    ? 'bg-white text-primary shadow-lg shadow-primary/10'
                    : 'text-slate-700 hover:text-on-surface'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        }
      />

      {loading && <LoadingSpinner message="Calculando métricas..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            {kpis.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <Card variant="glass" key={i} className="p-8 group cursor-default relative overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_40px_80px_rgba(0,0,0,0.08)] ring-1 ring-blue-500/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm relative z-10', kpi.bg, kpi.colorText)}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <p className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2 relative z-10">{kpi.label}</p>
                  <h3 className="text-3xl font-manrope font-black text-on-surface tracking-tighter relative z-10">{kpi.value}</h3>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card variant="glass" className="p-10 min-h-[480px] flex flex-col items-center justify-center text-center group cursor-default relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
              <div className="w-24 h-24 bg-white/60 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-all shadow-sm border border-white">
                <BarChart3 className="w-10 h-10 text-primary opacity-40 group-hover:opacity-100 transition-all" />
              </div>
              <h4 className="font-manrope font-black text-2xl text-on-surface mb-3 tracking-tight">Distribuição por Estágio</h4>
              <p className="text-slate-700 text-base max-w-sm font-manrope font-bold leading-relaxed mb-12">
                Volume financeiro distribuído ao longo do seu funil de vendas.
              </p>
              <div className="w-full h-56 rounded-[2.5rem] bg-white/40 backdrop-blur-2xl border border-white/40 flex items-end justify-center gap-6 px-12 pb-8 group-hover:border-primary/20 transition-all shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.03] to-transparent pointer-events-none" />
                {PIPELINE_STAGES.map((stage, i) => (
                  <div key={stage.id} className="flex-1 flex flex-col items-center gap-4 h-full justify-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${chartBars[i] || 2}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className={cn("w-full rounded-2xl shadow-lg border-b-4 border-white/20 relative group/bar", stage.color)}
                    >
                       <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-on-surface text-white text-xs font-black px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity">
                         {chartBars[i].toFixed(0)}%
                       </div>
                    </motion.div>
                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest rotate-[-45deg] origin-top-left -ml-2">{stage.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card variant="glass" className="p-12 min-h-[480px]">
              <h4 className="font-manrope font-black text-2xl text-on-surface mb-10 tracking-tight">Performance Insights</h4>
              <div className="space-y-10">
                {INSIGHTS.map((item, i) => (
                  <div key={i} className="flex gap-8 group cursor-default">
                    <div className={cn('w-2 rounded-full shrink-0 group-hover:scale-y-110 transition-transform origin-top shadow-sm', item.color)} style={{ minHeight: 64 }} />
                    <div>
                      <p className="text-lg font-manrope font-black text-on-surface mb-1.5 group-hover:text-primary transition-colors tracking-tight">{item.title}</p>
                      <p className="text-base text-slate-700 leading-relaxed font-manrope font-bold tracking-tight">{item.desc}</p>
                    </div>
                  </div>
                ))}
                
                <div className="mt-12 p-8 rounded-[2rem] bg-white/50 backdrop-blur-md border border-white/60 italic text-sm font-manrope font-bold text-slate-700 leading-relaxed tracking-tight">
                  "Os dados acima são calculados em tempo real com base nos seus negócios fechados como 
                  <span className="font-black text-primary"> 'Ganho' (closed_won)</span> e volume total do pipeline."
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
