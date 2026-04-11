import React, { useState, useEffect } from 'react';
import { getDeals } from '@/services/deals';
import { Button } from '@/components/ui';

export function TaskForm({ onSuccess, onCancel, initialData }) {
  const [loading, setLoading] = useState(false);
  const [deals, setDeals] = useState([]);
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    priority: initialData?.priority || 'medium',
    type: initialData?.type || 'task',
    dueDate: initialData?.dueDate || '',
    dueTime: initialData?.dueTime || '',
    dealId: initialData?.dealId || ''
  });

  useEffect(() => {
    getDeals().then(setDeals).catch(console.error);
    
    // Se estiver editando, precisamos garantir que as datas originais sejam preenchidas corretamente
    if (initialData) {
      // Nota: o initialData pode vir formatado para exibição, vamos ajustar conforme necessário
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { createTask, updateTask } = await import('@/services/tasks');
      if (initialData?.id) {
        await updateTask(initialData.id, formData);
      } else {
        await createTask(formData);
      }
      onSuccess();
    } catch (err) {
      alert('Erro ao salvar tarefa: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form id="task-form" onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {/* Título */}
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Descrição da Tarefa</label>
          <input
            autoFocus
            required
            type="text"
            placeholder="Ex: Ligar para confirmar proposta..."
            className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-on-surface font-manrope font-bold focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Prioridade */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Prioridade</label>
            <select
              className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-on-surface font-manrope font-bold focus:ring-2 focus:ring-primary/20 transition-all"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            >
              <option value="high">Alta Prioridade</option>
              <option value="medium">Média Prioridade</option>
              <option value="low">Baixa Prioridade</option>
            </select>
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Tipo de Ação</label>
            <select
              className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-on-surface font-manrope font-bold focus:ring-2 focus:ring-primary/20 transition-all"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="task">Tarefa</option>
              <option value="call">Chamada</option>
              <option value="meeting">Reunião</option>
              <option value="email">E-mail</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Data */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Data de Vencimento</label>
            <input
              required
              type="date"
              className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-on-surface font-manrope font-bold focus:ring-2 focus:ring-primary/20 transition-all"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>

          {/* Hora */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Horário (Opcional)</label>
            <input
              type="time"
              className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-on-surface font-manrope font-bold focus:ring-2 focus:ring-primary/20 transition-all"
              value={formData.dueTime}
              onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
            />
          </div>
        </div>

        {/* Vincular Negócio */}
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Vincular a uma Oportunidade (Deal)</label>
          <select
            className="w-full bg-slate-50 border-0 rounded-2xl p-4 text-on-surface font-manrope font-bold focus:ring-2 focus:ring-primary/20 transition-all"
            value={formData.dealId}
            onChange={(e) => setFormData({ ...formData, dealId: e.target.value })}
          >
            <option value="">Nenhuma oportunidade selecionada</option>
            {deals.map(deal => (
              <option key={deal.id} value={deal.id}>
                {deal.title} - {deal.company}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  );
}
