import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabase } from '@/hooks/useSupabase';
import { getDealTimeline, moveDealStage, updateDeal, deleteDeal } from '@/services/deals';
import { getTasksByDeal, toggleTaskStatus, createTask } from '@/services/tasks';
import { getNotesByDeal, createNote, updateNote, deleteNote } from '@/services/notes';
import { getAttachmentsByDeal, uploadAttachment, deleteAttachment } from '@/services/attachments';
import { PIPELINE_STAGES, formatDate, formatCurrency } from '@/constants/config';
import { LoadingSpinner, Badge, Button, Avatar } from '@/components/ui';
import { cn } from '@/lib/utils';
import { DealQualificationChecklist } from './DealQualificationChecklist';
import { calculateDealRisk } from '@/utils/dealRisk';
import { getPipelines, getPipelineStages } from '@/services/pipelines';
import { transferDealToPipeline } from '@/services/deals';
import { ChevronRight, FileText, ArrowRightLeft } from 'lucide-react';

export const DealDetailsModal = ({ isOpen, onClose, deal, onUpdate, stages }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [taskLoading, setTaskLoading] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  
  const [newTask, setNewTask] = useState({
    title: '',
    type: 'call',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '09:00',
    priority: 'medium'
  });

  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState(null);

  // Normalização para comparação estável
  const getNormalizedData = (d) => ({
    title: d?.title || '',
    value: Number(d?.value) || 0,
    qualification: d?.qualification || {}
  });

  // Edit State
  const [editData, setEditData] = useState({
    title: '',
    value: 0,
    qualification: {}
  });
  const [isSaving, setIsSaving] = useState(false);

  // Transfer State
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [availablePipelines, setAvailablePipelines] = useState([]);
  const [transferData, setTransferData] = useState({
    pipelineId: '',
    stageId: '',
    justification: ''
  });
  const [targetStages, setTargetStages] = useState([]);
  const [loadingTransfer, setLoadingTransfer] = useState(false);

  const { data: timeline, loading: loadingTimeline, refetch: refetchTimeline } = useSupabase(() => deal?.id ? getDealTimeline(deal.id) : Promise.resolve([]), [deal?.id, isOpen]);
  const { data: tasks, loading: loadingTasks, refetch: refetchTasks } = useSupabase(() => deal?.id ? getTasksByDeal(deal.id) : Promise.resolve([]), [deal?.id, isOpen]);
  const { data: notes, loading: loadingNotes, refetch: refetchNotes } = useSupabase(() => deal?.id ? getNotesByDeal(deal.id) : Promise.resolve([]), [deal?.id, isOpen]);
  const { data: attachments, loading: loadingFiles, refetch: refetchFiles } = useSupabase(() => deal?.id ? getAttachmentsByDeal(deal.id) : Promise.resolve([]), [deal?.id, isOpen]);

  const hasChanges = JSON.stringify(getNormalizedData(editData)) !== JSON.stringify(getNormalizedData(deal));

  useEffect(() => {
    if (isOpen && deal) {
      document.body.style.overflow = 'hidden';
      setEditData(getNormalizedData(deal));
    }
    else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, deal?.id]); // Usar deal.id em vez do objeto deal para estabilidade

  if (!isOpen || !deal) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDeal(deal.id, {
        ...deal,
        title: editData.title,
        value: editData.value,
        qualification: editData.qualification
      });
      if (onUpdate) onUpdate();
      setIsSaving(false);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
      setIsSaving(false);
    }
  };

  const activeStages = (stages && stages.length > 0) ? stages : PIPELINE_STAGES;
  const currentStageIndex = activeStages.findIndex(s => s.id.toLowerCase() === (deal.stage || '').toLowerCase());
  // Se não encontrar o estágio (index -1), assume que estamos no início (e o próximo é o index 1)
  const safeIndex = currentStageIndex === -1 ? 0 : currentStageIndex;
  const nextStage = activeStages[safeIndex + 1];
  const isWon = (deal.stage || '').toLowerCase() === 'won' || (deal.stage || '').toLowerCase() === 'closed_won';
  const isLost = (deal.stage || '').toLowerCase() === 'lost' || (deal.stage || '').toLowerCase() === 'closed_lost';

  const handleAdvance = async () => {
    if (!nextStage) return;
    try {
      await moveDealStage(deal.id, nextStage.id);
      if (onUpdate) onUpdate();
      refetchTimeline();
    } catch (err) {
      alert('Erro ao avançar estágio: ' + err.message);
    }
  };

  const handleMarkWon = async () => {
    try {
      await updateDeal(deal.id, { ...deal, status: 'won' });
      if (onUpdate) onUpdate();
      refetchTimeline();
      alert('Parabéns! Negócio marcado como GANHO! 🎉');
    } catch (err) {
      alert('Erro ao marcar como ganho: ' + err.message);
    }
  };

  const handleMarkLost = async () => {
    if (!confirm('Deseja marcar este negócio como PERDIDO?')) return;
    try {
      await updateDeal(deal.id, { ...deal, status: 'lost' });
      if (onUpdate) onUpdate();
      refetchTimeline();
    } catch (err) {
      alert('Erro ao marcar como perdido: ' + err.message);
    }
  };

  const handleExclude = async () => {
    if (!confirm('Tem certeza que deseja EXCLUIR este negócio permanentemente? Esta ação não pode ser desfeita.')) return;
    try {
      await deleteDeal(deal.id);
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      alert('Erro ao excluir negócio: ' + err.message);
    }
  };

  const handleOpenTransfer = async () => {
    setIsTransferOpen(true);
    try {
      const pips = await getPipelines();
      setAvailablePipelines(pips);
    } catch (err) {
      console.error('Erro ao carregar funis:', err);
    }
  };

  const handlePipelineChange = async (pipelineId) => {
    setTransferData({ ...transferData, pipelineId, stageId: '' });
    try {
      const sts = await getPipelineStages(pipelineId);
      setTargetStages(sts);
      if (sts.length > 0) {
        setTransferData(prev => ({ ...prev, pipelineId, stageId: sts[0].id }));
      }
    } catch (err) {
      console.error('Erro ao carregar etapas:', err);
    }
  };

  const executeTransfer = async () => {
    if (!transferData.pipelineId || !transferData.stageId || !transferData.justification.trim()) {
      alert('Preencha funil, etapa e justificativa.');
      return;
    }
    setLoadingTransfer(true);
    try {
      const selectedPipeline = availablePipelines.find(p => p.id === transferData.pipelineId);
      await transferDealToPipeline(
        deal.id, 
        selectedPipeline?.name || transferData.pipelineId, 
        transferData.stageId, 
        transferData.justification
      );
      if (onUpdate) onUpdate();
      setIsTransferOpen(false);
      onClose(); // Fecha o modal após transferir para forçar refresh geral
    } catch (err) {
      alert('Erro na transferência: ' + err.message);
    } finally {
      setLoadingTransfer(false);
    }
  };

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      await toggleTaskStatus(taskId, currentStatus);
      refetchTasks();
      refetchTimeline();
    } catch (err) {
      alert('Erro ao atualizar tarefa: ' + err.message);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setTaskLoading(true);
    try {
      await createTask({
        ...newTask,
        dealId: deal.id
      });
      setNewTask({ ...newTask, title: '' });
      refetchTasks();
      refetchTimeline();
    } catch (err) {
      alert('Erro ao criar tarefa: ' + err.message);
    } finally {
      setTaskLoading(false);
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNoteLoading(true);
    try {
      await createNote(deal.id, newNote);
      setNewNote('');
      refetchNotes();
      refetchTimeline();
    } catch (err) {
      alert('Erro ao criar nota: ' + err.message);
    } finally {
      setNoteLoading(true);
      setNoteLoading(false);
    }
  };

  const handleUpdateNote = async (e) => {
    e.preventDefault();
    if (!editingNote || !editingNote.content.trim()) return;
    try {
      await updateNote(editingNote.id, editingNote.content);
      setEditingNote(null);
      refetchNotes();
    } catch (err) {
      alert('Erro ao atualizar nota: ' + err.message);
    }
  };

  const handleDeleteNote = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta nota?')) return;
    try {
      await deleteNote(id);
      refetchNotes();
    } catch (err) {
      alert('Erro ao excluir nota: ' + err.message);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileLoading(true);
    try {
      await uploadAttachment(deal.id, file);
      refetchFiles();
      refetchTimeline();
    } catch (err) {
      alert('Erro ao fazer upload: ' + err.message);
    } finally {
      setFileLoading(false);
    }
  };

  const handleDeleteFile = async (id, path) => {
    if (!confirm('Excluir este arquivo permanentemente?')) return;
    try {
      await deleteAttachment(id, path);
      refetchFiles();
    } catch (err) {
      alert('Erro ao excluir arquivo: ' + err.message);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Visão Geral' },
    { id: 'timeline', label: 'Histórico' },
    { id: 'tasks',    label: 'Tarefas' },
    { id: 'notes',    label: 'Notas' },
    { id: 'archives', label: 'Arquivos' },
  ];

  const taskTypes = [
    { id: 'call',    label: 'Ligação', icon: 'call' },
    { id: 'meeting', label: 'Reunião', icon: 'groups' },
    { id: 'email',   label: 'E-mail',  icon: 'mail' },
    { id: 'visit',   label: 'Visita',  icon: 'location_on' },
  ];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-navy/20 backdrop-blur-md flex items-center justify-end font-inter">
            <motion.div 
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="w-full max-w-7xl h-[97vh] my-auto mr-4 bg-white/70 backdrop-blur-3xl rounded-[3rem] shadow-[0_32px_100px_-20px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden border border-white/40"
          >
            {/* Modal Header - Ultra Integrated */}
            <div className="p-8 pb-6 border-b border-white/20 flex justify-between items-start bg-white/40 backdrop-blur-md z-20 relative">
              <div className="flex gap-10 flex-1 mr-8">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0 border border-primary/5 shadow-sm">
                  <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>domain</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <input 
                      value={editData.title}
                      onChange={e => setEditData({...editData, title: e.target.value})}
                      className="text-3xl font-manrope font-black text-on-surface tracking-tight bg-transparent border-0 p-0 focus:ring-0 w-full hover:bg-black/5 rounded-lg transition-colors"
                    />
                    <Badge 
                      label={activeStages.find(s => s.id.toLowerCase() === (deal.stage || '').toLowerCase())?.label || deal.stage} 
                      className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/40", isWon ? 'bg-emerald-100 text-emerald-700' : isLost ? 'bg-red-100 text-red-700' : 'bg-primary-fixed text-on-primary-fixed')}
                    />
                  </div>
                  <p className="text-slate-500 font-manrope font-bold text-sm opacity-60">
                    {deal.company} • Responsável: {deal.ownerName} • Criado em {formatDate(deal.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0 items-center justify-end flex-wrap max-w-[60%]">
                {hasChanges && (
                  <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="px-4 py-2 rounded-full bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:shadow-xl active:scale-95 transition-all flex items-center gap-2"
                  >
                    {isSaving ? <LoadingSpinner size="sm" color="white" /> : <span className="material-symbols-outlined text-base">save</span>}
                    Salvar
                  </button>
                )}
                {!isLost && !isWon && (
                  <>
                    <button onClick={handleExclude} className="px-4 py-2 rounded-full bg-white/40 text-red-500 font-black text-[11px] uppercase tracking-widest hover:bg-red-50 hover:text-red-700 transition-all border border-red-100/40 shadow-sm active:scale-95">Excluir</button>
                    <button 
                      onClick={handleMarkLost} 
                      className="px-4 py-2 rounded-full bg-rose-50 text-rose-600 font-black text-[10px] uppercase tracking-widest border border-rose-100 shadow-sm hover:bg-rose-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">heart_broken</span>
                      Perder Negócio
                    </button>
                    <button 
                      onClick={handleMarkWon} 
                      className="px-6 py-2 rounded-full bg-emerald-500 text-white font-black text-[11px] uppercase tracking-[0.1em] shadow-lg shadow-emerald-200 hover:shadow-xl active:scale-95 transition-all flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">emoji_events</span>
                      Marcar Ganho
                    </button>
                  </>
                )}
                {nextStage && !isWon && (
                  <button onClick={handleAdvance} className="px-5 py-2 rounded-full bg-primary text-white font-black text-[10px] uppercase tracking-[0.15em] shadow-lg shadow-primary/20 hover:shadow-xl active:scale-[0.98] transition-all flex items-center gap-2 whitespace-nowrap">
                    Avançar
                    <span className="material-symbols-outlined text-base">trending_flat</span>
                  </button>
                )}
                <button onClick={handleOpenTransfer} className="p-2 rounded-full border border-white/60 bg-white/40 text-slate-500 hover:bg-slate-50 hover:text-primary transition-all shadow-sm flex items-center gap-2 px-3">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span className="font-black text-[10px] uppercase tracking-widest uppercase">Funil</span>
                </button>
                <button 
                  onClick={onClose} 
                  className="p-2 rounded-full border border-white/60 bg-white/40 text-slate-400 hover:bg-white hover:text-on-surface transition-all shadow-sm active:scale-95"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex bg-transparent">
              {/* Main Content (68%) */}
              <div className="w-[68%] overflow-y-auto border-r border-white/10 flex flex-col scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {/* Tabs Navigation - STICKY FIX */}
                <div className="flex gap-10 border-b border-white/10 px-12 sticky top-0 bg-white/60 backdrop-blur-2xl z-10 pt-6">
                  {tabs.map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "pb-4 font-black text-[11px] uppercase tracking-[0.2em] transition-all border-b-2",
                        activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 p-12 pt-10">
                  {activeTab === 'overview' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="grid grid-cols-2 gap-8 mb-10">
                        <div className="p-8 bg-white/40 backdrop-blur-sm rounded-[2.5rem] border border-white/40 group hover:border-primary/20 transition-all shadow-sm hover:shadow-xl">
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-4">Valor do Negócio</p>
                          <div className="flex items-center gap-2 group/edit">
                            <span className="text-2xl font-manrope font-black text-slate-400">R$</span>
                            <input 
                              type="number"
                              value={editData.value}
                              onChange={e => setEditData({...editData, value: Number(e.target.value)})}
                              className="text-4xl font-manrope font-black text-on-surface bg-transparent border-0 p-0 focus:ring-0 w-full hover:bg-black/5 rounded-lg transition-colors"
                            />
                          </div>
                          <div className="flex items-center gap-2 mt-5 text-emerald-600 font-bold text-[11px] uppercase tracking-wider">
                             <span className="material-symbols-outlined text-base">trending_up</span>
                             <span>Acima da média de fechamento</span>
                          </div>
                        </div>
                        <div className="p-8 bg-white/40 backdrop-blur-sm rounded-[2.5rem] border border-white/40 group hover:border-tertiary/20 transition-all shadow-sm hover:shadow-xl">
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-4">Saúde do Pipeline</p>
                          <div className="flex items-end gap-3">
                            <p className="text-4xl font-manrope font-black text-on-surface">92%</p>
                            <div className="flex gap-2 mb-2">
                              {[1,2,3,4].map(i => <div key={i} className={cn("w-2.5 rounded-full transition-all duration-1000 shadow-[0_0_10px_currentColor]", i<4 ? "bg-tertiary text-tertiary" : "bg-slate-200 text-slate-200")} style={{ height: `${20 + i*15}%` }} />)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <h4 className="text-xl font-manrope font-black text-on-surface tracking-tight">Resumo Executivo</h4>
                        <p className="text-slate-600 leading-relaxed font-inter opacity-80 text-base">
                          O cliente {deal.company} demonstrou forte interesse em centralizar sua infraestrutura de dados. O foco principal está na latência e integridade durante a migração. Atualmente em fase de { (deal.stage || '').toLowerCase() === 'negotiation' ? 'negociação final de termos' : 'validação de requisitos técnicos' }.
                        </p>
                      </div>

                      <DealQualificationChecklist 
                        responses={editData.qualification}
                        onChange={responses => setEditData({...editData, qualification: responses})}
                      />
                    </div>
                  )}

                  {activeTab === 'timeline' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                      <h4 className="text-xl font-manrope font-black text-on-surface flex justify-between items-center mb-8">
                        Histórico de Atividades
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{timeline?.length || 0} interações registradas</span>
                      </h4>
                      {loadingTimeline ? <LoadingSpinner /> : (
                        <div className="relative pl-10 space-y-10 before:absolute before:inset-0 before:left-[11px] before:w-0.5 before:bg-white/20 pb-10">
                          {timeline?.map((event) => {
                            const details = (() => {
                              switch (event.type) {
                                case 'stage_change': 
                                  return { label: 'Mudança de Estágio', icon: 'troubleshoot', color: 'text-violet-500', dot: 'bg-violet-500' };
                                case 'task_created':
                                  return { label: 'Tarefa Criada', icon: 'add_task', color: 'text-emerald-500', dot: 'bg-emerald-500' };
                                case 'task_status':
                                  return { label: 'Tarefa', icon: 'task_alt', color: 'text-teal-600', dot: 'bg-teal-600' };
                                case 'task_updated':
                                  return { label: 'Tarefa Atualizada', icon: 'edit_calendar', color: 'text-sky-500', dot: 'bg-sky-500' };
                                case 'note':
                                  return { label: 'Anotação', icon: 'sticky_note_2', color: 'text-amber-500', dot: 'bg-amber-500' };
                                case 'attachment':
                                  return { label: 'Arquivo', icon: 'attach_file', color: 'text-indigo-500', dot: 'bg-indigo-500' };
                                case 'created':
                                  return { label: 'Novo Negócio', icon: 'new_releases', color: 'text-primary', dot: 'bg-primary' };
                                default:
                                  return { label: 'Evento', icon: 'event', color: 'text-slate-400', dot: 'bg-slate-400' };
                              }
                            })();

                            return (
                              <div key={event.id} className="relative group">
                                <div className={cn("absolute -left-[32px] top-1.5 w-5 h-5 rounded-full border-4 border-white/60 shadow-xl group-hover:scale-125 transition-transform", details.dot)} />
                                <div className="p-6 bg-white/40 backdrop-blur-sm rounded-3xl border border-white/30 shadow-sm group-hover:shadow-xl transition-all">
                                  <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                       <span className={cn("material-symbols-outlined text-lg", details.color)}>{details.icon}</span>
                                       <span className={cn("text-[10px] font-extrabold uppercase tracking-widest", details.color)}>{details.label}</span>
                                       <div className="w-1 h-1 rounded-full bg-slate-300 mx-1" />
                                       <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{formatDate(event.created_at)}</span>
                                    </div>
                                  </div>
                                  <p className="text-base text-on-surface font-semibold leading-relaxed opacity-90">{event.description}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'tasks' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
                       <h4 className="text-xl font-manrope font-black text-on-surface flex justify-between items-center mb-6">
                        Tarefas Estratégicas
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{tasks?.length || 0} ações pendentes</span>
                      </h4>

                      {/* Quick Task Bar - Ultra Integrated */}
                      <div className="mb-10 p-2 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner group">
                        <form onSubmit={handleCreateTask} className="flex flex-col gap-3">
                          <div className="flex items-center gap-3 px-4 py-1">
                            <span className="material-symbols-outlined text-primary/40">add_task</span>
                            <input 
                              required
                              value={newTask.title}
                              onChange={e => setNewTask({...newTask, title: e.target.value})}
                              placeholder="O que precisa ser feito agora?"
                              className="flex-1 bg-transparent border-0 focus:ring-0 font-manrope font-bold text-on-surface placeholder:text-slate-300 text-base"
                            />
                            
                            <div className="flex items-center gap-2 border-l border-slate-200 pl-4 py-1">
                              <div className="relative group/date">
                                <div className="cursor-pointer hover:bg-slate-200 p-2 rounded-lg flex items-center gap-2 transition-colors relative">
                                  <span className="material-symbols-outlined text-slate-400 text-xl pointer-events-none">calendar_month</span>
                                  <input 
                                    type="date" 
                                    value={newTask.dueDate} 
                                    onChange={e => setNewTask({...newTask, dueDate: e.target.value})} 
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" 
                                  />
                                </div>
                              </div>
                              <div className="relative group/time">
                                <div className="cursor-pointer hover:bg-slate-200 p-2 rounded-lg flex items-center gap-2 transition-colors relative">
                                  <span className="material-symbols-outlined text-slate-400 text-xl pointer-events-none">schedule</span>
                                  <input 
                                    type="time" 
                                    value={newTask.dueTime} 
                                    onChange={e => setNewTask({...newTask, dueTime: e.target.value})} 
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full" 
                                  />
                                </div>
                              </div>
                              <button 
                                type="submit" 
                                disabled={taskLoading || !newTask.title.trim()}
                                className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-30 transition-all font-bold"
                              >
                                {taskLoading ? <LoadingSpinner size="sm" color="white" /> : <span className="material-symbols-outlined">send</span>}
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-2 px-4 pb-2">
                             {taskTypes.map(t => (
                               <button
                                 key={t.id}
                                 type="button"
                                 onClick={() => setNewTask({...newTask, type: t.id})}
                                 className={cn(
                                   "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all border",
                                   newTask.type === t.id 
                                    ? "bg-primary/10 border-primary/20 text-primary shadow-sm" 
                                    : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                                 )}
                               >
                                 <span className="material-symbols-outlined text-sm">{t.icon}</span>
                                 {t.label}
                               </button>
                             ))}
                          </div>
                        </form>
                      </div>

                      {loadingTasks ? <LoadingSpinner /> : (
                        <div className="space-y-4 mb-10">
                          {tasks?.map(task => {
                             const typeInfo = taskTypes.find(t => t.id === task.type) || taskTypes[0];
                             return (
                               <div key={task.id} className="flex items-center gap-6 p-6 bg-white/40 backdrop-blur-sm rounded-[2.5rem] border border-white/40 shadow-sm hover:shadow-xl transition-all text-left group/item relative overflow-hidden">
                                 <button onClick={() => handleToggleTask(task.id, task.status)} className={cn("w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0", task.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 bg-slate-50 hover:border-primary/30')}>
                                   {task.status === 'completed' && <span className="material-symbols-outlined text-base font-bold">check</span>}
                                 </button>
                                 <div className="flex-1 min-w-0">
                                   <div className="flex items-center gap-3 mb-1">
                                      <span className="material-symbols-outlined text-primary/40 text-lg shrink-0">{typeInfo.icon}</span>
                                      <p className={cn("text-base font-bold truncate", task.status === 'completed' ? "text-slate-300 line-through font-medium" : "text-on-surface")}>{task.title}</p>
                                   </div>
                                   <div className="flex items-center gap-3">
                                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md">{typeInfo.label}</span>
                                      <div className="w-1 h-1 rounded-full bg-slate-200" />
                                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{formatDate(task.due_date)} • {task.due_time}</span>
                                   </div>
                                 </div>
                               </div>
                             );
                          })}
                          {tasks?.length === 0 && (
                            <div className="py-20 flex flex-col items-center opacity-30 grayscale cursor-default">
                               <span className="material-symbols-outlined text-7xl mb-6">dynamic_feed</span>
                               <p className="font-manrope font-black text-2xl uppercase tracking-widest text-slate-400">Sem Ações Pendentes</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'notes' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                      <h4 className="text-xl font-manrope font-black text-on-surface flex justify-between items-center mb-6">
                        Notas & Insights
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{notes?.length || 0} registros</span>
                      </h4>

                      {/* New Note Input */}
                      <form onSubmit={handleCreateNote} className="mb-8">
                        <textarea
                          placeholder="Adicione um insight ou nota importante..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="w-full h-32 p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all font-inter text-base text-on-surface placeholder:text-slate-300 resize-none shadow-inner"
                        />
                        <div className="flex justify-end mt-4">
                          <Button 
                            type="submit" 
                            disabled={noteLoading || !newNote.trim()} 
                            variant="primary" 
                            className="px-8 shadow-lg shadow-primary/20 rounded-2xl"
                          >
                            {noteLoading ? <LoadingSpinner size="sm" color="white" /> : 'Salvar Nota'}
                          </Button>
                        </div>
                      </form>

                      {loadingNotes ? <LoadingSpinner /> : (
                        <div className="space-y-4">
                          {notes?.map((note) => (
                            <div key={note.id} className="p-6 bg-white/40 backdrop-blur-sm rounded-3xl border border-white/40 shadow-sm group hover:border-primary/20 transition-all">
                              {editingNote?.id === note.id ? (
                                <form onSubmit={handleUpdateNote}>
                                  <textarea
                                    value={editingNote.content}
                                    onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl mb-3 focus:ring-1 focus:ring-primary h-24"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button type="button" variant="outline" size="sm" onClick={() => setEditingNote(null)}>Cancelar</Button>
                                    <Button type="submit" variant="primary" size="sm">Atualizar</Button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  <div className="flex justify-between items-start mb-4">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{formatDate(note.created_at)}</span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => setEditingNote(note)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined text-lg">edit</span>
                                      </button>
                                      <button onClick={() => handleDeleteNote(note.id)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-error transition-colors">
                                        <span className="material-symbols-outlined text-lg">delete</span>
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-on-surface text-base font-inter leading-relaxed opacity-90 whitespace-pre-wrap">{note.content}</p>
                                </>
                              )}
                            </div>
                          ))}
                          {notes?.length === 0 && (
                            <div className="text-center py-10 opacity-40">
                              <span className="material-symbols-outlined text-4xl mb-2">sticky_note_2</span>
                              <p className="text-sm font-bold uppercase tracking-widest">Sem notas registradas</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'archives' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                       <h4 className="text-xl font-manrope font-black text-on-surface flex justify-between items-center mb-6">
                        Arquivos & Documentos
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{attachments?.length || 0} itens vinculados</span>
                      </h4>

                      {/* Upload Area */}
                      <div className="relative group">
                        <label className={cn(
                          "flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-[2.5rem] cursor-pointer transition-all",
                          fileLoading ? "border-primary/20 bg-primary/5" : "border-slate-200 bg-slate-50 hover:border-primary/40 hover:bg-primary/5"
                        )}>
                          {fileLoading ? (
                            <LoadingSpinner />
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 group-hover:text-primary/60 transition-colors">cloud_upload</span>
                              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Arraste ou clique para upload</p>
                              <p className="text-[10px] text-slate-400 mt-1">Imagens, PDF, Word, Excel, PPT</p>
                            </>
                          )}
                          <input type="file" className="hidden" onChange={handleFileUpload} disabled={fileLoading} />
                        </label>
                      </div>

                      {loadingFiles ? <LoadingSpinner /> : (
                        <div className="grid grid-cols-2 gap-4 pb-10">
                          {attachments?.map((file) => {
                            const isImage = file.file_type?.startsWith('image/');
                            let icon = 'description';
                            if (file.file_type?.includes('pdf')) icon = 'picture_as_pdf';
                            if (file.file_type?.includes('sheet') || file.name.endsWith('.xlsx')) icon = 'table_chart';
                            if (file.file_type?.includes('presentation') || file.name.endsWith('.pptx')) icon = 'slideshow';
                            
                            return (
                              <div key={file.id} className="flex items-center gap-4 p-4 bg-white/40 backdrop-blur-sm rounded-3xl border border-white/40 shadow-sm group hover:border-primary/20 transition-all relative">
                                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
                                  {isImage ? (
                                    <img src={file.url} alt="" className="w-full h-full object-cover rounded-2xl" />
                                  ) : (
                                    <span className="material-symbols-outlined text-2xl text-primary/60">{icon}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 pr-10">
                                  <p className="text-sm font-bold text-on-surface truncate pr-2">{file.name}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                                <div className="absolute right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-primary/10 rounded-xl text-slate-400 hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-lg">download</span>
                                  </a>
                                  <button onClick={() => handleDeleteFile(file.id, file.storage_path)} className="p-2 hover:bg-error/10 rounded-xl text-slate-400 hover:text-error transition-colors">
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Insights (32%) - Oracle Style AI */}
              <div className="w-[32%] p-10 bg-white/20 backdrop-blur-md overflow-y-auto space-y-8 h-full scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {(() => {
                  const riskInfo = calculateDealRisk(editData.qualification);
                  const hasData = Object.keys(editData.qualification || {}).length > 0;
                  
                  let headline = "Qualificação Pendente";
                  let description = "Este negócio ainda não possui dados de qualificação básicos. Preencha o questionário ao lado para liberar a análise estratégica.";
                  let nextStep = "Preencher questionário";
                  let cardStyle = "from-slate-400/20 to-slate-200/10 border-white/20";
                  let iconColor = "text-slate-400";

                  if (hasData) {
                    if (riskInfo?.risk === 'high') {
                      headline = "Atenção: Risco Detectado";
                      const missingParts = [];
                      if (!editData.qualification.budget) missingParts.push("orçamento");
                      if (!editData.qualification.decisionMaker) missingParts.push("decisor");
                      if (!editData.qualification.urgency) missingParts.push("urgência");
                      
                      description = `Identificamos lacunas críticas em: ${missingParts.join(', ')}. A probabilidade de fechamento é baixa sem validar estes pilares essenciais.`;
                      nextStep = !editData.qualification.decisionMaker ? "Agendar com Decisor" : "Validar Orçamento";
                      cardStyle = "from-error/20 to-error/5 border-error/20";
                      iconColor = "text-error";
                    } else if (riskInfo?.risk === 'medium') {
                      headline = "Ciclo em Evolução";
                      description = "O negócio demonstra tração, mas possui pontos de fricção parcial. Recomendamos manter o engajamento próximo para fechar os dados restantes.";
                      nextStep = "Confirmar Próximos Passos";
                      cardStyle = "from-amber-500/20 to-amber-200/5 border-amber-200/20";
                      iconColor = "text-amber-500";
                    } else {
                      headline = "Excelente Saúde";
                      description = "Padrões de conversão sólidos detectados! Os pilares de orçamento e decisão estão validados, favorecendo um fechamento acelerado.";
                      nextStep = "Gerar Proposta/Minuta";
                      cardStyle = "from-primary/20 to-primary-container/10 border-white/40";
                      iconColor = "text-primary";
                    }
                  }

                  return (
                    <>
                      <div className={cn("p-8 rounded-[3rem] bg-gradient-to-br border relative overflow-hidden shadow-2xl transition-all cursor-default group/oracle", cardStyle)}>
                        <div className={cn("flex items-center gap-2 mb-6 relative z-10 transition-colors", iconColor)}>
                          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                          <span className="font-extrabold text-[10px] uppercase tracking-[0.3em]">Oracle Insight IA</span>
                        </div>
                        <h5 className="font-manrope font-black text-on-surface mb-4 italic relative z-10 text-xl tracking-tight leading-tight">"{headline}"</h5>
                        <p className="text-sm text-slate-600 leading-[1.8] relative z-10 opacity-90 font-inter">
                          {description}
                        </p>
                        <div className="mt-8 relative z-10">
                          <div className="p-5 bg-white/70 backdrop-blur-xl rounded-2xl border border-white/80 shadow-sm group">
                            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-2 opacity-60">Próximo Passo Estratégico</p>
                            <p className={cn("text-xs font-black group-hover:underline", iconColor)}>{nextStep}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4">
                        <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-2 opacity-60">Stakeholders do Negócio</h5>
                        <div className="flex items-center gap-4 p-5 bg-white/40 backdrop-blur-sm rounded-[2.5rem] border border-white/40 shadow-sm hover:shadow-2xl transition-all group">
                          <img alt="Ficha" className="w-12 h-12 rounded-full border-4 border-white/60 shadow-md transition-transform group-hover:rotate-6" src={`https://ui-avatars.com/api/?name=${encodeURIComponent(deal.ownerName)}&background=003ec7&color=fff`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-manrope font-black text-on-surface truncate tracking-tight">{deal.ownerName}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-bold opacity-60">Lead Sales Strategist</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-8 rounded-[3rem] bg-white/40 backdrop-blur-sm border border-white/40 mt-4 shadow-sm hover:shadow-2xl transition-all cursor-default overflow-hidden relative group/matriz">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-full -mr-10 -mt-10 opacity-50 transition-transform group-hover/matriz:scale-150 duration-700" />
                        <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-8 relative">Matriz de Risco</h5>
                        <div className="space-y-6 relative">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                              <span className="text-slate-400">Integridade dos Dados</span>
                              <span className={cn(hasData ? "text-primary" : "text-slate-300")}>
                                {hasData ? "VALIDADO / 100%" : "PENDENTE / 0%"}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all duration-1000", hasData ? "bg-primary w-full" : "bg-slate-200 w-0")} />
                            </div>
                          </div>
                          
                          <div className="space-y-3 pt-2">
                             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                              <span className="text-slate-400">Confirmação Orçamentária</span>
                              <span className={cn(editData.qualification.budget ? "text-emerald-500" : "text-error")}>
                                {editData.qualification.budget ? "OK / VALIDADO" : "PENDENTE / ALERTA"}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all duration-1000", editData.qualification.budget ? "bg-emerald-500 w-full" : "bg-error w-1/4")} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

            </div>
          </motion.div>

          {/* Transfer Overlay */}
          <AnimatePresence>
            {isTransferOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[110] bg-navy/40 backdrop-blur-xl flex items-center justify-center p-8"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-xl bg-white rounded-[3rem] p-12 shadow-2xl space-y-8"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-2xl font-manrope font-black text-on-surface tracking-tight">Transferir Negócio</h4>
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Mudar de Funil Estratégico</p>
                    </div>
                    <button onClick={() => setIsTransferOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Funil de Destino</label>
                       <select 
                         value={transferData.pipelineId}
                         onChange={(e) => handlePipelineChange(e.target.value)}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-base font-black text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                       >
                         <option value="">Selecione o Funil...</option>
                         {availablePipelines.map(p => (
                           <option key={p.id} value={p.id}>{p.name}</option>
                         ))}
                       </select>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estágio Inicial no Novo Funil</label>
                       <select 
                         value={transferData.stageId}
                         onChange={(e) => setTransferData({ ...transferData, stageId: e.target.value })}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-base font-black text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                         disabled={!transferData.pipelineId}
                       >
                         <option value="">Aguardando seleção de funil...</option>
                         {targetStages.map(s => (
                           <option key={s.id} value={s.id}>{s.label}</option>
                         ))}
                       </select>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Justificativa da Transferência</label>
                       <textarea 
                         value={transferData.justification}
                         onChange={(e) => setTransferData({ ...transferData, justification: e.target.value })}
                         placeholder="Por que este negócio está mudando de funil? Esta nota será salva no histórico."
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-base font-bold text-on-surface focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[120px] resize-none"
                       />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                     <button 
                       onClick={() => setIsTransferOpen(false)}
                       className="flex-1 py-4 rounded-2xl border border-slate-200 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all font-manrope"
                     >
                       Cancelar
                     </button>
                     <button 
                       onClick={executeTransfer}
                       disabled={loadingTransfer || !transferData.stageId || !transferData.justification.trim()}
                       className="flex-1 py-4 rounded-2xl bg-primary text-white font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 transition-all font-manrope flex items-center justify-center gap-3"
                     >
                       {loadingTransfer ? <LoadingSpinner size="sm" color="white" /> : (
                         <>
                           <ArrowRightLeft className="w-4 h-4" />
                           Confirmar Transferência
                         </>
                       )}
                     </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  , document.body);
};
