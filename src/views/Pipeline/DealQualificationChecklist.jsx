import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import { calculateDealRisk } from '@/utils/dealRisk';

const QUESTIONS = [
  { id: 'budget', text: 'Existe orçamento definido?' },
  { id: 'decisionMaker', text: 'Você falou com o decisor?' },
  { id: 'urgency', text: 'Existe urgência?' },
  { id: 'proposal', text: 'Já foi enviada proposta?' }
];

export const DealQualificationChecklist = ({ responses = {}, onChange }) => {
  const handleSelect = (id, value) => {
    if (onChange) {
      onChange({ ...responses, [id]: value });
    }
  };

  const getStatusDetails = (score, risk, answeredCount) => {
    if (answeredCount === 0) {
      return { text: 'Aguardando...', color: 'text-slate-400', bg: 'bg-slate-100', icon: 'pending' };
    }
    
    if (risk === 'high') {
      return { text: 'Alto Risco', color: 'text-red-600', bg: 'bg-red-50', icon: 'warning' };
    } else if (risk === 'medium') {
      return { text: 'Médio Risco', color: 'text-amber-600', bg: 'bg-amber-50', icon: 'info' };
    } else {
      return { text: 'Baixo Risco', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: 'verified' };
    }
  };

  const riskData = calculateDealRisk(responses);
  const answeredCount = Object.keys(responses).length;
  const { score, risk } = riskData || { score: 0, risk: 'low' };
  const status = getStatusDetails(score, risk, answeredCount);

  return (
    <Card variant="glass" className="p-8 mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/5">
            <span className="material-symbols-outlined text-xl font-black">fact_check</span>
          </div>
          <h4 className="text-xl font-manrope font-black text-on-surface tracking-tight">Qualificação do Negócio</h4>
        </div>

        {answeredCount > 0 && (
          <div className={cn("px-4 py-2 rounded-2xl flex items-center gap-2 border border-white/40 shadow-sm transition-all animate-in zoom-in-95", status.bg)}>
            <span className={cn("material-symbols-outlined text-lg", status.color)}>{status.icon}</span>
            <span className={cn("text-[10px] font-black uppercase tracking-widest", status.color)}>{status.text}</span>
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        {QUESTIONS.map((q) => (
          <div key={q.id} className="flex items-center justify-between gap-6 p-4 rounded-2xl bg-white/20 border border-white/20 hover:bg-white/40 transition-all group">
            <span className="text-sm font-manrope font-bold text-slate-500 group-hover:text-on-surface transition-colors">
              {q.text}
            </span>
            <div className="flex bg-white/40 p-1 rounded-xl border border-white/20 shadow-inner">
              <button
                onClick={() => handleSelect(q.id, true)}
                className={cn(
                  "px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                  responses[q.id] === true
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                    : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                )}
              >
                Sim
              </button>
              <button
                onClick={() => handleSelect(q.id, false)}
                className={cn(
                  "px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                  responses[q.id] === false
                    ? "bg-red-500 text-white shadow-lg shadow-red-200"
                    : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                )}
              >
                Não
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8 pt-6 border-t border-white/20 flex justify-between items-center">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score de Saúde</p>
          <p className={cn("text-2xl font-manrope font-black tracking-tight", answeredCount > 0 ? status.color : "text-slate-300")}>
            {answeredCount > 0 ? (score > 0 ? `+${score}` : score) : '--'}
          </p>
        </div>
        
        <div className="text-right space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progresso</p>
          <p className="font-manrope font-black text-on-surface text-sm tracking-tight opacity-60">
            {answeredCount}/4 Perguntas
          </p>
        </div>
      </div>
    </Card>
  );
};
