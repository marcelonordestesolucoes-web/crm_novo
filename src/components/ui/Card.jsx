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
  beam = false, // Extraído das props
  ...props
}) => {
  const variants = {
    default: cn(
      'bg-white/85 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5',
      elevated && 'shadow-lg'
    ),
    glass: 'bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(196,250,255,0.48),rgba(250,230,255,0.38))] backdrop-blur-[32px] backdrop-saturate-[2.0] rounded-[2rem] border border-white/60 shadow-[0_18px_45px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/5 hover:shadow-[0_28px_70px_rgba(15,23,42,0.14)] transition-all duration-500',
    ultra: 'bg-white/65 backdrop-blur-[40px] backdrop-saturate-[2.5] rounded-[2.5rem] border border-white/30 ring-4 ring-blue-500/15 shadow-[0_50px_120px_rgba(59,130,246,0.25)] transition-all duration-500',
    crystal: 'bg-white/45 prism-glass rounded-[2.5rem] border border-white/40 shadow-[0_25px_50px_-12px_rgba(30,41,59,0.12)] transition-all duration-500',
    none: '',
  };


  return (
    <div
      onClick={onClick}
      className={cn(
        variants[variant] || variants.default,
        hover && 'hover:shadow-md transition-all cursor-pointer',
        onClick && 'cursor-pointer',
        beam && 'relative overflow-hidden',
        className
      )}
      {...props}
    >
      {variant === 'crystal' && (
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none z-10 mix-blend-overlay" 
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      )}
      {beam && (
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            maskImage: 'linear-gradient(black, black), linear-gradient(black, black)',
            maskClip: 'content-box, border-box',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'destination-out',
            padding: '3px', // Espessura da borda aumentada para 3px
          }}
        >
          <div 
            className="absolute w-64 h-64 rounded-full blur-[45px] animate-border-beam"
            style={{
              background: 'radial-gradient(circle, #00f2ff 0%, #bf5af2 40%, #30d158 70%, transparent 90%)',
              offsetPath: 'inset(0 round 2.5rem)',
              offsetRotate: 'auto',
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
};

