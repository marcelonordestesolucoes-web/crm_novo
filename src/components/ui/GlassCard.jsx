import React, { useState, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { useMouseGlow } from "@/hooks/useMouseGlow";
import { useTilt } from "@/hooks/useTilt";
import { cn } from "@/lib/utils";

/**
 * GlassCard (v400 - UNIFIED)
 * Componente unificado com forwardRef para suportar Drag-and-Drop nativo 
 * e interatividade 3D sem conflitos de camadas.
 */
export const GlassCard = forwardRef(({ children, className = "", depth = true, ...props }, ref) => {
  const [isHovering, setIsHovering] = useState(false);
  const mouse = useMouseGlow();
  const { rotateX, rotateY, glareX, glareY, handleMouseMove, handleMouseLeave } = useTilt();

  return (
    <motion.div
      ref={ref}
      onMouseEnter={() => setIsHovering(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={(e) => {
        handleMouseLeave(e);
        setIsHovering(false);
      }}
      {...props}
      style={{ 
        rotateX, 
        rotateY, 
        perspective: '2000px',
        transformStyle: 'preserve-3d',
        ...props.style
      }}
      className={cn(
        "relative rounded-[2rem] prism-glass bg-[rgba(23,23,30,0.85)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-300 border border-white/10 group/glass flex flex-col isolation-auto",
        className
      )}
    >
      {/* 🌫️ MICA NOISE — Apenas estático */}
      <div className="absolute inset-0 opacity-[0.01] pointer-events-none z-10 mix-blend-overlay rounded-[2rem]" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

      {/* 💡 LUZ REATIVA AO MOUSE — Só renderiza logicamente se estiver em hover (Performance Turbo) */}
      {isHovering && (
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-300 z-0 rounded-[2rem] opacity-0 group-hover/glass:opacity-100"
          style={{
            background: `radial-gradient(
              400px circle at ${mouse.x}px ${mouse.y}px,
              rgba(255,255,255,0.08),
              transparent 60%
            )`,
          }}
        />
      )}

      {/* ✨ SPECULAR GLARE — Só renderiza logicamente se estiver em hover */}
      {isHovering && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-30 opacity-0 group-hover/glass:opacity-100 transition-opacity duration-500 rounded-[2rem]"
          style={{
            background: `radial-gradient(
              600px circle at ${glareX}% ${glareY}%,
              rgba(255,255,255,0.06),
              transparent 40%
            )`,
          }}
        />
      )}

      {/* 💎 RIM LIGHT — Estático */}
      <div className="absolute inset-0 rounded-[2rem] border border-white/20 pointer-events-none z-20" />
      <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/20 to-transparent z-30 opacity-40" />

      {/* 🧠 CONTEÚDO */}
      <div 
        className={cn("relative z-10 h-full", depth && "transform-gpu transition-transform duration-300")}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {children}
      </div>
    </motion.div>
  );
});

GlassCard.displayName = 'GlassCard';
