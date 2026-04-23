import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Filter, Layers, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DEAL_STATUS, formatCurrency } from '@/constants/config';
import { useSearch } from '@/hooks/useSearch';
import { useSupabase } from '@/hooks/useSupabase';
import { getDeals, deleteDeal, updateDeal } from '@/services/deals';
import { getPipelines, getPipelineStages, savePipelineStages } from '@/services/pipelines';
import { LoadingSpinner, ErrorMessage, Modal, GlassCard, Avatar } from '@/components/ui';
import { calculateDealRisk } from '@/utils/dealRisk';
import { DealForm } from './DealForm';
import { DealDetailsModal } from './DealDetailsModal';

// =========================================================================
//  COMPONENTES ATÔMICOS (INLINED PARA EVITAR CACHE DE HMR)
// =========================================================================
/** 
 * FUNNEL ELITE CARD (v405 - HYBRID)
 * Separado: Clique no card abre Detalhes, Menu abre Edição.
 */
const FunnelEliteCard = ({ deal, onEdit, onView, onDelete }) => {
  const status = DEAL_STATUS[deal.status] ?? DEAL_STATUS.new;
  const hasAction = deal.status === 'hot' || deal.status === 'at-risk';
  const [showMenu, setShowMenu] = useState(false);
  const riskInfo = calculateDealRisk(deal.qualification);
  const productLabel = deal.tags?.[0] || 'Sem produto';

  const displayValue = useMemo(() => (
    (deal.value !== undefined && deal.value !== null) 
      ? formatCurrency(deal.value) 
      : formatCurrency(0)
  ), [deal.value]);

  return (
    <GlassCard
      draggable 
      onDragStart={(e) => {
        console.log('Dragging deal:', deal.id);
        e.dataTransfer.setData('dealId', deal.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      // ALTURA MID-SIZE ELITE (v203)
      className="relative overflow-hidden h-[210px] w-full border-white/60 ring-1 ring-slate-900/5 flex-shrink-0 cursor-grab active:cursor-grabbing bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(196,250,255,0.58),rgba(250,230,255,0.44))] shadow-[0_18px_45px_rgba(15,23,42,0.12)] hover:shadow-[0_28px_70px_rgba(15,23,42,0.16)]"
      onClick={() => onView(deal)}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-cyan-400/[0.08] pointer-events-none" />
      {/* 🛡️ RESPIRO MID-SIZE */}
      <div className="pt-8 px-8 pb-8 flex flex-col h-full relative z-10 box-border">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2 items-center">
            <span className={cn(
              'text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-widest border shadow-sm',
              deal.tags?.[0] ? 'bg-white text-primary border-primary/20' : 'bg-slate-100 text-slate-700 border-slate-200'
            )}>
              {productLabel}
            </span>
            
            {riskInfo && (
              <div className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border backdrop-blur-md transition-all duration-500 shadow-sm",
                riskInfo.risk === 'high' 
                  ? "bg-red-50 border-red-200 text-red-600" :
                riskInfo.risk === 'medium' 
                  ? "bg-amber-50 border-amber-200 text-amber-700" :
                "bg-emerald-50 border-emerald-200 text-emerald-700"
              )}>
                <div className={cn(
                  "w-2 h-2 rounded-full animate-pulse shadow-sm",
                  riskInfo.risk === 'high' ? "bg-red-500 shadow-red-500/50" :
                  riskInfo.risk === 'medium' ? "bg-amber-500 shadow-amber-500/50" :
                  "bg-emerald-500 shadow-emerald-500/50"
                )} />
                <span className="text-xs font-black uppercase tracking-widest leading-none">
                  {riskInfo.risk === 'high' ? 'Alto Risco' :
                   riskInfo.risk === 'medium' ? 'Médio Risco' : 'Baixo Risco'}
                </span>
              </div>
            )}
          </div>
          <div className="relative">
            <MoreHorizontal 
              className="w-5 h-5 text-slate-600 group-hover/elite:text-primary transition-colors cursor-pointer" 
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            />
            {showMenu && (
              <div className="absolute right-0 top-8 w-44 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 z-50 py-2 overflow-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onEdit(deal);
                  }}
                  className="w-full text-left px-5 py-3.5 hover:bg-primary/5 text-[10px] font-black uppercase tracking-widest text-primary transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Editar Negócio
                </button>
                
                <div className="h-[1px] bg-slate-100/50 mx-2" />

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete(deal.id);
                  }}
                  className="w-full text-left px-5 py-3.5 hover:bg-error/5 text-[10px] font-black uppercase tracking-widest text-error transition-colors flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Excluir Negócio
                </button>
              </div>
            )}
          </div>
        </div>

        <h4 className="font-manrope font-black text-lg text-slate-950 leading-tight mb-1 line-clamp-2">
          {deal.title}
        </h4>
        <p className="text-xs text-slate-700 font-black uppercase tracking-widest mb-4">
          {deal.company || 'Oportunidade'}
        </p>

        {/* RODAPÉ ELEVADO UNIFICADO */}
        <div className="flex justify-between items-end mt-auto">
          <p className="text-2xl font-manrope font-black text-slate-950 tracking-tighter leading-none">
            {displayValue}
          </p>
          
          <div className="flex items-center gap-3">
            {hasAction && (
              <div className={cn('flex items-center gap-1.5 text-xs font-black uppercase tracking-widest', status.actionClass)}>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {status.actionIcon}
                </span>
                {status.actionLabel}
              </div>
            )}
            <Avatar 
               src={deal.ownerAvatar || null} 
               name={deal.ownerName || 'Staff'} 
               size="sm" 
               className="w-9 h-9 border-white/90 ring-2 ring-white/70 shadow-xl bg-white"
             />
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

