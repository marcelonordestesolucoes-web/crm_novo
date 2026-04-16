import React from 'react';
import { motion } from 'framer-motion';
import { useSupabase } from '@/hooks/useSupabase';
import { getDeals } from '@/services/deals';
import { getOrgGoal, getMyMemberGoal } from '@/services/goals';
import { getUserPermissions } from '@/services/auth';
import { calculateForecastMetrics } from '@/utils/intelligence';
import { formatCurrency } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner, Card } from '@/components/ui';
import { cn } from '@/lib/utils';

export const SummaryStats = () => {
  const { data: deals, loading } = useSupabase(getDeals);
  const [targetGoal, setTargetGoal] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [latestNotes, setLatestNotes] = React.useState({});

  // Fetch Organization/Member Goal based on Role
  React.useEffect(() => {
    const fetchMeta = async () => {
      try {
        const perms = await getUserPermissions();
        setIsAdmin(perms.isAdmin);
        
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        let data = null;
        if (perms.isAdmin) {
          data = await getOrgGoal(month, year);
        } else {
          data = await getMyMemberGoal(month, year);
        }
        
        if (data) setTargetGoal(data);
      } catch (error) {
        console.error('Error fetching goal context:', error);
      }
    };
    fetchMeta();
  }, []);

  // Fetch Latest Notes for Forecast Accuracy
  React.useEffect(() => {
    const fetchNotes = async () => {
      if (!deals || deals.length === 0) return;
      const { data } = await supabase
        .from('deal_notes')
        .select('deal_id, content')
        .in('deal_id', deals.map(d => d.id))
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

  const metrics = React.useMemo(() => {
    if (!deals) return { totalPipeline: 0, totalForecast: 0, conversionRate: 0, progress: 0, meta: 0 };
    return calculateForecastMetrics(deals, latestNotes, targetGoal?.amount > 0 ? targetGoal.amount : 50000);
  }, [deals, latestNotes, targetGoal]);

  if (loading) return <div className="h-32 flex items-center justify-center bg-white/5 rounded-3xl border border-white/10"><LoadingSpinner size="sm" /></div>;

  const STATS = [
    {
      label: 'TOTAL PIPELINE',
      value: formatCurrency(metrics.totalPipeline),
      trend: isAdmin ? `Volume total em negociação` : `Seu volume em negociação`,
      trendColor: 'text-slate-400',
      borderColor: 'border-blue-500',
    },
    {
      label: 'CONVERSION RATE',
      value: `${metrics.conversionRate.toFixed(1)}%`,
      trend: isAdmin ? 'Taxa média do time' : 'Sua performance individual',
      trendColor: 'text-emerald-600',
      borderColor: 'border-yellow-500',
    },
    {
      label: isAdmin ? 'FORECAST (EMPRESA)' : 'FORECAST (PESSOAL)',
      value: formatCurrency(metrics.totalForecast),
      trend: metrics.meta > 0 
        ? `${(metrics.progress * 100).toFixed(0)}% da meta de ${formatCurrency(metrics.meta)}` 
        : (isAdmin ? 'Defina uma meta mensal' : 'Meta não atribuída'),
      trendColor: metrics.progress > 0.7 ? 'text-emerald-600' : 'text-amber-500',
      borderColor: 'border-teal-400',
    },
  ];

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-3 gap-5"
    >
      {STATS.map((stat) => (
        <motion.div
          key={stat.label}
          variants={item}
          className="h-full"
        >
          <Card 
            variant="crystal" 
            beam={true}
            className="h-full p-8 flex flex-col justify-center relative overflow-hidden group/card shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)] hover:scale-[1.03] transition-all duration-500"
          >
            {/* ✨ RIM GLOW — Brilho vibrante na borda inferior */}
            <div className={cn("absolute bottom-0 left-0 right-0 h-1.5 transition-all duration-500 opacity-80 group-hover/card:h-2 group-hover/card:opacity-100 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]", stat.borderColor.replace('border-', 'bg-'))} />
            
            {/* 🌈 AMBIENT VIBRATION — Aura interna centralizada atrás do valor */}
            <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 blur-[75px] rounded-full transition-all duration-1000 opacity-20 group-hover/card:opacity-45 group-hover/card:scale-125", stat.borderColor.replace('border-', 'bg-'))} />

            <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3 font-manrope opacity-80 relative z-20">
              {stat.label}
            </span>
            <div className="text-4xl font-manrope font-black text-on-surface tracking-tighter mb-2 relative z-20">
              {stat.value}
            </div>
            <div className={cn(stat.trendColor, "text-[11px] font-black uppercase tracking-widest flex items-center gap-1 opacity-100 relative z-20 bg-white/60 backdrop-blur-md self-start px-2.5 py-1 rounded-lg border border-white/60 shadow-sm transition-all group-hover/card:bg-white/80")}>
              {stat.trend}
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
};
