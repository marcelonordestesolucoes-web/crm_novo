import React from 'react';
import { CheckCircle2, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, PageHeader, LoadingSpinner, ErrorMessage, Modal } from '@/components/ui';
import { TASK_PRIORITY, TASK_STATUS } from '@/constants/config';
import { useSupabase } from '@/hooks/useSupabase';
import { getTasks, toggleTaskStatus } from '@/services/tasks';
import { TaskForm } from './TaskForm';

const TaskItem = ({ task, onToggle, onEdit }) => {
  const priority = TASK_PRIORITY[task.priority] ?? TASK_PRIORITY.low;
  const isCompleted = task.status === 'completed';

  return (
    <Card variant="glass" className="p-8 group relative overflow-hidden flex items-center gap-8">
      {/* Background Micro-Gradient on Hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 to-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Checkbox Ultra-Integrated */}
      <button
        onClick={() => onToggle(task.id, task.status)}
        className={cn(
          'w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all shrink-0 shadow-sm relative z-10',
          isCompleted 
            ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-200' 
            : 'border-white/60 bg-white/20 hover:border-primary/40 text-transparent hover:text-primary/40'
        )}
      >
        <span className="material-symbols-outlined text-2xl font-black">{isCompleted ? 'check' : 'done'}</span>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-4 mb-2 flex-wrap">
          <h3
            className={cn(
              'font-manrope font-black text-xl transition-all tracking-tight',
              isCompleted ? 'text-slate-300 line-through font-medium' : 'text-on-surface'
            )}
          >
            {task.title}
          </h3>
          <Badge className={cn("px-3 py-1 rounded-full text-[9px] uppercase font-black tracking-widest border border-white/40", priority.badgeClass)} label={priority.label} />
        </div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 opacity-60">
            <span className="material-symbols-outlined text-sm">event</span>
            {task.dueDate} {task.dueTime ? `• ${task.dueTime}` : ''}
          </span>
          {task.dealTitle && (
             <span className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[9px] bg-primary/10 px-3 py-1 rounded-lg border border-primary/10">
               <span className="material-symbols-outlined text-sm">handshake</span>
               {task.dealTitle}
             </span>
          )}
        </div>
      </div>

      {/* Options - Modern Glass Style */}
      <button 
        onClick={() => onEdit(task)}
        className="w-12 h-12 rounded-2xl bg-white/20 hover:bg-white text-slate-300 hover:text-primary transition-all border border-white/60 shadow-sm flex items-center justify-center relative z-10"
      >
        <span className="material-symbols-outlined text-xl">edit_note</span>
      </button>
    </Card>
);
};

const TaskStats = ({ tasks }) => {
  const total = tasks?.length || 0;
  const completed = tasks?.filter(t => t.status === 'completed').length || 0;
  const pending = total - completed;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const stats = [
    { label: 'Total de Ações', value: total, icon: 'assignment', color: 'text-primary', bg: 'bg-primary/5' },
    { label: 'Pendentes', value: pending, icon: 'pending_actions', color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Concluídas', value: completed, icon: 'task_alt', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="space-y-6 sticky top-8">
      {/* Progress Card */}
      <Card className="p-8 bg-gradient-to-br from-primary to-primary-container border-0 shadow-xl shadow-primary/20 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
        <div className="relative z-10">
          <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Produtividade Geral</p>
          <h4 className="text-4xl font-manrope font-black text-white mb-6">{percentage}%</h4>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-4">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            />
          </div>
          <p className="text-white/80 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            {percentage === 100 ? 'Fluxo 100% limpo!' : 'Continue acelerando o fluxo.'}
          </p>
        </div>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4">
        {stats.map((s, i) => (
          <Card variant="glass" key={i} className="p-6 cursor-default group">
            <div className="flex items-center gap-5">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-sm group-hover:scale-110", s.bg)}>
                <span className={cn("material-symbols-outlined text-2xl font-black", s.color)}>{s.icon}</span>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">{s.label}</p>
                <p className="text-2xl font-manrope font-black text-on-surface tracking-tighter">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="p-10 rounded-[2.5rem] bg-white/20 backdrop-blur-md border border-white/40 border-dashed text-center">
        <span className="material-symbols-outlined text-primary/40 text-5xl mb-4">insights</span>
        <p className="text-[10px] font-black text-slate-400 leading-relaxed uppercase tracking-[0.2em] opacity-60">Métricas baseadas no desempenho da sua organização.</p>
      </div>
    </div>
  );
};

export default function Tasks() {
  const { data: tasks, loading, error, refetch } = useSupabase(getTasks);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState(null);

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await toggleTaskStatus(id, currentStatus);
      refetch();
    } catch (err) {
      alert('Erro ao atualizar tarefa: ' + err.message);
    }
  };

  const handleOpenCreate = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (task) => {
    setEditingTask({
        id: task.id,
        title: task.title,
        priority: task.priority,
        type: task.type,
        dueDate: '', 
        dueTime: task.dueTime,
        dealId: '' 
    });
    setModalOpen(true);
  };

  const handleSuccess = () => {
    setModalOpen(false);
    setEditingTask(null);
    refetch();
  };

  return (
    <div className="animate-in fade-in duration-700 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Gestão Estratégica"
        subtitle="Dashboard de ações e acompanhamento de fluxo."
        actions={
          <>
            <Button variant="secondary" size="icon" icon="calendar_month" />
            <Button variant="dark" icon="add" onClick={handleOpenCreate}>Nova Tarefa</Button>
          </>
        }
      />

      {loading && <LoadingSpinner message="Carregando centro de comando..." />}
      {error   && <ErrorMessage message={error} onRetry={refetch} />}

      {!loading && !error && (
        <div className="grid grid-cols-12 gap-10 items-start">
          {/* Main List */}
          <div className="col-span-8 space-y-4">
            {tasks?.length > 0 ? (
              tasks.map((task) => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  onToggle={handleToggleStatus}
                  onEdit={handleOpenEdit}
                />
              ))
            ) : (
              <Card variant="glass" className="p-20 flex flex-col items-center justify-center text-center opacity-50 grayscale border-dashed border-2">
                <span className="material-symbols-outlined text-6xl mb-4">task_alt</span>
                <p className="font-manrope font-bold text-xl">Nenhuma tarefa pendente</p>
                <p className="text-sm">O topo da lista está pronto para novas ações.</p>
              </Card>
            )}
          </div>

          {/* Sidebar Dashboard */}
          <div className="col-span-4">
            <TaskStats tasks={tasks} />
          </div>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
        className="max-w-xl"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setModalOpen(false)} className="px-6 py-2 font-bold text-slate-400 text-sm">Cancelar</button>
            <Button form="task-form" type="submit">{editingTask ? 'Salvar Alterações' : 'Criar Tarefa'}</Button>
          </div>
        }
      >
        <TaskForm 
          initialData={editingTask} 
          onSuccess={handleSuccess} 
          onCancel={() => setModalOpen(false)} 
        />
      </Modal>
    </div>
  );
}

