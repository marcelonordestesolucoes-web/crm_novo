// src/views/Campaigns/CampaignsView.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  FileSpreadsheet,
  ListChecks,
  MoreVertical,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Timer,
  Trash2,
  Users
} from 'lucide-react';
import { Badge, Button, GlassCard, LoadingSpinner, PageHeader } from '@/components/ui';
import {
  cancelCampaign,
  deleteCampaign,
  getCampaigns,
  pauseCampaignWorker,
  processCampaignQueue,
  resumeCampaignWorker,
  startCampaignWorker
} from '@/services/campaigns';
import CampaignWizard from './CampaignWizard';
import { useSupabase } from '@/hooks/useSupabase';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const statusLabels = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  running: 'Em execucao',
  paused: 'Pausada',
  completed: 'Finalizada',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  sending: 'Legado'
};

const statusClasses = {
  draft: 'bg-slate-100 text-slate-500',
  scheduled: 'bg-blue-50 text-blue-600',
  running: 'bg-primary text-white',
  paused: 'bg-amber-50 text-amber-600',
  completed: 'bg-emerald-50 text-emerald-600',
  failed: 'bg-rose-50 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-400',
  sending: 'bg-amber-50 text-amber-600'
};

const statusAccentClasses = {
  draft: 'from-slate-500/20 to-slate-900/10 text-slate-500 border-slate-200',
  scheduled: 'from-blue-500/20 to-cyan-500/10 text-blue-600 border-blue-100',
  running: 'from-primary/25 to-cyan-500/10 text-primary border-primary/20',
  paused: 'from-amber-500/25 to-orange-500/10 text-amber-600 border-amber-100',
  completed: 'from-emerald-500/25 to-teal-500/10 text-emerald-600 border-emerald-100',
  failed: 'from-rose-500/25 to-red-500/10 text-rose-600 border-rose-100',
  cancelled: 'from-slate-400/20 to-slate-900/5 text-slate-400 border-slate-200',
  sending: 'from-amber-500/25 to-orange-500/10 text-amber-600 border-amber-100'
};

function getCampaignStats(campaign) {
  const queueTotal = Number(campaign.computed?.total_queue || 0);
  const eligible = Number(campaign.total_eligible || campaign.computed?.total_eligible || 0);
  const sent = Number(campaign.total_sent || campaign.computed?.sent || 0);
  const delivered = Number(campaign.total_delivered || campaign.computed?.delivered || 0);
  const failed = Number(campaign.total_failed || campaign.computed?.failed || 0);
  const skipped = Number(campaign.total_skipped || campaign.computed?.skipped || 0);
  const blocked = Number(campaign.total_blocked || campaign.computed?.blocked || 0);
  const processed = Math.min(queueTotal || eligible, sent + failed + skipped + blocked);
  const base = queueTotal || eligible;
  const progress = base > 0 ? Math.min(100, Math.round((processed / base) * 100)) : 0;

  return { queueTotal, eligible, sent, delivered, failed, skipped, blocked, processed, progress };
}

