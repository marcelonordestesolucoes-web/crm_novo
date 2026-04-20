import React from 'react';
import { motion } from 'framer-motion';
import { Card, LoadingSpinner, Badge } from '@/components/ui';
import { useSupabase } from '@/hooks/useSupabase';
import { getAIUsageMetrics } from '@/services/organizations';
import { Sparkles, Zap, ShieldCheck, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

export const IAPerformance = () => {
  const { data: metrics, loading } = useSupabase(getAIUsageMetrics);

  if (loading) return <div className="h-32 flex items-center justify-center"><LoadingSpinner size="sm" /></div>;
  if (!metrics) return null;

  const usagePercent = (metrics.ai_used / metrics.ai_quota) * 100;
  const isHealthy = usagePercent < 80;

  return (
    <Card variant="glass" className="p-8 relative overflow-hidden group/performance">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-manrope font-black text-on-surface tracking-tight uppercase">IA Performance</h3>
            <Badge variant="outline" className="text-[8px] font-black uppercase bg-primary/5 text-primary border-primary/20">
                {metrics.plan_name}
            </Badge>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">Status do Motor de Decisão</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-manrope">Análises Usadas</p>
          <div className="flex items-end gap-2">
            {metrics.ai_used === 0 ? (
                <span className="text-xs font-black text-primary uppercase tracking-tighter bg-primary/5 px-2 py-0.5 rounded-md">Fase de Aprendizado</span>
            ) : (
                <>
                    <span className="text-2xl font-manrope font-black text-on-surface">{metrics.ai_used}</span>
                    <span className="text-xs font-bold text-slate-400 mb-1">/ {metrics.ai_quota}</span>
                </>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-manrope">Ruído Evitado</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-manrope font-black text-emerald-600">{metrics.ai_saved_by_filter}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500 mb-1" />
          </div>
        </div>
      </div>

      {/* Usage Bar */}
      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
          <span className="text-slate-400">Quota: {usagePercent.toFixed(0)}%</span>
          <span className="text-primary">{metrics.ai_rate_limit} req / min</span>
        </div>
        <div className="h-2 bg-slate-100/50 rounded-full overflow-hidden border border-white/40">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, usagePercent)}%` }}
            className={cn("h-full transition-all duration-1000", isHealthy ? "bg-primary" : "bg-error")}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
        <Timer className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Reset em: {new Date(metrics.ai_reset_at).toLocaleDateString()}
        </p>
      </div>

      {/* Decorative Aura */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 blur-3xl rounded-full" />
    </Card>
  );
};
