import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Plus, Filter, SortAsc, LayoutGrid, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DEAL_STATUS, formatCurrency } from '@/constants/config';
import { useSearch } from '@/hooks/useSearch';
import { useSupabase } from '@/hooks/useSupabase';
import { getDeals, deleteDeal, updateDeal } from '@/services/deals';
import { getPipelines, getPipelineStages } from '@/services/pipelines';
import { Card, SearchBar, LoadingSpinner, ErrorMessage, Modal, Avatar } from '@/components/ui';
import { DealForm } from './DealForm';
import { DealDetailsModal } from './DealDetailsModal';
import { calculateDealRisk } from '@/utils/dealRisk';

const DealCard = ({ deal, onEdit, onDelete }) => {
  const status = DEAL_STATUS[deal.status] ?? DEAL_STATUS.new;
  const hasAction = deal.status === 'hot' || deal.status === 'at-risk';
  const [showMenu, setShowMenu] = useState(false);

  const riskInfo = calculateDealRisk(deal.qualification);

  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('dealId', deal.id);
      }}
      variant="glass"
      className="p-6 cursor-grab active:cursor-grabbing group relative overflow-hidden border-white/20"
      onClick={() => onEdit(deal)}
    >
       {/* Accento de Status sutil */}
       <div className={cn('absolute top-0 left-0 w-1.5 h-full opacity-40', status.dotClass)} />
       
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex gap-2 items-center">
          <span className={cn('text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-[0.15em] border border-current opacity-70', status.badgeClass)}>
            {deal.tags?.[0] ?? status.label}
          </span>
          
          {riskInfo && (
            <div className={cn(
              "flex items-center gap-1 px-2.5 py-0.5 rounded-full border shadow-sm animate-in fade-in zoom-in duration-300",
              riskInfo.risk === 'high' ? "bg-red-50 border-red-200 text-red-600" :
              riskInfo.risk === 'medium' ? "bg-amber-50 border-amber-200 text-amber-600" :
              "bg-emerald-50 border-emerald-200 text-emerald-600"
            )}>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                riskInfo.risk === 'high' ? "bg-red-500" :
                riskInfo.risk === 'medium' ? "bg-amber-500" :
                "bg-emerald-500"
              )} />
              <span className="text-[8px] font-black uppercase tracking-widest">
                {riskInfo.risk === 'high' ? 'Alto Risco' :
                 riskInfo.risk === 'medium' ? 'Médio Risco' : 'Baixo Risco'}
              </span>
            </div>
          )}
        </div>
        <div className="relative">
          <MoreHorizontal 
            className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors cursor-pointer" 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          />
          {showMenu && (
            <div className="absolute right-0 top-6 w-36 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 z-10 py-2 overflow-hidden">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDelete(deal.id);
                }}
                className="w-full text-left px-4 py-2 hover:bg-error/10 text-xs font-black uppercase tracking-widest text-error transition-colors"
              >
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <h4 className="font-manrope font-black text-base text-on-surface leading-snug mb-1 relative z-10">{deal.title}</h4>
      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-6 relative z-10 opacity-70">{deal.company}</p>

      <p className="text-xl font-manrope font-black text-on-surface mb-6 relative z-10 tracking-tighter">
        {formatCurrency(deal.value)}
      </p>

      <div className="flex justify-between items-center relative z-10 pt-2">
        <div className="flex -space-x-2">
           <Avatar 
             src={deal.ownerAvatar} 
             name={deal.ownerName} 
             size="sm" 
             className="border-white/80 ring-2 ring-white/20 shadow-xl"
           />
        </div>
        {hasAction && (
          <div className={cn('flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ml-auto opacity-70', status.actionClass)}>
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
              {status.actionIcon}
            </span>
            {status.actionLabel}
          </div>
        )}
      </div>
    </Card>
  );
};