function formatDateTime(value) {
  if (!value) return 'Sem agenda';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function CampaignsView() {
  const { data: campaigns, loading, refetch } = useSupabase(getCampaigns);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [campaignToEdit, setCampaignToEdit] = useState(null);
  const refetchTimerRef = useRef(null);

  const scheduleRefetch = () => {
    window.clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = window.setTimeout(() => {
      refetch?.();
    }, 350);
  };

  useEffect(() => {
    const channel = supabase
      .channel('campaigns-dashboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        scheduleRefetch
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_dispatch_queue' },
        scheduleRefetch
      )
      .subscribe();

    return () => {
      window.clearTimeout(refetchTimerRef.current);
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch]);

  useEffect(() => {
    const hasRunningCampaign = (campaigns || []).some((campaign) => campaign.status === 'running');
    if (!hasRunningCampaign) return undefined;

    const interval = window.setInterval(() => {
      refetch?.();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [campaigns, refetch]);

  const filteredCampaigns = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return (campaigns || []).filter((campaign) => {
      const matchesSearch =
        campaign.name?.toLowerCase().includes(query) ||
        campaign.description?.toLowerCase().includes(query) ||
        campaign.message_template?.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [campaigns, searchQuery, statusFilter]);

  const metrics = useMemo(() => {
    const rows = campaigns || [];
    const totalSent = rows.reduce((sum, campaign) => sum + Number(campaign.total_sent || campaign.computed?.sent || 0), 0);
    const totalDelivered = rows.reduce((sum, campaign) => sum + Number(campaign.total_delivered || campaign.computed?.delivered || 0), 0);
    const totalFailed = rows.reduce((sum, campaign) => sum + Number(campaign.total_failed || campaign.computed?.failed || 0), 0);
    const totalEligible = rows.reduce((sum, campaign) => sum + Number(campaign.total_eligible || campaign.computed?.total_eligible || 0), 0);
    const running = rows.filter((campaign) => campaign.status === 'running').length;
    const paused = rows.filter((campaign) => campaign.status === 'paused').length;
    const nextScheduled = rows
      .filter((campaign) => campaign.next_dispatch_at || campaign.schedule_at)
      .sort((a, b) => new Date(a.next_dispatch_at || a.schedule_at) - new Date(b.next_dispatch_at || b.schedule_at))[0];

    return {
      totalSent,
      running,
      totalEligible,
      deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
      errorRate: totalSent + totalFailed > 0 ? Math.round((totalFailed / (totalSent + totalFailed)) * 100) : 0,
      paused,
      nextDispatch: nextScheduled
        ? new Date(nextScheduled.next_dispatch_at || nextScheduled.schedule_at).toLocaleString('pt-BR')
        : 'Sem agenda'
    };
  }, [campaigns]);

  const runWorkerAction = async (campaign, action) => {
    try {
      setActionLoading(`${campaign.id}:${action}`);

      if (action === 'start') {
        await startCampaignWorker(campaign.id);
      } else if (action === 'resume') {
        await resumeCampaignWorker(campaign.id);
      } else if (action === 'pause') {
        await pauseCampaignWorker(campaign.id);
      } else {
        await processCampaignQueue(campaign.id);
      }

      await refetch?.();
    } catch (error) {
      alert(error.message || 'Falha ao executar worker da campanha.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditCampaign = (campaign) => {
    if (['running', 'completed'].includes(campaign.status)) {
      alert('Campanhas em execucao ou finalizadas nao podem ser editadas.');
      return;
    }

    setCampaignToEdit(campaign);
    setIsWizardOpen(true);
    setOpenMenuId(null);
  };

  const handleDeleteCampaign = async (campaign) => {
    if (campaign.status === 'running') {
      alert('Pause a campanha antes de excluir.');
      return;
    }

    const confirmed = window.confirm(`Excluir a campanha "${campaign.name}"? Essa acao remove fila, contatos importados e logs da campanha.`);
    if (!confirmed) return;

    try {
      setActionLoading(`${campaign.id}:delete`);
      await deleteCampaign(campaign.id);
      setOpenMenuId(null);
      await refetch?.();
    } catch (error) {
      alert(error.message || 'Falha ao excluir campanha.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelCampaign = async (campaign) => {
    if (['completed', 'cancelled'].includes(campaign.status)) return;

    const confirmed = window.confirm(`Cancelar a campanha "${campaign.name}"? Itens ainda pendentes da fila serao marcados como cancelados.`);
    if (!confirmed) return;

    try {
      setActionLoading(`${campaign.id}:cancel`);
      await cancelCampaign(campaign.id);
      setOpenMenuId(null);
      await refetch?.();
    } catch (error) {
      alert(error.message || 'Falha ao cancelar campanha.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNewCampaign = () => {
    setCampaignToEdit(null);
    setIsWizardOpen(true);
  };

  return (
    <div className="flex flex-col gap-y-10 pb-16 pt-0 -mt-10 animate-in fade-in duration-700 relative z-0">
      <div className="absolute top-0 left-1/4 w-[800px] h-[600px] bg-gradient-to-br from-primary/20 to-cyan-400/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <PageHeader
          title="Campanhas Blindadas"
          subtitle="Fila segura via Edge Function e scheduler automatico. O navegador apenas controla."
        />
        <Button
          onClick={handleNewCampaign}
          className="bg-primary text-white px-8 py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          Nova Campanha
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <MetricCard icon={Send} label="Total enviado" value={metrics.totalSent} note="Enviado pelo worker" />
        <MetricCard icon={Activity} label="Em processamento" value={metrics.running} note="Scheduler automatico ativo" tone="warning" />
        <MetricCard icon={Users} label="Contatos elegiveis" value={metrics.totalEligible} note="Base pronta para fila" tone="success" />
        <MetricCard icon={AlertCircle} label="Taxa de erro" value={`${metrics.errorRate}%`} note={`${metrics.deliveryRate}% entrega registrada`} tone="danger" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <GlassCard className="p-6 border-white/20 bg-slate-950/[0.03]">
          <div className="flex w-full flex-col items-center justify-center text-center gap-2">
            <div className="mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-amber-500 shadow-inner border border-white/35 backdrop-blur-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="w-full">
              <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Campanhas pausadas</p>
              <p className="text-2xl font-manrope font-black text-slate-900">{metrics.paused}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-6 md:col-span-2 border-white/20 bg-slate-950/[0.03]">
          <div className="flex w-full flex-col items-center justify-center text-center gap-2">
            <div className="mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/25 text-primary shadow-inner border border-white/35 backdrop-blur-xl">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div className="w-full">
              <p className="text-xs font-black text-slate-700 uppercase tracking-widest">Proximo disparo</p>
              <p className="text-2xl font-manrope font-black text-slate-900">{metrics.nextDispatch}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-0 overflow-visible border border-white/50 ring-1 ring-slate-900/10 shadow-2xl shadow-slate-900/10">
        <div className="p-8 border-b border-white/10 flex flex-col xl:flex-row xl:items-center justify-between gap-5 bg-slate-950/[0.04] rounded-t-[inherit]">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                <ListChecks className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-manrope font-black text-slate-950">Operação de Campanhas</h3>
                <p className="text-sm font-bold text-slate-950 mt-1">Fila segura, limites ativos e acompanhamento em tempo real.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar campanha..."
                className="w-full bg-white/80 border border-slate-300 rounded-full py-3 pl-12 pr-6 text-base font-bold text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 ring-primary/20 transition-all"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="bg-white border border-slate-300 rounded-full py-3 px-5 text-sm font-black uppercase tracking-widest text-slate-700 focus:outline-none"
            >
              <option value="all">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="scheduled">Agendada</option>
              <option value="running">Em execucao</option>
              <option value="paused">Pausada</option>
              <option value="completed">Finalizada</option>
              <option value="failed">Falhou</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-visible">
          {loading ? (
            <div className="p-20 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="p-20 text-center">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="font-manrope font-black text-slate-700">Nenhuma campanha encontrada</p>
              <p className="text-base font-bold text-slate-600 mt-1">Crie um rascunho para preparar publico e fila.</p>
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-white/80 border-b border-slate-100 text-left">
                  <th className="px-8 py-5 text-xs font-black text-slate-700 uppercase tracking-widest">Campanha</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-700 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-700 uppercase tracking-widest">Progresso</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-700 uppercase tracking-widest">Seguranca</th>
                  <th className="px-8 py-5 text-xs font-black text-slate-700 uppercase tracking-widest text-right">Controles</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredCampaigns.map((campaign) => {
                    const stats = getCampaignStats(campaign);
                    const canEdit = !['running', 'completed'].includes(campaign.status);
                    const canCancel = !['completed', 'cancelled'].includes(campaign.status);
                    const canDelete = campaign.status !== 'running';

                    return (
                      <motion.tr
                        key={campaign.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group transition-all"
                      >
                        <td className="px-8 py-5 min-w-[340px] border-t border-slate-100 bg-white/40 group-hover:bg-primary/[0.03] transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              'w-12 h-12 rounded-2xl border bg-gradient-to-br flex items-center justify-center shadow-sm',
                              statusAccentClasses[campaign.status] || statusAccentClasses.draft
                            )}>
                              <Send className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-lg font-manrope font-black text-slate-950 leading-tight mb-1 group-hover:text-primary transition-colors truncate">{campaign.name}</p>
                              <p className="text-sm font-bold text-slate-800 truncate max-w-md transition-colors group-hover:text-primary">{campaign.description || campaign.message_template || 'Campanha sem descricao'}</p>
                              <div className="mt-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors group-hover:text-primary">
                                <Clock className="w-3 h-3" />
                                {formatDateTime(campaign.next_dispatch_at || campaign.schedule_at)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 border-t border-slate-100 bg-white/40 group-hover:bg-primary/[0.03] transition-colors">
                          <Badge
                            label={statusLabels[campaign.status] || campaign.status}
                            className={cn('font-black text-xs uppercase tracking-widest px-3 py-1.5', statusClasses[campaign.status])}
                          />
                          {campaign.status === 'running' && (
                            <div className="mt-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
                              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                              scheduler ativo
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5 w-80 border-t border-slate-100 bg-white/40 group-hover:bg-primary/[0.03] transition-colors">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm font-black text-slate-900 transition-colors group-hover:text-primary">{stats.processed}/{stats.queueTotal || stats.eligible}</span>
                              <span className="text-xs font-black text-slate-700 uppercase tracking-widest transition-colors group-hover:text-primary">{stats.progress}%</span>
                            </div>
                            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                              <motion.div
                                className="h-full bg-gradient-to-r from-primary to-cyan-400"
                                initial={{ width: 0 }}
                                animate={{ width: `${stats.progress}%` }}
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs font-black uppercase tracking-tight text-slate-700 transition-colors group-hover:text-primary">
                              <span>{stats.sent} enviados</span>
                              <span>{stats.failed} falhas</span>
                              <span>{stats.eligible} elegiveis</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 border-t border-slate-100 bg-white/40 group-hover:bg-primary/[0.03] transition-colors">
                          <div className="flex flex-wrap gap-2">
                            <SafetyChip icon={Timer} label={`${campaign.min_delay_seconds}s-${campaign.max_delay_seconds}s`} />
                            <SafetyChip icon={ShieldCheck} label={`${campaign.per_hour_limit}/hora`} />
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right border-t border-slate-100 bg-white/40 group-hover:bg-primary/[0.03] transition-colors">
                          <div className="flex items-center justify-end gap-2">
                            {campaign.status === 'draft' && (
                              <WorkerButton
                                icon={Play}
                                label="Iniciar"
                                loading={actionLoading === `${campaign.id}:start`}
                                onClick={() => runWorkerAction(campaign, 'start')}
                              />
                            )}
                            {campaign.status === 'paused' && (
                              <WorkerButton
                                icon={Play}
                                label="Retomar"
                                loading={actionLoading === `${campaign.id}:resume`}
                                onClick={() => runWorkerAction(campaign, 'resume')}
                              />
                            )}
                            {campaign.status === 'running' && (
                              <>
                                <WorkerButton
                                  icon={RefreshCw}
                                  label="Forcar"
                                  loading={actionLoading === `${campaign.id}:process`}
                                  onClick={() => runWorkerAction(campaign, 'process')}
                                />
                                <WorkerButton
                                  icon={Pause}
                                  label="Pausar"
                                  tone="muted"
                                  loading={actionLoading === `${campaign.id}:pause`}
                                  onClick={() => runWorkerAction(campaign, 'pause')}
                                />
                                <WorkerButton
                                  icon={ShieldCheck}
                                  label="Cancelar"
                                  tone="danger"
                                  loading={actionLoading === `${campaign.id}:cancel`}
                                  onClick={() => handleCancelCampaign(campaign)}
                                />
                              </>
                            )}
                            <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(openMenuId === campaign.id ? null : campaign.id)}
                              className="p-3 text-slate-400 hover:bg-slate-100 rounded-2xl transition-all"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            <AnimatePresence>
                              {openMenuId === campaign.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                                  className="absolute right-0 top-12 z-40 w-44 rounded-2xl bg-white border border-slate-100 shadow-2xl shadow-slate-900/10 p-2 text-left"
                                >
                                  <MenuButton
                                    icon={Edit3}
                                    label="Editar"
                                    disabled={!canEdit}
                                    onClick={() => handleEditCampaign(campaign)}
                                  />
                                  {canCancel && campaign.status !== 'running' && (
                                    <MenuButton
                                      icon={ShieldCheck}
                                      label={actionLoading === `${campaign.id}:cancel` ? 'Cancelando...' : 'Cancelar'}
                                      tone="warning"
                                      disabled={actionLoading === `${campaign.id}:cancel`}
                                      onClick={() => handleCancelCampaign(campaign)}
                                    />
                                  )}
                                  <MenuButton
                                    icon={Trash2}
                                    label={actionLoading === `${campaign.id}:delete` ? 'Excluindo...' : 'Excluir'}
                                    tone="danger"
                                    disabled={!canDelete || actionLoading === `${campaign.id}:delete`}
                                    onClick={() => handleDeleteCampaign(campaign)}
                                  />
                                </motion.div>
                              )}
                            </AnimatePresence>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </GlassCard>

      <CampaignWizard
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false);
          setCampaignToEdit(null);
        }}
        onCreated={refetch}
        campaignToEdit={campaignToEdit}
      />
    </div>
  );
}

function WorkerButton({ icon: Icon, label, loading, onClick, tone }) {
  const className = {
    muted: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100'
  }[tone] || 'bg-primary text-white hover:shadow-lg hover:shadow-primary/20';

  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-60',
        className
      )}
    >
      <Icon className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
      {loading ? 'Aguarde' : label}
    </button>
  );
}

function SafetyChip({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-black uppercase tracking-widest text-slate-700 border border-slate-200 shadow-sm">
      <Icon className="w-3.5 h-3.5 text-primary" />
      {label}
    </span>
  );
}

function MenuButton({ icon: Icon, label, tone, disabled, onClick }) {
  const toneClass = {
    warning: 'text-amber-600 hover:bg-amber-50',
    danger: 'text-rose-500 hover:bg-rose-50'
  }[tone] || 'text-slate-600 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full px-4 py-3 rounded-xl text-sm font-black uppercase tracking-widest flex items-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left',
        toneClass
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone }) {
  const toneClass = {
    success: 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/10',
    warning: 'bg-amber-500/10 text-amber-500 ring-amber-500/10',
    danger: 'bg-rose-500/10 text-rose-500 ring-rose-500/10'
  }[tone] || 'bg-primary/10 text-primary';

  return (
    <GlassCard className="p-7 border-white/20 bg-slate-950/[0.03] hover:-translate-y-0.5 transition-all">
      <div className="flex items-center gap-4 mb-4">
        <div className={cn('p-3 rounded-2xl ring-8 shadow-inner', toneClass)}>
          <Icon className="w-6 h-6" />
        </div>
        <p className="text-xs font-black text-slate-700 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-4xl font-manrope font-black text-on-surface">{value}</p>
      <div className="mt-4 flex items-center gap-2 text-slate-600 font-bold text-sm">
        <CheckCircle2 className="w-4 h-4" />
        {note}
      </div>
    </GlassCard>
  );
}
