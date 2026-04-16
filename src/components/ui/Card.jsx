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
    glass: 'bg-white/60 backdrop-blur-[32px] backdrop-saturate-[2.0] rounded-[2.5rem] border border-white/20 shadow-sm hover:shadow-xl transition-all duration-500',
    ultra: 'bg-white/65 backdrop-blur-[40px] backdrop-saturate-[2.5] rounded-[2.5rem] border border-white/30 ring-4 ring-blue-500/15 shadow-[0_50px_120px_rgba(59,130,246,0.25)] transition-all duration-500',
    crystal: 'bg-white/45 prism-glass rounded-[2.5rem] border border-white/40 shadow-[0_25px_50px_-12px_rgba(30,41,59,0.12)] transition-all duration-500',
    none: '',
  };

  const beam = props.beam;

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
            padding: '2px', 
          }}
        >
          <div 
            className="absolute bg-blue-400/60 w-12 h-12 rounded-full blur-[20px] animate-border-beam"
            style={{
              offsetPath: 'rect(0 0 100% 100% round 2.5rem)',
              offsetRotate: 'auto',
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
};

