import React from 'react';
import { ArrowLeft, FlaskConical, Save } from 'lucide-react';
import { Button } from '@/components/ui';

export default function FlowToolbar({
  flow,
  onBack,
  onChange,
  onSave,
  onTest,
  isSaving = false,
  saveState = 'idle',
  validationCount = 0
}) {
  const saveStateLabel = {
    idle: 'Pronto',
    unsaved: 'Alterações pendentes',
    saving: 'Salvando...',
    saved: 'Salvo agora',
    error: 'Falha ao salvar'
  }[saveState] || 'Pronto';

  return (
    <div className="mb-6 rounded-[2rem] border border-white/70 bg-white/70 backdrop-blur-2xl shadow-[0_24px_60px_rgba(15,23,42,0.08)] px-6 py-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <button
            onClick={onBack}
            className="mt-1 h-11 w-11 shrink-0 rounded-2xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:text-primary hover:border-primary/20 transition-all"
            title="Voltar para listagem"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <input
              value={flow.name || ''}
              onChange={(event) => onChange('name', event.target.value)}
              placeholder="Nome do fluxo"
              className="w-full bg-transparent text-3xl font-black tracking-tight text-slate-950 focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                {saveStateLabel}
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                {validationCount} alertas
              </div>
              <input
                value={flow.description || ''}
                onChange={(event) => onChange('description', event.target.value)}
                placeholder="Descreva o objetivo da automacao"
                className="min-w-[280px] flex-1 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary/10"
              />

              <select
                value={flow.channel}
                onChange={(event) => onChange('channel', event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="crm">CRM</option>
                <option value="email">Email</option>
              </select>

              <select
                value={flow.status}
                onChange={(event) => onChange('status', event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none"
              >
                <option value="inactive">Inativo</option>
                <option value="active">Ativo</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button variant="secondary" onClick={onTest} className="min-w-[136px]">
            <FlaskConical className="w-4 h-4" />
            Testar
          </Button>
          <Button onClick={onSave} disabled={isSaving} className="min-w-[156px]">
            <Save className="w-4 h-4" />
            {isSaving ? 'Salvando...' : 'Salvar fluxo'}
          </Button>
        </div>
      </div>
    </div>
  );
}
