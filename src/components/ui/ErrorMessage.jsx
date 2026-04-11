// src/components/ui/ErrorMessage.jsx
// Componente de estado de erro reutilizável.

import React from 'react';

export const ErrorMessage = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
    <span className="material-symbols-outlined text-error text-5xl opacity-40">error_outline</span>
    <div>
      <p className="text-base font-bold text-on-surface font-manrope">Algo deu errado</p>
      <p className="text-sm text-on-surface-variant mt-1 font-inter opacity-70 max-w-xs">{message}</p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-2 px-5 py-2.5 bg-primary text-white rounded-2xl text-sm font-manrope font-bold hover:opacity-90 active:scale-95 transition-all"
      >
        Tentar novamente
      </button>
    )}
  </div>
);