const StageColumn = ({ stage, deals, onNew, onEdit, onDelete, onDropDeal }) => {
  const [isOver, setIsOver] = useState(false);

  // Mapeia classes de BG para sombreados de brilho sutil
  const getGlowClass = (bgClass) => {
    if (!bgClass) return '';
    const color = bgClass.replace('bg-', '').split('-')[0];
    return `shadow-[0_0_12px_rgba(var(--${color}-rgb),0.4)]`;
  };

  return (
    <div className="flex flex-col gap-6 min-w-[340px] shrink-0 h-full">
      <div className="px-2 space-y-1">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={cn('w-2.5 h-2.5 rounded-full shadow-xl transition-all', stage.color)} />
            <h3 className="font-manrope font-black text-[11px] tracking-widest text-on-surface uppercase opacity-90">
              {stage.label}
            </h3>
            <span className="text-[10px] text-slate-400 font-black bg-slate-100/50 px-2 py-0.5 rounded-full border border-slate-100">
               {deals.length}
            </span>
          </div>
          <button onClick={() => onNew(stage.id)} className="w-6 h-6 rounded-full hover:bg-primary/10 text-slate-300 hover:text-primary transition-all flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xl font-manrope font-black text-on-surface tracking-tighter opacity-80">
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
          "flex flex-col gap-4 p-2 rounded-[2.5rem] min-h-[500px] transition-all duration-300 overflow-y-auto custom-scrollbar",
          isOver ? "bg-primary/5 ring-2 ring-primary/20 scale-[0.99]" : "bg-transparent"
        )}
      >
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onEdit={onEdit} onDelete={onDelete} />
        ))}
        
        <button 
          onClick={() => onNew(stage.id)}
          className="w-full py-8 border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 hover:border-primary/20 hover:text-primary transition-all flex flex-col items-center justify-center gap-2 font-manrope font-black text-[10px] uppercase tracking-widest hover:bg-white/40 group mt-2"
        >
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <Plus className="w-5 h-5" />
          </div>
          Adicionar Novo
        </button>
      </div>
    </div>
  );
};

export default function Pipeline() {
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
    const stageDeals = filtered.filter((d) => d.stage === stage.id);
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
    refetch();
  };

  return (
    <div className="animate-in fade-in duration-700 flex flex-col h-full overflow-hidden">
      
      {/* Header e Seleção de Funil */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-manrope font-extrabold text-on-surface tracking-tight">Pipeline Ativo</h2>
          <div className="flex items-center gap-3 mt-2 overflow-x-auto pb-2 no-scrollbar">
             {pipelines.map(p => (
               <button
                 key={p.id}
                 onClick={() => setActivePipelineId(p.id)}
                 className={cn(
                   "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                   activePipelineId === p.id 
                     ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" 
                     : "bg-white/40 text-slate-400 hover:text-on-surface hover:bg-white"
                 )}
               >
                 {p.name}
               </button>
             ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 rounded-xl border border-outline-variant/30 font-manrope text-sm font-bold flex items-center gap-2 hover:bg-surface-container-low transition-all active:scale-95">
            <Filter className="w-4 h-4" /> Filtrar
          </button>
          <button className="px-5 py-2.5 rounded-xl bg-primary text-white font-manrope text-sm font-bold flex items-center gap-2 shadow-xl shadow-primary/10 hover:bg-primary-container transition-all active:scale-95" onClick={() => handleOpenCreate()}>
            <Plus className="w-4 h-4" /> Novo Negócio
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white/20 backdrop-blur-md p-3 rounded-[2rem] border border-white/40 mb-10 shadow-sm max-w-lg">
        <SearchBar
          placeholder="Buscar negócio ou empresa..."
          value={query}
          onChange={setQuery}
          className="bg-transparent border-0 shadow-none focus-within:ring-0 flex-1"
        />
      </div>

      {(loadingDeals || loadingStages) && <LoadingSpinner message="Carregando funil..." />}
      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {!loadingDeals && !loadingStages && !error && (
        <div className="flex gap-6 overflow-x-auto pb-10 items-start snap-x flex-1 custom-scrollbar">
          <AnimatePresence>
            {stages.map((stage) => (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                key={stage.id}
              >
                <StageColumn 
                  stage={{ ...stage, totalValue: dealsByStage[stage.id]?.totalValue || 0 }} 
                  deals={dealsByStage[stage.id]?.deals || []} 
                  onNew={handleOpenCreate}
                  onEdit={handleOpenDetails}
                  onDelete={handleDelete}
                  onDropDeal={handleDropDeal}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          
          {stages.length === 0 && (
            <div className="w-full flex flex-col items-center justify-center py-40 border-2 border-dashed border-slate-100 rounded-[3rem]">
               <Layers className="w-12 h-12 text-slate-100 mb-4" />
               <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Configure as etapas deste funil nas configurações</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Criação/Edição */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={editingDeal?.id ? 'Editar Oportunidade' : 'Novo Negócio'}
        className="max-w-4xl"
        footer={
          <div className="flex gap-3">
            <button 
              onClick={() => setCreateModalOpen(false)}
              className="px-6 py-2 rounded-xl text-slate-500 font-bold text-sm hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              form="deal-form"
              className="px-8 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-sm shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              {editingDeal?.id ? 'Atualizar' : 'Criar Negócio'}
            </button>
          </div>
        }
      >
        <DealForm 
          initialData={editingDeal} 
          onSuccess={handleCreateSuccess} 
          onCancel={() => setCreateModalOpen(false)}
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
        />
      )}
    </div>
  );
}
