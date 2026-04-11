// src/components/ui/LoadingSpinner.jsx
// Spinner reutilizável para estados de carregamento.

import React from 'react';

export const LoadingSpinner = ({ message = 'Carregando...' }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    <p className="text-sm text-on-surface-variant font-inter font-medium opacity-60">{message}</p>
  </div>
);
