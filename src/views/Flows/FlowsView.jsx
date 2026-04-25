import React, { useMemo, useState } from 'react';
import { Activity, ArrowRight, Bot, Clock3, Plus, Power, Search, Trash2, Workflow } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, LoadingSpinner, PageHeader } from '@/components/ui';
import { useSupabase } from '@/hooks/useSupabase';
import { deleteFlow, getFlows } from '@/services/flows';
import { cn } from '@/lib/utils';

const statusMeta = {
  active: { label: 'Ativo', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  inactive: { label: 'Inativo', className: 'bg-slate-100 text-slate-500 border-slate-200' }
};

export default function FlowsView() {
  const navigate = useNavigate();
  const { data: flows, loading, refetch } = useSupabase(getFlows);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);

  const filteredFlows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (flows || []).filter((flow) => {
      const matchesQuery =
        flow.name?.toLowerCase().includes(query) ||
        flow.description?.toLowerCase().includes(query) ||
        flow.category?.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || flow.status === statusFilter;
      const matchesChannel = channelFilter === 'all' || flow.channel === channelFilter;
      return matchesQuery && matchesStatus && matchesChannel;
    });
  }, [flows, searchQuery, statusFilter, channelFilter]);

  const metrics = useMemo(() => {
    const rows = flows || [];
    return {
      total: rows.length,
      active: rows.filter((flow) => flow.status === 'active').length,
      whatsapp: rows.filter((flow) => flow.channel === 'whatsapp').length,
      updatedToday: rows.filter((flow) => {
        const updated = new Date(flow.updated_at || flow.created_at || 0);
        const now = new Date();
        return updated.toDateString() === now.toDateString();
      }).length
    };
  }, [flows]);

  async function handleDelete(flow) {
    const confirmed = window.confirm(`Excluir o fluxo "${flow.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(flow.id);
      await deleteFlow(flow.id);
      await refetch?.();
    } catch (error) {
      alert(error.message || 'Falha ao excluir fluxo.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen px-8 py-8">
      <PageHeader
        title="Fluxos"
        subtitle="Arquitetura visual de automacoes para atendimento, qualificacao e operacao comercial."
        actions={(
          <Button onClick={() => navigate('/fluxos/novo')}>
            <Plus className="w-4 h-4" />
            Novo fluxo
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        {[
          { label: 'Fluxos totais', value: metrics.total, icon: Workflow, accent: 'from-primary/20 to-cyan-500/10 text-primary border-primary/15' },
          { label: 'Fluxos ativos', value: metrics.active, icon: Power, accent: 'from-emerald-500/20 to-teal-500/10 text-emerald-600 border-emerald-100' },
          { label: 'Canal WhatsApp', value: metrics.whatsapp, icon: Bot, accent: 'from-violet-500/20 to-fuchsia-500/10 text-violet-600 border-violet-100' },
          { label: 'Atualizados hoje', value: metrics.updatedToday, icon: Clock3, accent: 'from-amber-500/20 to-orange-500/10 text-amber-600 border-amber-100' }
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className={cn('rounded-[2rem] border bg-gradient-to-br px-5 py-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)]', metric.accent)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">{metric.label}</p>
                  <p className="mt-3 text-3xl font-black tracking-tight">{metric.value}</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-[2rem] border border-white/70 bg-white/70 backdrop-blur-2xl shadow-[0_24px_60px_rgba(15,23,42,0.08)] p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar fluxos por nome, descricao ou categoria"
              className="w-full rounded-2xl border border-slate-200 bg-white px-12 py-4 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
            >
              <option value="all">Todos status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>

            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
            >
              <option value="all">Todos canais</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="crm">CRM</option>
              <option value="email">Email</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : filteredFlows.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/80 px-8 py-20 text-center">
            <div className="mx-auto h-16 w-16 rounded-3xl bg-white flex items-center justify-center shadow-sm">
              <Workflow className="w-8 h-8 text-primary" />
            </div>
            <h3 className="mt-5 text-2xl font-black tracking-tight text-slate-900">Nenhum fluxo encontrado</h3>
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Crie seu primeiro fluxo para estruturar automacoes de mensagem e CRM.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate('/fluxos/novo')}>
                <Plus className="w-4 h-4" />
                Criar primeiro fluxo
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredFlows.map((flow) => {
              const status = statusMeta[flow.status] || statusMeta.inactive;
              const nodeCount = Array.isArray(flow.flow_json?.nodes) ? flow.flow_json.nodes.length : 0;

              return (
                <div
                  key={flow.id}
                  className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]', status.className)}>
                          {status.label}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                          {flow.channel}
                        </span>
                        <span className="rounded-full bg-primary/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                          {flow.category}
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-950 truncate">{flow.name}</h3>
                      <p className="mt-2 text-sm font-semibold text-slate-500 leading-relaxed min-h-[42px]">
                        {flow.description || 'Fluxo pronto para construir jornadas, mensagens e acoes do CRM.'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(flow)}
                      disabled={deletingId === flow.id}
                      className="h-11 w-11 rounded-2xl border border-slate-200 bg-white text-slate-400 flex items-center justify-center hover:text-rose-500 hover:border-rose-200 transition-all"
                      title="Excluir fluxo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Blocos</p>
                      <p className="mt-2 text-lg font-black text-slate-900">{nodeCount}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Última atualização</p>
                      <p className="mt-2 text-sm font-black text-slate-900">
                        {new Date(flow.updated_at || flow.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                      <Activity className="w-3.5 h-3.5" />
                      Builder visual pronto para evoluir
                    </div>

                    <button
                      onClick={() => navigate(`/fluxos/${flow.id}`)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-primary/20 hover:opacity-95 transition-all"
                    >
                      Abrir builder
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
