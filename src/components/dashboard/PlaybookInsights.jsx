import React from 'react';
import { Card } from '@/components/ui';
import { useSupabase } from '@/hooks/useSupabase';
import { getPlaybookStats } from '@/services/aiTracking';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const CATEGORY_LABELS = {
    URGENCY: 'Urgência 🔥',
    ROI: 'Retorno (ROI) 💰',
    SOCIAL_PROOF: 'Prova Social 🌟',
    OBJECTION_HANDLING: 'Objeções 🛡️',
    NEXT_STEP: 'Avanço 🚀'
};

const CATEGORY_COLORS = {
    URGENCY: 'bg-rose-500',
    ROI: 'bg-emerald-500',
    SOCIAL_PROOF: 'bg-indigo-500',
    OBJECTION_HANDLING: 'bg-amber-500',
    NEXT_STEP: 'bg-primary'
};

export const PlaybookInsights = () => {
    const { data: stats, loading } = useSupabase(getPlaybookStats, []);

    if (loading) return (
        <Card variant="glass" className="p-8 h-[400px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">O Oráculo está aprendendo...</p>
            </div>
        </Card>
    );

    // [PHASE 6 ELITE] - Calcular taxa de sucesso com Suavização de Laplace para exibição
    const processedStats = (stats || []).map(item => ({
        ...item,
        // Formula: (success + 1) / (total + 2)
        displayRate: Math.round((( (item.successes || 0) + 1) / ((item.total || 0) + 2)) * 100)
    })).sort((a, b) => b.displayRate - a.displayRate);

    // [PHASE 6.2 ELITE] - Benchmarks de Mercado para estado vazio
    const BENCHMARKS = [
        { category: 'OBJECTION_HANDLING', displayRate: 68, qualifier: 'Mais Eficaz' },
        { category: 'ROI', displayRate: 64, qualifier: 'Consistente' },
        { category: 'URGENCY', displayRate: 52, qualifier: 'Situacional' }
    ];

    const hasData = stats && stats.length > 0;
    const finalStats = hasData ? processedStats : BENCHMARKS;

    return (
        <Card variant="glass" className="p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[80px] -mr-16 -mt-16 transition-all group-hover:bg-primary/10" />
            
            <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
                        <span className="material-symbols-outlined text-xl font-black">psychology</span>
                    </div>
                    <div>
                        <h4 className="text-xl font-manrope font-black text-on-surface tracking-tight">O que funciona?</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">Adaptive Playbook v6.2</p>
                    </div>
                </div>
                <div className="px-3 py-1 bg-white/40 border border-white/60 rounded-full shadow-sm">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">
                        {hasData ? 'AI Memory Active' : 'Market Benchmark'}
                    </span>
                </div>
            </div>

            <div className="space-y-6 relative z-10">
                {finalStats.map((item, idx) => (
                    <div key={item.category} className="space-y-2">
                        <div className="flex justify-between items-end">
                            <div className="flex items-baseline gap-2">
                                <span className="text-[11px] font-black text-slate-600 uppercase tracking-tighter">
                                    {CATEGORY_LABELS[item.category] || item.category}
                                </span>
                                {!hasData && item.qualifier && (
                                    <span className="text-[8px] font-black text-primary uppercase tracking-widest opacity-40">
                                        • {item.qualifier}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={cn(
                                    "text-sm font-manrope font-black tabular-nums leading-none",
                                    item.displayRate > 60 ? "text-emerald-500" : "text-slate-400"
                                )}>
                                    {item.displayRate}%
                                </span>
                                <span className="text-[8px] uppercase font-bold text-slate-300">
                                    {hasData ? 'Taxa de Conversão' : 'Média de Mercado'}
                                </span>
                            </div>
                        </div>
                        <div className="h-2.5 bg-slate-100/50 rounded-full overflow-hidden border border-white/40 shadow-inner p-[1px]">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${item.displayRate}%` }}
                                transition={{ duration: 1, delay: idx * 0.1, ease: "easeOut" }}
                                className={cn("h-full rounded-full shadow-sm", CATEGORY_COLORS[item.category] || 'bg-slate-300')}
                            />
                        </div>
                    </div>
                ))}

                {!hasData && (
                    <div className="mt-4 pt-4 border-t border-slate-100/50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.05em] leading-relaxed">
                            💡 Os dados locais substituirão os benchmarks após os primeiros fechamentos.
                        </p>
                    </div>
                )}
            </div>

            <div className="mt-10 pt-6 border-t border-white/20 flex items-center gap-2 group/tip">
                <span className="material-symbols-outlined text-primary/60 text-lg group-hover:scale-110 transition-transform">auto_awesome</span>
                <p className="text-[10px] font-bold text-slate-400/80 leading-relaxed italic">
                    O Oráculo prioriza automaticamente as estratégias com maior taxa de sucesso na sua organização.
                </p>
            </div>
        </Card>
    );
};
