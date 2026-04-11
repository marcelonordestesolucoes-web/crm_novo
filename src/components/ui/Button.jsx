// Componente Base: Button
// Uso: <Button variant="primary" icon="add" onClick={...}>Novo Registro</Button>

import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  primary:   'bg-primary text-white shadow-lg shadow-primary/20 hover:opacity-90',
  secondary: 'border border-outline-variant/30 hover:bg-surface-container-low',
  ghost:     'text-on-surface-variant hover:text-primary hover:bg-primary/5',
  danger:    'bg-error text-white hover:opacity-90',
  dark:      'bg-[#001453] text-white shadow-lg shadow-black/20 hover:opacity-95',
};

const sizes = {
  sm:  'px-4 py-2 text-[11px]',
  md:  'px-6 py-3 text-sm',
  lg:  'px-8 py-4 text-base',
  icon: 'p-2.5',
};

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  className,
  ...props
}) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-manrope font-bold transition-all active:scale-95',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {icon && (
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {icon}
        </span>
      )}
      {children}
      {iconRight && (
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {iconRight}
        </span>
      )}
    </button>
  );
};
