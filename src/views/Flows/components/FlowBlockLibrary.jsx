import React from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const GROUP_STYLES = {
  Gatilhos: {
    button: 'border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/70',
    icon: 'bg-emerald-50 text-emerald-600'
  },
  Mensagens: {
    button: 'border-cyan-300 hover:border-cyan-400 hover:bg-cyan-50/80',
    icon: 'bg-cyan-50 text-cyan-600'
  },
  Midia: {
    button: 'border-fuchsia-300 hover:border-fuchsia-400 hover:bg-fuchsia-50/80',
    icon: 'bg-fuchsia-50 text-fuchsia-600'
  },
  Botoes: {
    button: 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/80',
    icon: 'bg-slate-100 text-slate-600'
  },
  Integracoes: {
    button: 'border-sky-300 hover:border-sky-400 hover:bg-sky-50/80',
    icon: 'bg-sky-50 text-sky-600'
  },
  Acoes: {
    button: 'border-amber-300 hover:border-amber-400 hover:bg-amber-50/80',
    icon: 'bg-amber-50 text-amber-600'
  },
  Condicoes: {
    button: 'border-amber-300 hover:border-amber-400 hover:bg-amber-50/80',
    icon: 'bg-amber-50 text-amber-600'
  },
  'Acoes CRM': {
    button: 'border-violet-300 hover:border-violet-400 hover:bg-violet-50/80',
    icon: 'bg-violet-50 text-violet-600'
  }
};

function LibraryItem({ item, groupLabel, onClick, compact = false }) {
  const Icon = item.icon;
  const tone = GROUP_STYLES[groupLabel] || {
    button: 'border-slate-200 hover:border-primary/20 hover:bg-primary/5',
    icon: 'bg-slate-100 text-slate-600'
  };

  return (
    <button
      onClick={() => onClick(item.type)}
      className={cn(
        'group rounded-2xl border bg-white/92 text-left transition-all',
        compact ? 'min-h-[82px] px-2.5 py-3' : 'w-full px-4 py-3',
        tone.button
      )}
    >
      <div className={cn('flex items-center justify-center rounded-2xl', compact ? 'mx-auto h-11 w-11' : 'h-10 w-10 shrink-0', tone.icon)}>
        <Icon className="h-4 w-4" />
      </div>

      <div className={compact ? 'mt-3 text-center' : 'ml-0 mt-3'}>
        <p className={cn('font-black text-slate-900', compact ? 'text-[13px]' : 'text-sm')}>
          {item.shortTitle || item.title}
        </p>
        {!compact && (
          <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
            {item.description}
          </p>
        )}
      </div>

      {!compact && (
        <div className="mt-3 flex justify-end">
          <Plus className="h-4 w-4 text-slate-300 transition-colors group-hover:text-primary" />
        </div>
      )}
    </button>
  );
}

export default function FlowBlockLibrary({
  groups,
  onAddBlock,
  selectedNode,
  compact = false,
  title,
  onClose
}) {
  if (compact) {
    return (
      <aside className="flex max-h-[calc(100vh-180px)] w-[320px] flex-col overflow-hidden rounded-[2rem] border border-cyan-300 bg-white/96 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[20px] font-semibold tracking-tight text-slate-700">{title || 'O que voce quer adicionar?'}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-3 text-sm font-bold text-slate-500">
                {group.label}
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {group.items.map((item) => (
                  <LibraryItem
                    key={item.type}
                    item={item}
                    groupLabel={group.label}
                    onClick={onAddBlock}
                    compact
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
      <div className="mb-5">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Biblioteca</p>
        <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">Blocos do fluxo</h3>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Clique para inserir {selectedNode ? `apos "${selectedNode.title}"` : 'ao final do fluxo'}.
        </p>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              {group.label}
            </p>
            <div className="space-y-2">
              {group.items.map((item) => (
                <LibraryItem
                  key={item.type}
                  item={item}
                  groupLabel={group.label}
                  onClick={onAddBlock}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
