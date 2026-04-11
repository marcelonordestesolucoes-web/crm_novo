import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui';

// Para alterar os KPIs do topo do Dashboard, edite STATS abaixo.
const STATS = [
  {
    label: 'TOTAL PIPELINE',
    value: '$4.2M',
    trend: '↗ +12% from last quarter',
    trendColor: 'text-emerald-600',
    borderColor: 'border-blue-500',
  },
  {
    label: 'CONVERSION RATE',
    value: '32.4%',
    trend: '↗ +2.1% performance lift',
    trendColor: 'text-emerald-600',
    borderColor: 'border-yellow-500',
  },
  {
    label: 'FORECAST REVENUE',
    value: '$1.8M',
    trend: '⚡ High confidence (85%)',
    trendColor: 'text-emerald-600',
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

export const SummaryStats = () => (
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
          variant="glass" 
          className={`h-full p-8 border-l-4 ${stat.borderColor} flex flex-col justify-center`}
        >
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-3 font-inter">
            {stat.label}
          </span>
          <div className="text-4xl font-extrabold text-on-surface tracking-tight mb-2 font-inter">
            {stat.value}
          </div>
          <div className={`${stat.trendColor} text-xs font-semibold font-inter flex items-center gap-1`}>
            {stat.trend}
          </div>
        </Card>
      </motion.div>
    ))}
  </motion.div>
);


