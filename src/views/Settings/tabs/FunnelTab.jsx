import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, LoadingSpinner } from '@/components/ui';
import { getPipelines, getPipelineStages, upsertPipeline, savePipelineStages, deletePipeline } from '@/services/pipelines';
import { Plus, Trash2, GripVertical, Save, Edit3, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const FunnelTab = ({ isAdmin }) => {
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [stages, setStages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  useEffect(() => {
    loadPipelines();
  }, []);

  async function loadPipelines() {
    try {
      setLoading(true);
      const data = await getPipelines();
      setPipelines(data);
      if (data.length > 0) {
        handleSelectPipeline(data[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPipeline(pipeline) {
    setSelectedPipeline(pipeline);
    setTempTitle(pipeline.name);
    try {
      const stageData = await getPipelineStages(pipeline.id);
      setStages(stageData);
    } catch (error) {
      console.error(error);
    }
  }

  const COLORS = [
    'bg-slate-500', 'bg-blue-500', 'bg-emerald-500', 
    'bg-amber-500', 'bg-violet-500', 'bg-red-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-sky-500'
  ];

  const addStage = () => {
    const newStage = {
      id: `stage_${Date.now()}`,
      label: 'Nova Etapa',
      color: COLORS[0],
      sort_order: (stages.length + 1) * 10
    };
    setStages([...stages, newStage]);
  };

  const removeStage = (id) => {
    setStages(stages.filter(s => s.id !== id));
  };

  const updateStage = (id, field, value) => {
    setStages(stages.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  async function handleCreatePipeline() {
    try {
      const name = prompt('Nome do novo funil:');
      if (!name) return;
      const newPip = await upsertPipeline({ name });
      setPipelines([...pipelines, newPip]);
      handleSelectPipeline(newPip);
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleSaveAll() {
    try {
      setSaving(true);
      // 1. Update Title if changed
      if (tempTitle !== selectedPipeline.name) {
        await upsertPipeline({ ...selectedPipeline, name: tempTitle });
      }
      
      // 2. Save Stages
      await savePipelineStages(selectedPipeline.id, stages);
      alert('Configurações salvas!');
      loadPipelines();
    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-20 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="flex flex-col lg:flex-row gap-10 pb-20">
      
      {/* Sidebar de Funis */}
      <aside className="w-full lg:w-64 shrink-0 space-y-4">
        <div className="flex justify-between items-center mb-4 px-2">
           <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meus Funis</h4>
           {isAdmin && (
             <button onClick={handleCreatePipeline} className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all">
               <Plus size={16} />
             </button>
           )}
        </div>
        <div className="space-y-2">
          {pipelines.map(p => (
            <button
              key={p.id}
              onClick={() => handleSelectPipeline(p)}
              className={cn(
                "w-full text-left px-5 py-4 rounded-2xl text-sm font-bold transition-all",
                selectedPipeline?.id === p.id 
                  ? "bg-white text-primary shadow-lg border border-slate-100" 
                  : "text-slate-400 hover:text-on-surface hover:bg-white/40"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </aside>

      {/* Editor de Estágios */}
      <main className="flex-1 min-w-0">
        {selectedPipeline ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            
            {/* Header do Funil */}
            <div className="flex justify-between items-center bg-white/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/60 shadow-xl">
               <div className="flex items-center gap-4 group">
                  {editingTitle ? (
                    <input 
                      autoFocus
                      className="bg-white/80 border border-primary/20 rounded-xl px-4 py-2 text-xl font-black text-primary focus:outline-none focus:ring-4 focus:ring-primary/5"
                      value={tempTitle}
                      onChange={e => setTempTitle(e.target.value)}
                      onBlur={() => setEditingTitle(false)}
                      onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
                    />
                  ) : (
                    <h3 className="text-2xl font-manrope font-black text-on-surface tracking-tighter flex items-center gap-4">
                      {tempTitle}
                      {isAdmin && <Edit3 size={18} className="text-slate-300 opacity-0 group-hover:opacity-100 cursor-pointer hover:text-primary transition-all" onClick={() => setEditingTitle(true)} />}
                    </h3>
                  )}
               </div>
               {isAdmin && (
                 <div className="flex gap-3">
                    <Button variant="outline" onClick={() => {
                        if(confirm('Excluir este funil inteira? Todos os negócios ligados a ele ficarão sem estágio.')) {
                            deletePipeline(selectedPipeline.id).then(() => loadPipelines());
                        }
                    }} className="border-error/20 text-error hover:bg-error/10">Excluir</Button>
                    <Button variant="primary" disabled={saving} onClick={handleSaveAll} className="px-8 shadow-xl shadow-primary/20">
                      {saving ? <LoadingSpinner size="sm" color="white" /> : 'Salvar Funil'}
                    </Button>
                 </div>
               )}
            </div>

            {/* Listagem de Etapas */}
            <section className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Etapas do Processo</p>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={addStage} className="h-8 rounded-lg gap-2">
                    <Plus size={14} /> Adicionar Etapa
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                 <AnimatePresence>
                   {stages.map((stage, idx) => (
                     <motion.div
                       layout
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, scale: 0.95 }}
                       key={stage.id}
                       className="group flex items-center gap-4 bg-white p-4 pr-6 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all hover:scale-[1.01]"
                     >
                       <div className="cursor-grab text-slate-200 group-hover:text-slate-400 p-2">
                         <GripVertical size={20} />
                       </div>
                       
                       <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", stage.color)}>
                         <span className="text-white font-black text-sm">{idx + 1}</span>
                       </div>

                       <div className="flex-1">
                          <input 
                            disabled={!isAdmin}
                            className="w-full bg-transparent border-0 font-bold text-sm text-on-surface focus:outline-none focus:ring-0 placeholder:opacity-30"
                            value={stage.label}
                            onChange={e => updateStage(stage.id, 'label', e.target.value)}
                            placeholder="Nome da etapa..."
                          />
                       </div>

                       {/* Seletor de Cores */}
                       {isAdmin && (
                         <div className="flex gap-1.5">
                            {COLORS.slice(0, 6).map(c => (
                              <button 
                                key={c}
                                onClick={() => updateStage(stage.id, 'color', c)}
                                className={cn(
                                  "w-5 h-5 rounded-full border-2 transition-all",
                                  c,
                                  stage.color === c ? "border-on-surface ring-2 ring-slate-100 scale-125" : "border-transparent opacity-40 hover:opacity-100"
                                )}
                              />
                            ))}
                         </div>
                       )}

                       {isAdmin && (
                         <button 
                            onClick={() => removeStage(stage.id)}
                            className="ml-4 p-2.5 rounded-xl text-slate-200 hover:text-error hover:bg-error/5 transition-all opacity-0 group-hover:opacity-100"
                          >
                           <Trash2 size={18} />
                         </button>
                       )}
                     </motion.div>
                   ))}
                 </AnimatePresence>
              </div>

              {stages.length === 0 && (
                <div className="py-20 text-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100">
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Nenhuma etapa configurada</p>
                </div>
              )}
            </section>

          </div>
        ) : (
          <div className="h-full flex items-center justify-center py-40 bg-white/40 rounded-[3rem] border border-white/60">
             <p className="text-slate-400 font-bold uppercase tracking-widest">Selecione um funil para editar</p>
          </div>
        )}
      </main>

    </div>
  );
};
