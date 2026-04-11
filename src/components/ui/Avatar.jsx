import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Componente de Avatar Premium Ultra Glass
 * @param {string} src - URL da imagem do avatar.
 * @param {string} name - Nome do usuário para gerar iniciais e cor.
 * @param {string} size - Tamanho (sm, md, lg, xl).
 * @param {string} className - Classes CSS extras.
 */
export const Avatar = ({ src, name = 'U', size = 'md', className }) => {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  // Gerador de cor baseado no hash do nome
  const getGradient = (str) => {
    const colors = [
      'from-indigo-500 to-primary',
      'from-emerald-400 to-emerald-600',
      'from-rose-400 to-rose-600',
      'from-amber-400 to-amber-600',
      'from-violet-500 to-purple-700',
      'from-sky-400 to-blue-600',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const sizeClasses = {
    xs: 'w-6 h-6 text-[8px]',
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-24 h-24 text-3xl',
  };

  return (
    <div className={cn(
      "relative shrink-0 rounded-[35%] overflow-hidden flex items-center justify-center font-manrope font-black tracking-tighter border-2 border-white/60 shadow-lg transition-transform hover:scale-105 active:scale-95 group",
      sizeClasses[size] || sizeClasses.md,
      className
    )}>
      {src ? (
        <img 
          src={src} 
          alt={name} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
      ) : (
        <div className={cn(
          "w-full h-full bg-gradient-to-br flex items-center justify-center text-white",
          getGradient(name || 'U')
        )}>
          {initials}
        </div>
      )}
      
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
    </div>
  );
};
