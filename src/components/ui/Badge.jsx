// Componente Base: Badge
// Uso: <Badge variant="hot" />  ou  <Badge className="..." label="Custom" />
// Para adicionar um novo badge global, adicione no constants/config.js

import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  // Prioridades
  'alta':     'bg-error-container text-error',
  'media':    'bg-secondary-fixed text-on-secondary-fixed',
  'baixa':    'bg-surface-container text-on-surface-variant',

  // Status de deals (consumidos de DEAL_STATUS em config.js)
  'new':      'bg-primary-fixed text-on-primary-fixed',
  'hot':      'bg-emerald-100 text-emerald-800',
  'at-risk':  'bg-error-container text-error',

  // Estágios de empresa
  'ativo':    'bg-emerald-100 text-emerald-800',
  'contrato': 'bg-tertiary-fixed text-on-tertiary-fixed',
  'negocio':  'bg-primary-fixed text-on-primary-fixed',

  // Genérico
  'default':  'bg-surface-container text-on-surface-variant',
};

export const Badge = ({ variant = 'default', label, className, ...props }) => {
  const base = 'inline-flex items-center text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-[0.1em]';
  const variantClass = variants[variant] ?? variants.default;

  return (
    <span className={cn(base, variantClass, className)} {...props}>
      {label}
    </span>
  );
};
