// Componente Base: Card
// Uso: <Card>...</Card>  ou  <Card hover elevated>...</Card>

import React from 'react';
import { cn } from '../../lib/utils';

export const Card = ({
  children,
  className,
  variant = 'default', // 'default' | 'glass' | 'none'
  hover = false,
  elevated = false,
  onClick,
  ...props
}) => {
  const variants = {
    default: cn(
      'bg-white rounded-3xl border border-outline-variant/10 shadow-sm',
      elevated && 'shadow-lg'
    ),
    glass: 'bg-white/40 backdrop-blur-md rounded-[2.5rem] border border-white/40 shadow-sm hover:shadow-xl transition-all',
    none: '',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        variants[variant] || variants.default,
        hover && 'hover:shadow-md transition-all cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

