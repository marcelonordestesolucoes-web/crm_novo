import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '../ui/Avatar';

export const TopBar = ({ onOpenProfile }) => {
  const { user } = useAuth();
  
  const userName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Usuário';
  const userRole = user?.user_metadata?.role ?? 'ADMIN';
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <header className="h-[72px] bg-surface/90 backdrop-blur-xl flex justify-between items-center px-8 md:px-10 z-40 sticky top-0 transition-colors">
    {/* Search */}
    <div className="relative w-full max-w-2xl group flex-1 mr-8">
      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-[22px]">
        search
      </span>
      <input
        type="text"
        placeholder="Search opportunities, companies, insights..."
        className="w-full bg-slate-100/50 hover:bg-slate-100/80 border border-transparent rounded-[20px] py-3 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-slate-400 font-inter text-on-surface"
      />
    </div>

    {/* Actions */}
    <div className="flex items-center gap-3 ml-6">
      <TopBarAction icon="notifications" hasBadge />
      <TopBarAction icon="auto_awesome" />
      <TopBarAction icon="history" />

      <div className="w-px h-8 bg-slate-200 mx-2" />

      {/* User */}
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

const TopBarAction = ({ icon, hasBadge }) => (
  <button className="p-2.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all relative group">
    <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform" style={{ fontVariationSettings: "'wght' 300" }}>
      {icon}
    </span>
    {hasBadge && (
      <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full border-2 border-white" />
    )}
  </button>
);