/** 
 * FUNNEL ELITE STAGE
 * Memorizado e otimizado para lidar com muitos deals sem lag.
 */
const FunnelEliteStage = React.memo(({ stage, deals, onNew, onEdit, onView, onDelete, onDropDeal }) => {
  const [isOver, setIsOver] = useState(false);

  return (
    <div className="flex flex-col gap-8 min-w-[400px] max-w-[480px] shrink-0 h-full snap-center">
      <div className="px-4 space-y-2.5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className={cn('w-4 h-4 rounded-full shadow-2xl transition-all', stage.color)} />
            <h3 className="font-manrope font-black text-base tracking-widest text-slate-950 uppercase">
              {stage.label}
            </h3>
            <span className="text-xs text-slate-700 font-black bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/60 shadow-sm">
               {deals.length}
            </span>
          </div>
          <button onClick={() => onNew(stage.id)} className="w-10 h-10 rounded-full hover:bg-primary/10 text-slate-700 hover:text-primary transition-all flex items-center justify-center bg-white/80 border border-white/60 shadow-sm active:scale-95">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <p className="text-3xl font-manrope font-black text-slate-950 tracking-tighter">
          {formatCurrency(stage.totalValue)}
        </p>
      </div>

      <div 
        onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          const dealId = e.dataTransfer.getData('dealId');
          if (dealId) onDropDeal(dealId, stage.id);
        }}
        className={cn(
          "flex flex-col gap-6 p-4 rounded-[3.5rem] min-h-[600px] max-h-[75vh] transition-all duration-300 overflow-y-auto custom-scrollbar items-stretch border border-transparent pb-32",
          isOver ? "bg-primary/5 ring-4 ring-primary/10 scale-[0.99]" : "bg-transparent"
        )}
      >
        <AnimatePresence mode="popLayout">
          {deals.map((deal) => (
            <motion.div
              layout="position"
              key={deal.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <FunnelEliteCard deal={deal} onEdit={onEdit} onView={onView} onDelete={onDelete} />
            </motion.div>
          ))}
        </AnimatePresence>
        
        <button 
          onClick={() => onNew(stage.id)}
          className="w-full py-8 border-2 border-dashed border-slate-300 rounded-[2.5rem] text-slate-700 hover:border-primary/30 hover:text-primary transition-all flex flex-col items-center justify-center gap-3 font-manrope font-black text-xs uppercase tracking-widest hover:bg-white/80 group mt-2"
        >
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary/10 transition-all shadow-sm">
            <Plus className="w-6 h-6" />
          </div>
          Adicionar Negócio
        </button>
      </div>
    </div>
  );
});

