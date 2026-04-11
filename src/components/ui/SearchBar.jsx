// Componente Base: SearchBar
// Uso: <SearchBar placeholder="Buscar..." onChange={setValue} />

import React from 'react';
import { cn } from '../../lib/utils';

export const SearchBar = ({ placeholder = 'Buscar...', value, onChange, className }) => {
  return (
    <div
      className={cn(
        'flex-1 flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-outline-variant/10',
        'group focus-within:border-primary/30 focus-within:shadow-sm transition-all',
        className
      )}
    >
      <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors text-xl">
        search
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none placeholder:text-slate-400 font-inter"
        placeholder={placeholder}
      />
    </div>
  );
};
