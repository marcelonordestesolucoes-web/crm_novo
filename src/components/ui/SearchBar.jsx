// Componente Base: SearchBar
// Uso: <SearchBar placeholder="Buscar..." onChange={setValue} />

import React from 'react';
import { cn } from '../../lib/utils';

export const SearchBar = ({ placeholder = 'Buscar...', value, onChange, className }) => {
  return (
    <div
      className={cn(
        'flex-1 flex items-center gap-3 bg-white/85 px-5 py-3.5 rounded-[1.5rem] border border-slate-300 shadow-sm',
        'group focus-within:border-primary/30 focus-within:shadow-md focus-within:ring-4 focus-within:ring-primary/5 transition-all',
        className
      )}
    >
      <span className="material-symbols-outlined text-slate-600 group-focus-within:text-primary transition-colors text-xl">
        search
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="bg-transparent border-none focus:ring-0 text-base w-full outline-none placeholder:text-slate-500 text-slate-900 font-inter font-semibold"
        placeholder={placeholder}
      />
    </div>
  );
};