// =========================================================================
//  VIEW PRINCIPAL - FUNNEL VIEW (ATÔMICA)
// =========================================================================

export default function FunnelView() {
  const [pipelines, setPipelines] = useState([]);
  const [activePipelineId, setActivePipelineId] = useState(null);
  const [stages, setStages] = useState([]);
  const [loadingStages, setLoadingStages] = useState(true);

  const { data: deals, loading: loadingDeals, error, refetch } = useSupabase(getDeals);
  
  useEffect(() => {
    loadPipelines();
  }, []);

  useEffect(() => {
    if (activePipelineId) {
      loadStages(activePipelineId);
    }
  }, [activePipelineId]);

  async function loadPipelines() {
    try {
      const data = await getPipelines();
      setPipelines(data);
      if (data.length > 0 && !activePipelineId) {
        setActivePipelineId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadStages(id) {
    try {
      setLoadingStages(true);
      const data = await getPipelineStages(id);
      setStages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStages(false);
    }
  }

  const { query, setQuery, filtered } = useSearch(deals ?? [], ['title', 'company']);

  const dealsByStage = stages.reduce((acc, stage) => {
    const stageDeals = filtered.filter((d) => d.stage === stage.id && d.is_qualified !== false);
    const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    
    acc[stage.id] = {
      deals: stageDeals,
      totalValue: totalValue
    };
    return acc;
  }, {});

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [viewingDeal, setViewingDeal] = useState(null);

  const handleOpenCreate = (stageId) => {
    setEditingDeal({ stage: stageId || (stages[0]?.id) });
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (deal) => {
    setEditingDeal(deal);
    setCreateModalOpen(true);
  };

  const handleOpenDetails = (deal) => {
    setViewingDeal(deal);
    setDetailsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este negócio?')) return;
    try {
      await deleteDeal(id);
      refetch();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDropDeal = async (dealId, newStageId) => {
    const deal = deals?.find(d => d.id === dealId);
    if (!deal || deal.stage === newStageId) return;

    try {
      await updateDeal(dealId, { stage: newStageId });
      refetch();
    } catch (err) {
      alert('Erro ao mover negócio: ' + err.message);
      refetch();
    }
  };

  const handleCreateSuccess = () => {
    setCreateModalOpen(false);
    setEditingDeal(null); // Limpa o estado após sucesso
    refetch();
  };

  const handleManualRepair = async () => {
    try {
      setLoadingStages(true);
      const defaultStages = [
        { id: window.crypto.randomUUID(), label: 'LEAD', color: 'bg-slate-500' },
        { id: window.crypto.randomUUID(), label: 'QUALIFICADO', color: 'bg-primary' },
        { id: window.crypto.randomUUID(), label: 'PROPOSTA', color: 'bg-indigo-500' },
        { id: window.crypto.randomUUID(), label: 'NEGOCIAÇÃO', color: 'bg-amber-500' },
        { id: window.crypto.randomUUID(), label: 'FECHADO', color: 'bg-emerald-500' }
      ];
      await savePipelineStages(activePipelineId, defaultStages);
      await loadStages(activePipelineId);
      refetch();
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      setLoadingStages(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-700 flex flex-col min-h-full overflow-visible relative -mt-14 z-10 font-manrope pl-4 lg:pl-8 pr-4">
      {/* Aurora Backdrop */}
      <div className="absolute -top-20 left-1/4 w-[900px] h-[500px] bg-blue-500/[0.08] blur-[150px] rounded-full pointer-events-none -z-10" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 min-w-0">
        <div className="min-w-0">
          <h2 className="text-4xl font-black text-on-surface tracking-tighter">Pipeline Ativo</h2>
          <div className="flex items-center gap-3 mt-4 flex-wrap pb-2 max-w-full">
             {pipelines.map(p => (
               <button
                 key={p.id}
                 onClick={() => setActivePipelineId(p.id)}
                 className={cn(
                   "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                   activePipelineId === p.id 
                     ? "bg-primary text-white shadow-2xl shadow-primary/20 scale-105" 
                     : "bg-white/40 text-slate-400 hover:text-on-surface hover:bg-white"
                 )}
               >
                 {p.name}
               </button>
             ))}
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          <button className="px-6 py-3 rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 hover:bg-white transition-all shadow-sm">
            <Filter className="w-4 h-4" /> Filtrar
          </button>
          <button className="px-6 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-2xl shadow-primary/20 hover:bg-primary-container transition-all active:scale-95" onClick={() => handleOpenCreate()}>
            <Plus className="w-5 h-5" /> Novo Negócio
          </button>
        </div>
      </div>

      {/* 🌈 SILENT SYNC INDICATOR — Sutil e etéreo no canto */}
      {(loadingDeals || loadingStages) && (deals?.length > 0 || stages?.length > 0) && (
        <div className="absolute top-6 right-40 z-50 flex items-center gap-3 bg-white/40 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/20 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Sincronizando...</span>
        </div>
      )}

      {/* FULL PAGE LOADER — Apenas no primeiro acesso, para não quebrar o fluxo */}
      {(loadingDeals || loadingStages) && (!deals?.length && !stages?.length) && (
        <div className="flex-1 flex flex-col items-center justify-center py-40 animate-in fade-in duration-700">
           <LoadingSpinner message="Inicializando sua Experiência Elite..." />
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!error && (stages?.length > 0 || deals?.length > 0) && (
        <div className={cn(
          "flex gap-8 overflow-x-auto overflow-y-visible pb-12 items-start snap-x flex-1 custom-scrollbar transition-opacity duration-700 pl-1",
          (loadingDeals || loadingStages) ? "opacity-60 grayscale-[0.2]" : "opacity-100"
        )}>
          <AnimatePresence mode="popLayout">
            {stages.map((stage) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                key={stage.id}
              >
                <FunnelEliteStage 
                  stage={{ ...stage, totalValue: dealsByStage[stage.id]?.totalValue || 0 }} 
                  deals={dealsByStage[stage.id]?.deals || []} 
                  onNew={handleOpenCreate}
                  onEdit={handleOpenEdit}
                  onView={handleOpenDetails}
                  onDelete={handleDelete}
                  onDropDeal={handleDropDeal}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          
          {stages.length === 0 && (
            <div className="w-full flex flex-col items-center justify-center py-40 border-2 border-dashed border-slate-200 rounded-[3rem] bg-white/5 backdrop-blur-sm">
               <Layers className="w-16 h-16 text-slate-100 mb-6" />
               <p className="text-on-surface font-black uppercase tracking-[0.3em] text-[10px] mb-8 text-center px-10 opacity-60">Estrutura do funil não detectada</p>
               <button 
                 onClick={handleManualRepair}
                 className="px-10 py-5 rounded-3xl bg-primary text-white text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
               >
                 Restaurar Estrutura Elite
               </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Criação/Edição */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => { setCreateModalOpen(false); setEditingDeal(null); }}
        title={editingDeal?.id ? 'Editar Oportunidade' : 'Novo Negócio'}
        className="max-w-4xl"
        footer={
          <div className="flex gap-4">
            <button 
              onClick={() => setCreateModalOpen(false)}
              className="px-8 py-3 rounded-2xl text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              form="deal-form"
              className="px-10 py-3 rounded-2xl bg-primary hover:bg-primary-container text-white font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/20 transition-all active:scale-95"
            >
              {editingDeal?.id ? 'Salvar Alterações' : 'Finalizar Criação'}
            </button>
          </div>
        }
      >
        <DealForm 
          key={editingDeal?.id || 'new'}
          initialData={editingDeal} 
          onSuccess={handleCreateSuccess} 
          onCancel={() => { setCreateModalOpen(false); setEditingDeal(null); }}
        />
      </Modal>

      {/* Modal de Detalhes */}
      {viewingDeal && (
        <DealDetailsModal 
          isOpen={detailsModalOpen} 
          onClose={() => {
            setDetailsModalOpen(false);
            setViewingDeal(null);
          }} 
          deal={viewingDeal}
          onUpdate={refetch}
          stages={stages}
        />
      )}
    </div>
  );
}
