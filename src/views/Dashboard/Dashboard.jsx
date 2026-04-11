import React, { useState } from 'react';
import { Card } from '@/components/ui';
import { SummaryStats } from '@/components/dashboard/SummaryStats';
import { OracleInsight } from '@/components/intelligence/OracleInsight';
import { DealDetailsModal } from '@/views/Pipeline/DealDetailsModal';
import { useSupabase } from '@/hooks/useSupabase';
import { getDeals } from '@/services/deals';

export default function Dashboard() {
  const [viewingDeal, setViewingDeal] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const { data: deals, refetch } = useSupabase(getDeals);

  const handleOpenDeal = (dealId) => {
    const deal = deals?.find(d => d.id === dealId);
    if (deal) {
      setViewingDeal(deal);
      setDetailsModalOpen(true);
    }
  };
  return (
    <div className="flex flex-col gap-10 pb-16 pt-2 animate-in fade-in duration-700">

      <div className="grid grid-cols-12 gap-8">
        {/* Main Column */}
        <div className="col-span-12 xl:col-span-8 flex flex-col gap-12">
          <SummaryStats />

          {/* Strategic Insights */}
          <section>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-3xl font-manrope font-black text-on-surface tracking-tight">Análise Estratégica</h2>
              <span className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border border-primary/20">
                Live Signals
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Card: Deals at Risk */}
              <Card variant="glass" className="p-10 border-l-4 border-l-error flex flex-col relative overflow-hidden group">
                <div className="flex items-center gap-2 mb-6">
                  <span className="bg-error/10 text-error text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-sm">Account at Risk</span>
                  <span className="material-symbols-outlined text-error text-xl ml-auto animate-pulse">warning</span>
                </div>
                <h3 className="text-xl font-manrope font-black text-on-surface mb-3 tracking-tight group-hover:text-error transition-colors">Global Tech Expansion</h3>
                <p className="text-sm font-manrope font-bold text-slate-500 leading-relaxed mb-8 opacity-70">
                  Sem contato com stakeholders há 12 dias. Menções a concorrentes detectadas em comunicações internas.
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-[11px] font-black text-error uppercase tracking-widest">$450k em risco</span>
                  <button className="text-primary text-xs font-black font-manrope uppercase tracking-widest hover:underline flex items-center gap-2">
                    Plano de Mitigação
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </Card>

              {/* Card: Action Required */}
              <Card variant="glass" className="p-10 border-l-4 border-l-amber-500 flex flex-col relative overflow-hidden group">
                <div className="flex items-center gap-2 mb-6">
                  <span className="bg-amber-100 text-amber-600 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-sm">Action Required</span>
                  <div className="w-4 h-4 bg-amber-500 rounded-full ml-auto shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                </div>
                <h3 className="text-xl font-manrope font-black text-on-surface mb-3 tracking-tight group-hover:text-amber-600 transition-colors">Vertex Group Renewals</h3>
                <p className="text-sm font-manrope font-bold text-slate-500 leading-relaxed mb-8 opacity-70">
                  Expiração de contrato em 45 dias. Rascunho da proposta está 80% concluído, aguardando revisão final.
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Hoje às 14:00</span>
                  <button className="text-primary text-xs font-black font-manrope uppercase tracking-widest hover:underline flex items-center gap-2">
                    Abrir Rascunho
                    <span className="material-symbols-outlined text-sm">edit_document</span>
                  </button>
                </div>
              </Card>

              {/* Full width lower card */}
              <Card variant="glass" className="p-10 border-l-4 border-l-emerald-500 flex justify-between gap-10 relative overflow-hidden group col-span-1 md:col-span-2">
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-sm">Hot Opportunity</span>
                    <span className="material-symbols-outlined text-emerald-500 ml-auto text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </div>
                  <h3 className="text-2xl font-manrope font-black text-on-surface mb-4 tracking-tight group-hover:text-emerald-600 transition-colors">Solaris Energy Grid</h3>
                  <p className="text-base font-manrope font-bold text-slate-500 leading-relaxed mb-10 max-w-xl opacity-70">
                    O time executivo solicitou uma segunda demonstração técnica. IA prediz 92% de probabilidade de fechamento se ocorrer esta semana.
                  </p>
                  <div className="mt-auto flex items-center gap-6">
                    <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-2xl text-[11px] font-black font-manrope uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 active:scale-95">
                      Agendar Demo Prioritária
                    </button>
                    <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">$1.2M Contract Value</span>
                  </div>
                </div>
                {/* Decorative right side graphic block */}
                <div className="w-2/5 hidden md:block rounded-[2rem] overflow-hidden relative border border-white/40 shadow-inner group-hover:scale-[1.02] transition-transform duration-500">
                   <img src="https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-90 grayscale group-hover:grayscale-0 transition-all duration-700" alt="Office" />
                   <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/10 to-white/60"></div>
                </div>
              </Card>
            </div>
          </section>
        </div>


        {/* Sidebar */}
        <div className="col-span-12 xl:col-span-4">
          <OracleInsight onOpenDeal={handleOpenDeal} />
        </div>
      </div>

      {viewingDeal && (
        <DealDetailsModal 
          isOpen={detailsModalOpen} 
          onClose={() => {
            setDetailsModalOpen(false);
            setViewingDeal(null);
          }} 
          deal={viewingDeal}
          onUpdate={refetch}
        />
      )}
    </div>
  );
}

const FollowUpItem = ({ name, role, time, status, statusColor, avatar }) => (
  <div className="grid grid-cols-12 gap-4 p-5 hover:bg-white transition-all rounded-2xl items-center cursor-pointer group border border-transparent hover:border-slate-100 hover:shadow-sm">
    <div className="col-span-1">
      <img alt={name} className="w-11 h-11 rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-105" src={avatar} />
    </div>
    <div className="col-span-4 pl-2">
      <div className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors leading-tight">{name}</div>
      <div className="text-[11px] text-on-surface-variant opacity-60 leading-tight">{role}</div>
    </div>
    <div className="col-span-4">
      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5">{time}</div>
      <div className={`text-[11px] ${statusColor} font-bold`}>{status}</div>
    </div>
    <div className="col-span-3 text-right">
      <button className="bg-primary-fixed text-on-primary-fixed px-5 py-2.5 rounded-full text-[11px] font-extrabold hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95">
        Executar
      </button>
    </div>
  </div>
);
