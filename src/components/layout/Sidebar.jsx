import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { NAV_ITEMS } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';

// Para adicionar/remover uma rota do menu, edite NAV_ITEMS em constants/config.js

const SidebarLink = ({ item }) => (
  <NavLink
    to={item.path}
    end={item.path === '/'}
    className={({ isActive }) =>
      [
        'flex items-center gap-3 px-5 py-3.5 rounded-2xl font-inter font-bold text-sm transition-all duration-300 group mx-2',
        isActive
          ? 'bg-white text-navy shadow-sm'
          : 'text-slate-400 hover:text-white',
      ].join(' ')
    }
  >
    {({ isActive }) => (
      <>
        <span
          className={[
            'material-symbols-outlined text-[20px] transition-colors',
            isActive ? 'text-primary' : 'group-hover:text-primary-fixed-dim'
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
  
  // Extrai info do profile se houver (Supabase pode não ter user.user_metadata se não for cadastrado via Auth com os metas, fallback para email)
  const userName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Usuário';
  const userRole = user?.user_metadata?.role ?? 'Modo Arquiteto';
  const avatarUrl = user?.user_metadata?.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=003ec7&color=fff`;

  return (
    <nav className="w-[280px] h-screen fixed left-0 top-0 bg-navy text-slate-400 flex flex-col z-50">
      {/* Brand */}
      <div className="p-8 pb-6">
        <div className="flex flex-col mb-8">
          <h1 className="text-xl font-extrabold tracking-tight text-white font-manrope">Decision Center</h1>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold font-inter mt-1">
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
          <button className="w-full bg-white text-navy py-3.5 rounded-xl font-inter font-bold text-sm shadow-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Record
          </button>
        </div>

        <div className="px-4 w-full space-y-1 mb-4 flex flex-col">
          <NavLink to="/configuracoes" className="flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white font-inter font-bold text-sm transition-colors group">
            <span className="material-symbols-outlined text-[18px]">settings</span>
            Settings
          </NavLink>
          <NavLink to="/ajuda" className="flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white font-inter font-bold text-sm transition-colors group">
            <span className="material-symbols-outlined text-[18px]">help_outline</span>
            Help
          </NavLink>
        </div>

        {/* User Profile */}
        <div className="w-full px-6 pb-6 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between group cursor-pointer">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-navy-lighter flex items-center justify-center shrink-0 overflow-hidden border-2 border-transparent group-hover:border-slate-400 transition-colors">
                <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 pr-2">
                <p className="text-sm font-inter font-bold text-white leading-tight truncate">{userName}</p>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5 truncate">{userRole}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-navy-lighter transition-colors shrink-0"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
