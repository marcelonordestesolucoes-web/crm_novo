import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { NAV_ITEMS } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils'; // Assuming cn utility exists based on previous code

const SidebarLink = ({ item }) => (
  <NavLink
    to={item.path}
    end={item.path === '/'}
    className={({ isActive }) =>
      [
        'flex items-center gap-4 px-5 py-4 rounded-2xl font-inter font-black text-sm transition-all duration-300 group mx-2 tracking-tight',
        isActive
          ? 'bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(196,250,255,0.10),rgba(250,230,255,0.08))] text-white shadow-[0_18px_40px_rgba(0,0,0,0.24)] border border-white/20 backdrop-blur-2xl'
          : 'text-slate-300 hover:text-white hover:bg-white/[0.08] border border-transparent',
      ].join(' ')
    }
  >
    {({ isActive }) => (
      <>
        <span
          className={[
            'material-symbols-outlined text-[20px] transition-colors',
            isActive ? 'text-cyan-300' : 'text-slate-400 group-hover:text-cyan-200'
          ].join(' ')}
          style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
        >
          {item.icon}
        </span>
        {item.label}
      </>
    )}
  </NavLink>
);

export const Sidebar = () => {
  const { user, logout } = useAuth();
  
  // Extrai info do profile se houver
  const userName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Usuário';
  const userRole = user?.user_metadata?.role ?? 'Modo Arquiteto';
  const avatarUrl = user?.user_metadata?.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=003ec7&color=fff`;

  return (
    <nav className="w-[280px] h-screen fixed left-0 top-0 bg-[linear-gradient(180deg,rgba(15,18,29,0.96),rgba(13,18,28,0.94),rgba(24,18,38,0.96))] prism-glass text-slate-300 flex flex-col z-50 border-r border-white/10 antialiased shadow-[18px_0_70px_rgba(15,23,42,0.22)]
      before:absolute before:inset-0 before:border-r before:border-white/10 before:pointer-events-none">
      
      {/* 🌫️ MICA NOISE — Textura de material sólido ultra-fina (1.5%) */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none z-10 mix-blend-overlay" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

      {/* ✨ SIDEBAR INTERNAL PULSES — Vida interna sincronizada */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-400/12 blur-[90px] rounded-full animate-pulse duration-[10000ms] pointer-events-none" />
      <div className="absolute bottom-20 right-0 w-56 h-56 bg-fuchsia-400/10 blur-[90px] rounded-full animate-pulse duration-[8000ms] pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-full h-48 bg-primary/10 blur-[90px] pointer-events-none" />

      {/* ✨ HOLOGRAPHIC RIM — Difração de luz vertical na borda direita */}
      <div className="absolute right-0 inset-y-0 w-px bg-gradient-to-b from-transparent via-cyan-200/35 to-transparent z-30" />

      {/* 📦 CONTEÚDO — Z-index 20 orzado */}
      <div className="relative z-20 flex flex-col h-full overflow-y-auto">
        {/* Brand */}
        <div className="p-7 pb-6">
          <div className="flex flex-col mb-8 px-2">
            <h1 className="text-2xl font-black tracking-tight text-white font-manrope">Decision Center</h1>
            <span className="text-xs text-cyan-100/70 uppercase tracking-widest font-black font-inter mt-1">
              Executive Architect
            </span>
          </div>

          {/* Nav Links — sourced from NAV_ITEMS constant */}
          <div className="space-y-1 -mx-2">
            {NAV_ITEMS.map((item) => (
              <SidebarLink key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pb-4 flex flex-col items-center">
          <div className="px-6 w-full mb-6">
            <button className="w-full bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(196,250,255,0.12),rgba(250,230,255,0.10))] text-white py-4 rounded-2xl font-inter font-black text-sm shadow-[0_18px_40px_rgba(0,0,0,0.22)] flex items-center justify-center gap-3 border border-white/20 hover:bg-white/[0.18] hover:border-cyan-200/30 transition-all duration-300 backdrop-blur-2xl active:scale-95 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Record
            </button>
          </div>

          <div className="px-4 w-full space-y-1 mb-4 flex flex-col">
            <NavLink to="/configuracoes" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-2xl font-inter font-bold text-sm transition-colors group">
              <span className="material-symbols-outlined text-[18px]">settings</span>
              Settings
            </NavLink>
            <NavLink to="/ajuda" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-2xl font-inter font-bold text-sm transition-colors group">
              <span className="material-symbols-outlined text-[18px]">help_outline</span>
              Help
            </NavLink>
          </div>

          {/* User Profile */}
          <div className="w-full px-6 pb-6 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between group cursor-pointer rounded-2xl bg-white/[0.06] border border-white/10 px-3 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-navy-lighter flex items-center justify-center shrink-0 overflow-hidden border-2 border-white/50 group-hover:border-cyan-200 transition-colors shadow-lg">
                  <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-inter font-bold text-white leading-tight truncate">{userName}</p>
                  <p className="text-xs text-cyan-100/70 font-black uppercase tracking-widest mt-0.5 truncate">{userRole}</p>
                </div>
              </div>
              <button 
                onClick={logout}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors shrink-0"
                title="Sair do sistema"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
