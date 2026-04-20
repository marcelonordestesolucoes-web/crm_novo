// src/views/Campaigns/CampaignsView.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Play, 
  Pause, 
  CheckCircle2, 
  Users, 
  Send, 
  Clock, 
  AlertCircle, 
  MoreVertical,
  Search,
  Target
} from 'lucide-react';
import { 
  Card, 
  Button, 
  Badge, 
  GlassCard, 
  Modal, 
  LoadingSpinner,
  PageHeader 
} from '@/components/ui';
import { getCampaigns, processCampaignStep } from '@/services/campaigns';
import CampaignWizard from './CampaignWizard';
import { useSupabase } from '@/hooks/useSupabase';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/constants/config';

export default function CampaignsView() {
  const { data: campaigns, loading, refetch } = useSupabase(getCampaigns);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [activeProcessing, setActiveProcessing] = useState(null); // ID da campanha rodando
  const [searchQuery, setSearchQuery] = useState('');

  // Sincronização em tempo real do progresso
  useEffect(() => {
    const channel = supabase
      .channel('campaign-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_leads' }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Motor de Disparo (Client-side loop)
  useEffect(() => {
    let timeoutId;
    
    const runStep = async () => {
      if (!activeProcessing) return;
      
      try {
        const result = await processCampaignStep(activeProcessing);
        
        if (result?.finished) {
          setActiveProcessing(null);
          refetch();
          return;
        }

        if (result?.nextDelay) {
          timeoutId = setTimeout(runStep, result.nextDelay * 1000);
        }
      } catch (err) {
        console.error("Erro no motor de disparo:", err);
        setActiveProcessing(null);
      }
    };

    if (activeProcessing) {
      runStep();
    }

    return () => clearTimeout(timeoutId);
  }, [activeProcessing]);

  const handleStartCampaign = async (id) => {
    // 1. Atualizar status no DB
    await supabase.from('campaigns').update({ status: 'sending' }).eq('id', id);
    setActiveProcessing(id);
    refetch();
  };

  const handlePauseCampaign = async (id) => {
    await supabase.from('campaigns').update({ status: 'paused' }).eq('id', id);
    setActiveProcessing(null);
    refetch();
  };

  const calculateProgress = (leads) => {
    if (!leads || leads.length === 0) return 0;
    const sent = leads.filter(l => l.status === 'sent' || l.status === 'failed').length;
    return Math.round((sent / leads.length) * 100);
  };

  return (
    <div className="flex flex-col gap-y-10 pb-16 pt-0 -mt-10 animate-in fade-in duration-700 relative z-0">
      {/* 🌈 Efeito Visual Elite */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[600px] bg-gradient-to-br from-primary/20 to-cyan-400/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="flex items-center justify-between">
        <PageHeader 
          title="Campanhas Blindadas" 
          subtitle="Envios em massa com inteligência anti-banimento e regras humanas."
        />
        <Button 
          onClick={() => setIsWizardOpen(true)}
          className="bg-primary text-white px-8 py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          Nova Campanha
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <GlassCard className="p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Send className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Enviado</p>
          </div>
          <p className="text-4xl font-manrope font-black text-on-surface">1.240</p>
          <div className="mt-4 flex items-center gap-2 text-emerald-500 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            98.2% taxa de entrega
          </div>
        </GlassCard>

        <GlassCard className="p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Em Processamento</p>
          </div>
          <p className="text-4xl font-manrope font-black text-on-surface">
            {campaigns?.filter(c => c.status === 'sending').length || 0}
          </p>
          <div className="mt-4 text-slate-400 font-bold text-xs">
            Aguardando próximo disparo aleatório
          </div>
        </GlassCard>

        <GlassCard className="p-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500">
              <Target className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contatos Ativos</p>
          </div>
          <p className="text-4xl font-manrope font-black text-on-surface">2.450</p>
          <div className="mt-4 text-slate-400 font-bold text-xs uppercase tracking-widest">
            Prontos para conversão
          </div>
        </GlassCard>
      </div>

      {/* Tabela de Campanhas */}
      <GlassCard className="p-0 overflow-hidden border-white/20">
        <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
          <h3 className="text-xl font-manrope font-black text-on-surface">Lista de Disparos</h3>
          <div className="relative w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar campanha..."
              className="w-full bg-slate-900/5 border border-slate-200 rounded-full py-3 pl-12 pr-6 text-sm font-bold focus:outline-none focus:ring-2 ring-primary/20 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Campanha</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progresso</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <AnimatePresence>
                  {campaigns?.map((c) => (
                    <motion.tr 
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-primary/5 transition-all group"
                    >
                      <td className="px-8 py-6">
                        <div>
                          <p className="font-manrope font-black text-slate-800 leading-none mb-1 group-hover:text-primary transition-colors">{c.name}</p>
                          <p className="text-[11px] font-bold text-slate-400 truncate max-w-xs">{c.message_template}</p>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <Badge 
                          variant={c.status === 'completed' ? 'success' : c.status === 'sending' ? 'primary' : 'outline'}
                          className="font-black text-[9px] uppercase tracking-widest"
                        >
                          {c.status === 'sending' ? (
                            <span className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                              Enviando
                            </span>
                          ) : c.status === 'completed' ? 'Finalizada' : c.status === 'paused' ? 'Pausada' : 'Rascunho'}
                        </Badge>
                      </td>
                      <td className="px-8 py-6 w-64">
                        <div className="flex flex-col gap-2">
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-primary"
                              initial={{ width: 0 }}
                              animate={{ width: `${calculateProgress(c.leads)}%` }}
                            />
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                            {calculateProgress(c.leads)}% concluído • {c.leads?.length || 0} contatos
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {c.status === 'sending' ? (
                            <button 
                              onClick={() => handlePauseCampaign(c.id)}
                              className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/10"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          ) : (c.status === 'draft' || c.status === 'paused') && (
                            <button 
                              onClick={() => handleStartCampaign(c.id)}
                              className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-3 text-slate-400 hover:bg-slate-100 rounded-2xl transition-all">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </GlassCard>

      {/* TODO: Implementar o Wizard de Criação */}
      <CampaignWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
        onCreated={refetch}
      />
    </div>
  );
}
