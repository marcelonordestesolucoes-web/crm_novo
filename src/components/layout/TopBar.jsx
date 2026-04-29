import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '../ui/Avatar';

export const TopBar = ({ onOpenProfile }) => {
  const { user } = useAuth();
  
  const userName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Usuário';
  const userRole = user?.user_metadata?.role ?? 'ADMIN';
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <header className="h-[48px] bg-surface/90 backdrop-blur-xl flex justify-end items-center px-6 md:px-8 z-40 sticky top-0 transition-colors">
    <div className="flex items-center gap-3">
      <button 
        onClick={onOpenProfile}
        className="flex items-center gap-3 pl-4 py-1.5 rounded-full hover:bg-slate-50 transition-all group"
      >
        <div className="text-right hidden sm:block leading-tight">
          <div className="text-sm font-inter font-bold text-on-surface tracking-tight">
            {userName}
          </div>
          <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">{userRole}</div>
        </div>
        <Avatar 
          src={avatarUrl} 
          name={userName} 
          size="sm"
          className="border-white/60 shadow-md hover:scale-110"
        />
      </button>
    </div>
  </header>
  );
};
